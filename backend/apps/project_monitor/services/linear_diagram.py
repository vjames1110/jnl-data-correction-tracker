"""
The chainage-segment breakdown behind the Linear Works rolling
diagram - turns a LinearItem's scope patches + progress entries into
a grid of fixed-width chainage columns (e.g. "0+000", "0+100", ...)
with a Planned/Done/Ongoing/Hold coverage per side, per column.

This replaces the old approach of positioning absolute-percent bars
against ``Site.chainage_start_km``/``chainage_end_km`` directly in
the frontend, which silently produced invisible slivers whenever an
item's own chainage data fell outside that (often unset, or simply
too narrow) site-wide window - see ``resolve_range`` below, which
always widens to cover the item's own real data instead of a fixed or
merely-configured span.

Each cell's coverage is a list of ``[start_fraction, end_fraction]``
sub-ranges *within that one segment* (0.0-1.0), not a single scalar
percentage - a segment only 40% covered, with that 40% sitting in the
middle rather than flush against either edge, must visually show it
there, not as a same-sized block anchored to the segment's own left
edge. The frontend paints each range at its own exact position, so
the coloured line matches the real chainage precisely.

Deliberately unit-agnostic: every ScopePatch/ProgressEntry carries a
chainage range regardless of ``unit`` (M/CUM/NOS) - this module never
touches ``qty`` at all, so it produces the same kind of "where is work
happening" picture for every unit alike. The Scope/Done/Ongoing/Pending
*numbers* shown elsewhere keep coming from
``linear_stats.compute_item_stats``, which is a flat sum of each
record's own ``qty`` - the chainage segments drawn here are never
re-derived into those numbers, by design (a segment is only for
viewing where the work is, not for calculating how much of it there
is).
"""

from decimal import Decimal

from apps.project_monitor.models import (
    ActivityStatus,
    LinearSide,
)
from apps.project_monitor.services.interval_math import (
    clip,
    length,
    subtract,
    union,
)

METRES_PER_KM = Decimal("1000")

# The two rows only split into LHS/RHS when the item actually uses
# those sides somewhere; an item logged entirely as BOTH collapses
# to one Planned/Done row-pair instead of two identical ones.
_SPLIT_SIDES = [LinearSide.LHS, LinearSide.RHS]


def suggest_segment_length_km(chainage_end_km):
    """
    A "nice" default segment length, one order of magnitude below the
    chainage's own magnitude in metres - hundreds -> tens, thousands
    -> hundreds - matching a ~100-unit chainage wanting 10-unit
    columns and a ~1000-unit one wanting 100-unit columns. This is
    only ever a *starting* value the segment-length field is
    initialised to; the user can always type a different one.
    """
    if not chainage_end_km or chainage_end_km <= 0:
        return Decimal("0.01")  # 10 m

    # chainage_*_km always has exactly 3 decimal places (the model
    # field's own precision), so this multiplication is always an
    # exact whole number - no float rounding risk at a power-of-ten
    # boundary.
    end_m = int(chainage_end_km * METRES_PER_KM)
    if end_m < 10:
        step_m = Decimal("1")
    else:
        digit_count = len(str(end_m))
        step_power = max(digit_count - 2, 0)
        step_m = Decimal(10) ** step_power

    return step_m / METRES_PER_KM


def _item_own_range(scope_patches, entries):
    """The tightest chainage window actually covering an item's own
    data, or ``(None, None)`` when it has none yet."""
    froms = [record.from_chainage_km for record in (*scope_patches, *entries)]
    tos = [record.to_chainage_km for record in (*scope_patches, *entries)]
    if not froms:
        return None, None
    return min(froms), max(tos)


def resolve_range(scope_patches, entries, chainage_start_km, chainage_end_km):
    """
    The diagram's own displayed chainage window. A configured site
    range is used as the starting point, but is always widened (never
    narrowed) to cover every scope patch/progress entry the item
    actually has - a validly-configured site range that happens to be
    narrower than one particular item's real data (e.g. the site is
    set up for 101-200 km but this item's own scope or a logged entry
    reaches further) must never silently hide that data or leave it
    with nowhere to render, which a plain "use the site range as-is"
    rule would do.
    """
    item_start, item_end = _item_own_range(
        scope_patches, entries
    )
    has_site_range = (
        chainage_start_km is not None
        and chainage_end_km is not None
        and chainage_end_km > chainage_start_km
    )

    if item_start is None:
        if has_site_range:
            return chainage_start_km, chainage_end_km
        return Decimal("0"), Decimal("1")

    if not has_site_range:
        end = (
            item_end
            if item_end > item_start
            else item_start + Decimal("1")
        )
        return item_start, end

    return (
        min(chainage_start_km, item_start),
        max(chainage_end_km, item_end),
    )


