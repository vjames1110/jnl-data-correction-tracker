"""
Direct port of the prototype's chainage interval-set math (its own
``union``/``clip`` functions, plus the "completed shrinks ongoing"
subtraction step inlined in ``itemStats``) - the highest-risk piece
of Linear works, per the roadmap's own flag, so these are plain
functions with no Django imports and real unit tests, not just
inlined into a view.

Intervals are plain ``(from, to)`` tuples of any comparable numeric
type (``Decimal``/``float``/``int`` all work identically here).
"""


def union(intervals):
    """
    Merge overlapping - or touching - intervals into the smallest
    equivalent set, sorted by start. Zero/negative-length intervals
    are dropped. Touching endpoints merge too (``f <= last_end``,
    not ``<``), matching the prototype exactly.
    """
    spans = sorted(
        (
            (start, end)
            for start, end in intervals
            if end > start
        ),
        key=lambda span: span[0],
    )

    merged = []
    for start, end in spans:
        if merged and start <= merged[-1][1]:
            merged[-1] = (
                merged[-1][0],
                max(merged[-1][1], end),
            )
        else:
            merged.append((start, end))
    return merged


def length(intervals):
    """Sum of interval lengths - callers pass an already-``union``-ed
    list to avoid double-counting overlaps."""
    return sum(
        end - start for start, end in intervals
    )


def clip(intervals, scope):
    """
    Intersect every interval against every scope interval, keeping
    only positive-length overlaps - the "restrict to scope" operator.
    """
    out = []
    for start, end in intervals:
        for scope_start, scope_end in scope:
            x = max(start, scope_start)
            y = min(end, scope_end)
            if y > x:
                out.append((x, y))
    return out


def subtract(intervals, remove):
    """
    Interval set-subtraction: ``intervals - remove``. For each
    interval, every overlapping "remove" interval punches a hole in
    it, keeping the left/right remainders - this is the exact
    "a completed sub-stretch shrinks the ongoing remainder" operator
    the prototype relies on, applied iteratively per removal
    interval (so multiple overlapping removals compound correctly).
    """
    result = []
    for start, end in intervals:
        segments = [(start, end)]
        for remove_start, remove_end in remove:
            next_segments = []
            for seg_start, seg_end in segments:
                remainders = []
                if remove_start > seg_start:
                    remainders.append(
                        (
                            seg_start,
                            min(
                                seg_end,
                                remove_start,
                            ),
                        )
                    )
                if remove_end < seg_end:
                    remainders.append(
                        (
                            max(
                                seg_start,
                                remove_end,
                            ),
                            seg_end,
                        )
                    )
                next_segments.extend(
                    (p, q)
                    for p, q in remainders
                    if q > p
                )
            segments = next_segments
        result.extend(segments)
    return result
