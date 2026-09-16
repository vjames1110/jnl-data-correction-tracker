"""
The Python port of the prototype's ``itemStats`` - turns a
``LinearItem``'s scope patches + progress entries into a
``{scope, done, ongoing, pending}`` figure. ``M``-unit items go
through the real chainage interval math (``services.interval_math``);
``CUM``/``NOS`` items are a flat running-quantity sum with no
chainage math at all, exactly matching the prototype's own unit
branch.

Kept separate from ``interval_math.py`` (which stays pure/Django-
free for easy unit testing) since this module knows about the
Django models and the km-to-metre conversion for ``M`` items.
"""

from decimal import Decimal

from apps.project_monitor.models import (
    ActivityStatus,
    LinearUnit,
)
from apps.project_monitor.services.interval_math import (
    clip,
    length,
    subtract,
    union,
)

METRES_PER_KM = Decimal("1000")


def compute_item_stats(item):
    scope_patches = list(
        item.scope_patches.all()
    )
    entries = list(item.progress_entries.all())

    if item.unit != LinearUnit.M:
        scope = sum(
            (patch.qty or Decimal("0"))
            for patch in scope_patches
        )
        done = sum(
            (entry.qty or Decimal("0"))
            for entry in entries
            if entry.status
            == ActivityStatus.COMPLETE
        )
        ongoing = sum(
            (entry.qty or Decimal("0"))
            for entry in entries
            if entry.status
            == ActivityStatus.IN_PROGRESS
        )
        return {
            "scope": scope,
            "done": done,
            "ongoing": ongoing,
            "pending": max(
                Decimal("0"), scope - done
            ),
        }

    scope_intervals = union(
        (
            patch.from_chainage_km,
            patch.to_chainage_km,
        )
        for patch in scope_patches
    )
    scope_length = length(scope_intervals)

    done_intervals = union(
        (
            entry.from_chainage_km,
            entry.to_chainage_km,
        )
        for entry in entries
        if entry.status
        == ActivityStatus.COMPLETE
    )
    done_clipped = (
        clip(done_intervals, scope_intervals)
        if scope_length
        else done_intervals
    )

    ongoing_intervals = union(
        (
            entry.from_chainage_km,
            entry.to_chainage_km,
        )
        for entry in entries
        if entry.status
        == ActivityStatus.IN_PROGRESS
    )
    ongoing_clipped = (
        clip(
            ongoing_intervals, scope_intervals
        )
        if scope_length
        else ongoing_intervals
    )
    ongoing_only = subtract(
        ongoing_clipped, done_clipped
    )

    done_length = length(done_clipped)

    return {
        "scope": scope_length
        * METRES_PER_KM,
        "done": done_length * METRES_PER_KM,
        "ongoing": length(ongoing_only)
        * METRES_PER_KM,
        "pending": max(
            Decimal("0"),
            scope_length - done_length,
        )
        * METRES_PER_KM,
    }