def build_segments(start, end, step):
    """Fixed-width [start, end) chainage columns; the final column is
    shortened rather than overshooting ``end`` when the span doesn't
    divide evenly by ``step``."""
    if step <= 0:
        step = end - start or Decimal("1")

    segments = []
    cursor = start
    while cursor < end:
        segment_end = min(cursor + step, end)
        segments.append((cursor, segment_end))
        cursor = segment_end
    return segments or [(start, end)]


def _sides_to_show(scope_patches, entries):
    sides_present = {
        record.side for record in (*scope_patches, *entries)
    }
    if sides_present - {LinearSide.BOTH}:
        return _SPLIT_SIDES
    return [LinearSide.BOTH]


def _matches_side(record_side, side):
    return record_side == side or record_side == LinearSide.BOTH


def _planned_intervals(scope_patches, side):
    return union(
        (patch.from_chainage_km, patch.to_chainage_km)
        for patch in scope_patches
        if _matches_side(patch.side, side)
    )


def _entry_intervals(entries, side, status):
    return union(
        (entry.from_chainage_km, entry.to_chainage_km)
        for entry in entries
        if entry.status == status
        and _matches_side(entry.side, side)
    )


def _side_breakdown(scope_patches, entries, side):
    planned = _planned_intervals(scope_patches, side)
    planned_length = length(planned)

    def _clipped(raw):
        return clip(raw, planned) if planned_length else raw

    # Same precedence as the old diagram's paint order (Completed
    # drawn last/on top of Hold, drawn on top of Ongoing): a segment
    # that is genuinely both done and on hold reads as done; one
    # that is both ongoing and on hold reads as on hold.
    done = _clipped(
        _entry_intervals(entries, side, ActivityStatus.COMPLETE)
    )
    hold = subtract(
        _clipped(_entry_intervals(entries, side, ActivityStatus.HOLD)),
        done,
    )
    ongoing = subtract(
        _clipped(
            _entry_intervals(entries, side, ActivityStatus.IN_PROGRESS)
        ),
        union(done + hold),
    )

    return {
        "planned": planned,
        "done": done,
        "ongoing": ongoing,
        "hold": hold,
        "planned_length": planned_length,
        "done_length": length(done),
    }


def _segment_ranges(intervals, segment):
    """The sub-ranges of ``segment`` that ``intervals`` covers, each
    as ``[start_fraction, end_fraction]`` relative to the segment's
    own start (0.0-1.0) - lets the UI paint colour at the exact
    chainage position within the segment, not a same-width block
    anchored to its left edge regardless of where the real coverage
    actually sits."""
    seg_start, seg_end = segment
    seg_length = seg_end - seg_start
    if seg_length <= 0 or not intervals:
        return []
    return [
        [
            float((start - seg_start) / seg_length),
            float((end - seg_start) / seg_length),
        ]
        for start, end in clip(intervals, [segment])
    ]


def compute_diagram(
    item,
    *,
    chainage_start_km=None,
    chainage_end_km=None,
    segment_length_km=None,
):
    scope_patches = list(item.scope_patches.all())
    entries = list(item.progress_entries.all())

    start, end = resolve_range(
        scope_patches,
        entries,
        chainage_start_km,
        chainage_end_km,
    )
    step = segment_length_km or suggest_segment_length_km(end)
    segments = build_segments(start, end, step)

    sides_payload = {}
    for side in _sides_to_show(scope_patches, entries):
        breakdown = _side_breakdown(scope_patches, entries, side)
        planned_length = breakdown["planned_length"]
        done_length = breakdown["done_length"]
        sides_payload[str(side)] = {
            "planned_length_km": planned_length,
            "done_length_km": done_length,
            "progress_percent": (
                round(float(done_length / planned_length) * 100, 1)
                if planned_length
                else None
            ),
            "cells": [
                {
                    "planned": _segment_ranges(
                        breakdown["planned"], segment
                    ),
                    "done": _segment_ranges(
                        breakdown["done"], segment
                    ),
                    "ongoing": _segment_ranges(
                        breakdown["ongoing"], segment
                    ),
                    "hold": _segment_ranges(
                        breakdown["hold"], segment
                    ),
                }
                for segment in segments
            ],
        }

    return {
        "chainage_start_km": start,
        "chainage_end_km": end,
        "segment_length_km": step,
        "segments": [
            {
                "from_chainage_km": segment_start,
                "to_chainage_km": segment_end,
            }
            for segment_start, segment_end in segments
        ],
        "sides": sides_payload,
    }
