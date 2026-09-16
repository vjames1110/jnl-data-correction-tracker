from apps.project_monitor.services.interval_math import (
    clip,
    length,
    subtract,
    union,
)


def test_union_merges_overlapping_intervals():
    assert union([(0, 5), (3, 8)]) == [(0, 8)]


def test_union_merges_touching_intervals():
    # Touching endpoints merge too (<=, not <), matching the
    # prototype exactly.
    assert union([(0, 5), (5, 8)]) == [(0, 8)]


def test_union_keeps_disjoint_intervals_separate():
    assert union([(0, 2), (5, 8)]) == [
        (0, 2),
        (5, 8),
    ]


def test_union_sorts_before_merging():
    assert union([(5, 8), (0, 2)]) == [
        (0, 2),
        (5, 8),
    ]


def test_union_drops_zero_and_negative_length_intervals():
    assert union([(0, 0), (3, 1), (2, 5)]) == [
        (2, 5)
    ]


def test_length_sums_interval_lengths():
    assert length([(0, 2), (5, 8)]) == 5


def test_length_of_empty_list_is_zero():
    assert length([]) == 0


def test_clip_keeps_only_positive_overlaps():
    assert clip(
        [(0, 10)], [(2, 4), (6, 8)]
    ) == [(2, 4), (6, 8)]


def test_clip_against_empty_scope_returns_nothing():
    assert clip([(0, 10)], []) == []


def test_clip_drops_touching_but_non_overlapping():
    # touching at a single point has zero length, so it's dropped
    assert clip([(0, 5)], [(5, 10)]) == []


def test_subtract_punches_a_hole_in_the_middle():
    assert subtract(
        [(0, 10)], [(4, 6)]
    ) == [(0, 4), (6, 10)]


def test_subtract_removes_the_whole_interval():
    assert subtract([(0, 10)], [(0, 10)]) == []


def test_subtract_with_no_removals_is_a_no_op():
    assert subtract([(0, 10)], []) == [(0, 10)]


def test_subtract_with_multiple_overlapping_removals():
    # Two separate completed sub-stretches carve two holes out of
    # one ongoing stretch, matching the prototype's iterative
    # per-removal reduction.
    assert subtract(
        [(0, 10)], [(1, 3), (7, 9)]
    ) == [(0, 1), (3, 7), (9, 10)]


def test_subtract_removal_entirely_outside_interval_is_a_no_op():
    assert subtract(
        [(2, 4)], [(10, 20)]
    ) == [(2, 4)]


def test_empty_scope_means_unrestricted():
    """
    The prototype's own explicit rule: when an item has no scope
    patches at all, everything counts unclipped - callers skip
    calling clip() entirely in that case (see
    ``services.linear_stats``), rather than clip() special-casing
    an empty scope itself. This test documents that ``clip()``
    itself is a plain intersection with no special-casing, so the
    "empty scope = unrestricted" behaviour must come from the
    caller choosing not to clip, which is exactly what
    ``compute_item_stats`` does.
    """
    assert clip([(0, 10)], []) == []


def test_completed_shrinks_ongoing_end_to_end():
    """
    The actual composed behaviour ``compute_item_stats`` relies on:
    an "ongoing" interval that partially overlaps a "done" interval
    should only report the true remaining ongoing balance, not the
    full raw ongoing length (the prototype's own worked scenario).
    """
    scope = union([(0, 10)])
    done = clip(union([(0, 4)]), scope)
    ongoing = clip(union([(2, 8)]), scope)
    ongoing_only = subtract(ongoing, done)

    assert done == [(0, 4)]
    assert ongoing_only == [(4, 8)]
    assert length(ongoing_only) == 4
