from datetime import date
from decimal import Decimal

import pytest

from apps.authentication.tests.factories import (
    ProjectManagerUserFactory,
)
from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    ActivityStatus,
    LinearUnit,
)
from apps.project_monitor.services.linear_diagram import (
    build_segments,
    compute_diagram,
    resolve_range,
    suggest_segment_length_km,
)
from apps.project_monitor.services.linear_generator import (
    create_linear_item,
    create_progress_entry,
    create_scope_patch,
)


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    return Site.objects.create(
        company=company,
        site_code="CHK",
        site_name="Chunar-Khairahi Doubling Pkg-I",
    )


@pytest.fixture
def actor():
    return ProjectManagerUserFactory()


class TestSuggestSegmentLengthKm:
    def test_a_hundred_odd_metre_range_suggests_ten_metre_steps(self):
        # e.g. chainage 0 to 0.200 km (200 m) - "in the hundreds".
        assert suggest_segment_length_km(
            Decimal("0.200")
        ) == Decimal("0.01")

    def test_a_thousand_odd_metre_range_suggests_hundred_metre_steps(
        self,
    ):
        # e.g. chainage 0 to 1.000 km (1000 m) - "in the thousands".
        assert suggest_segment_length_km(
            Decimal("1.000")
        ) == Decimal("0.1")

    def test_matches_the_reference_image_five_km_case(self):
        # The reference "DRAIN ROLLING DIAGRAM" image: 0 to 5+000
        # (5000 m) suggests a 100 m segment.
        assert suggest_segment_length_km(
            Decimal("5.000")
        ) == Decimal("0.1")

    def test_zero_or_missing_end_falls_back_to_a_sane_default(self):
        assert suggest_segment_length_km(None) == Decimal("0.01")
        assert suggest_segment_length_km(
            Decimal("0")
        ) == Decimal("0.01")


class TestBuildSegments:
    def test_evenly_divides(self):
        segments = build_segments(
            Decimal("0"), Decimal("5"), Decimal("1")
        )
        assert segments == [
            (Decimal("0"), Decimal("1")),
            (Decimal("1"), Decimal("2")),
            (Decimal("2"), Decimal("3")),
            (Decimal("3"), Decimal("4")),
            (Decimal("4"), Decimal("5")),
        ]

    def test_uneven_division_shortens_the_last_segment(self):
        segments = build_segments(
            Decimal("0"), Decimal("2.5"), Decimal("1")
        )
        assert segments[-1] == (
            Decimal("2"),
            Decimal("2.5"),
        )
        assert len(segments) == 3

    def test_start_equal_to_end_returns_one_segment(self):
        segments = build_segments(
            Decimal("3"), Decimal("3"), Decimal("1")
        )
        assert segments == [(Decimal("3"), Decimal("3"))]


@pytest.mark.django_db
class TestResolveRange:
    def test_uses_the_site_range_when_it_makes_sense(self, site, actor):
        item = create_linear_item(
            site=site,
            name="Earthwork",
            unit=LinearUnit.M,
            actor=actor,
        )
        start, end = resolve_range(
            list(item.scope_patches.all()),
            list(item.progress_entries.all()),
            Decimal("0.000"),
            Decimal("10.000"),
        )
        assert (start, end) == (
            Decimal("0.000"),
            Decimal("10.000"),
        )

    def test_falls_back_to_the_items_own_data_when_site_range_is_unset(
        self, site, actor
    ):
        item = create_linear_item(
            site=site,
            name="Safety Fencing",
            unit=LinearUnit.M,
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("100.000"),
            side="BOTH",
            actor=actor,
        )

        start, end = resolve_range(
            list(item.scope_patches.all()),
            list(item.progress_entries.all()),
            None,
            None,
        )

        assert (start, end) == (
            Decimal("0.000"),
            Decimal("100.000"),
        )

    def test_widens_a_too_narrow_site_range_to_include_the_items_own_data(
        self, site, actor
    ):
        """
        A validly-configured site range (end > start) is still not
        allowed to hide part of an item's own real data - e.g. a site
        set up for chainage 101-200 km, with a "Drain" item whose own
        scope/entries reach out to 211 km, must show the whole
        101-211 km stretch, not silently clip it at 200. This is the
        second half of the original bug fix: falling back only when
        the site range is completely unset wasn't enough - a
        perfectly sensible but too-narrow range needed the same
        protection.
        """
        item = create_linear_item(
            site=site,
            name="Drain",
            unit=LinearUnit.M,
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("101.000"),
            to_chainage_km=Decimal("211.000"),
            side="BOTH",
            actor=actor,
        )

        start, end = resolve_range(
            list(item.scope_patches.all()),
            list(item.progress_entries.all()),
            Decimal("101.000"),
            Decimal("200.000"),
        )

        assert (start, end) == (
            Decimal("101.000"),
            Decimal("211.000"),
        )

    def test_falls_back_to_a_default_window_with_no_data_at_all(
        self, site, actor
    ):
        item = create_linear_item(
            site=site,
            name="Earthwork",
            unit=LinearUnit.M,
            actor=actor,
        )
        start, end = resolve_range(
            list(item.scope_patches.all()),
            list(item.progress_entries.all()),
            None,
            None,
        )
        assert start == Decimal("0")
        assert end > start


@pytest.mark.django_db
class TestComputeDiagram:
    def test_bug_fix_a_nos_item_gets_real_chainage_coverage(
        self, site, actor
    ):
        """
        Two real bugs combined: (1) the diagram used to be gated off
        entirely for anything that wasn't unit "M" - a NOS/CUM item
        never rendered at all; (2) when a site's own chainage range
        isn't configured, the old diagram defaulted to a fixed
        "+10 km" window, which for an item whose real data spans far
        more than that (e.g. 100 km) positioned every colored block
        as an invisible sliver off past the visible track - exactly
        what the "Safety Fencing" screenshot showed. Neither should
        happen any more, for any unit.
        """
        item = create_linear_item(
            site=site,
            name="Trolley refuges",
            unit=LinearUnit.NOS,
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("100.000"),
            side="BOTH",
            qty=Decimal("10"),
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 5),
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("10.000"),
            side="BOTH",
            qty=Decimal("1"),
            status=ActivityStatus.COMPLETE,
            meeting_date=date(2026, 1, 5),
            actor=actor,
        )

        # No site chainage range configured at all - the real-world
        # shape of the reported bug.
        diagram = compute_diagram(
            item,
            chainage_start_km=None,
            chainage_end_km=None,
        )

        assert diagram["chainage_start_km"] == Decimal(
            "0.000"
        )
        assert diagram["chainage_end_km"] == Decimal(
            "100.000"
        )
        both = diagram["sides"]["BOTH"]
        # The done stretch (0-10 km out of a 0-100 km window) must
        # show up as real, non-empty coverage on some cell - the old
        # bug showed nothing at all, ever, for a non-M unit.
        assert any(
            cell["done"] for cell in both["cells"]
        )
        assert any(
            cell["planned"] for cell in both["cells"]
        )

    def test_an_entry_beyond_a_too_narrow_site_range_still_shows_up(
        self, site, actor
    ):
        """
        End-to-end version of the "too narrow site range" fix: a
        Drain item with a site range configured as 101-200 km, but
        whose own scope reaches to 211 km and whose ongoing entry
        sits entirely past 200 km, must still render that ongoing
        stretch - not silently drop it because it falls outside the
        site's own configured window.
        """
        item = create_linear_item(
            site=site,
            name="Drain",
            unit=LinearUnit.M,
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("101.000"),
            to_chainage_km=Decimal("211.000"),
            side="BOTH",
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 5),
            from_chainage_km=Decimal("201.000"),
            to_chainage_km=Decimal("211.000"),
            side="BOTH",
            status=ActivityStatus.IN_PROGRESS,
            meeting_date=date(2026, 1, 5),
            actor=actor,
        )

        diagram = compute_diagram(
            item,
            chainage_start_km=Decimal("101.000"),
            chainage_end_km=Decimal("200.000"),
            segment_length_km=Decimal("10"),
        )

        assert diagram["chainage_end_km"] == Decimal(
            "211.000"
        )
        both = diagram["sides"]["BOTH"]
        assert both["planned_length_km"] == Decimal(
            "110.000"
        )
        # The last segment (201-211 km) must show the ongoing
        # coverage - it used to simply not exist as a column at all.
        assert both["cells"][-1]["ongoing"] == [
            [0.0, 1.0]
        ]

    def test_collapses_to_a_single_both_row_when_sides_are_never_used(
        self, site, actor
    ):
        item = create_linear_item(
            site=site,
            name="Earthwork",
            unit=LinearUnit.M,
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("5.000"),
            side="BOTH",
            actor=actor,
        )

        diagram = compute_diagram(item)

        assert list(diagram["sides"].keys()) == ["BOTH"]

    def test_splits_lhs_rhs_the_moment_a_side_specific_record_exists(
        self, site, actor
    ):
        item = create_linear_item(
            site=site,
            name="Side drain",
            unit=LinearUnit.M,
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("5.000"),
            side="LHS",
            actor=actor,
        )

        diagram = compute_diagram(item)

        assert set(diagram["sides"].keys()) == {
            "LHS",
            "RHS",
        }

    def test_a_both_side_record_contributes_to_both_split_rows(
        self, site, actor
    ):
        item = create_linear_item(
            site=site,
            name="Side drain",
            unit=LinearUnit.M,
            actor=actor,
        )
        # One side-specific record forces the LHS/RHS split ...
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("10.000"),
            side="LHS",
            actor=actor,
        )
        # ... and a BOTH-side entry should still count on both.
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 5),
            from_chainage_km=Decimal("2.000"),
            to_chainage_km=Decimal("4.000"),
            side="BOTH",
            status=ActivityStatus.COMPLETE,
            meeting_date=date(2026, 1, 5),
            actor=actor,
        )

        diagram = compute_diagram(
            item,
            chainage_start_km=Decimal("0.000"),
            chainage_end_km=Decimal("10.000"),
            segment_length_km=Decimal("1"),
        )

        # Segment index 2 covers chainage 2-3 km, squarely inside
        # the BOTH-side done entry.
        assert diagram["sides"]["LHS"]["cells"][2][
            "done"
        ] == [[0.0, 1.0]]
        assert diagram["sides"]["RHS"]["cells"][2][
            "done"
        ] == [[0.0, 1.0]]
        # But the RHS-specific scope patch was never created, so RHS
        # has no "planned" coverage at all.
        assert diagram["sides"]["RHS"]["planned_length_km"] == 0

    def test_an_lhs_only_entry_never_shows_up_on_rhs(self, site, actor):
        item = create_linear_item(
            site=site,
            name="Side drain",
            unit=LinearUnit.M,
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("10.000"),
            side="BOTH",
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 5),
            from_chainage_km=Decimal("2.000"),
            to_chainage_km=Decimal("4.000"),
            side="LHS",
            status=ActivityStatus.COMPLETE,
            meeting_date=date(2026, 1, 5),
            actor=actor,
        )

        diagram = compute_diagram(
            item,
            chainage_start_km=Decimal("0.000"),
            chainage_end_km=Decimal("10.000"),
            segment_length_km=Decimal("1"),
        )

        assert diagram["sides"]["LHS"]["cells"][2][
            "done"
        ] == [[0.0, 1.0]]
        assert diagram["sides"]["RHS"]["cells"][2]["done"] == []

    def test_done_shrinks_ongoing_within_a_segment(self, site, actor):
        item = create_linear_item(
            site=site,
            name="P.Way linking",
            unit=LinearUnit.M,
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("10.000"),
            side="BOTH",
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 5),
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("10.000"),
            side="BOTH",
            status=ActivityStatus.IN_PROGRESS,
            meeting_date=date(2026, 1, 5),
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 6),
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("5.000"),
            side="BOTH",
            status=ActivityStatus.COMPLETE,
            meeting_date=date(2026, 1, 6),
            actor=actor,
        )

        diagram = compute_diagram(
            item,
            chainage_start_km=Decimal("0.000"),
            chainage_end_km=Decimal("10.000"),
            segment_length_km=Decimal("1"),
        )
        cells = diagram["sides"]["BOTH"]["cells"]

        # Segment 2 (2-3 km) is fully done.
        assert cells[2]["done"] == [[0.0, 1.0]]
        assert cells[2]["ongoing"] == []
        # Segment 7 (7-8 km) is still ongoing, never completed.
        assert cells[7]["done"] == []
        assert cells[7]["ongoing"] == [[0.0, 1.0]]

    def test_hold_wins_over_ongoing_but_never_over_done(
        self, site, actor
    ):
        item = create_linear_item(
            site=site,
            name="Toe wall",
            unit=LinearUnit.M,
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("10.000"),
            side="BOTH",
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 5),
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("10.000"),
            side="BOTH",
            status=ActivityStatus.IN_PROGRESS,
            meeting_date=date(2026, 1, 5),
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 6),
            from_chainage_km=Decimal("2.000"),
            to_chainage_km=Decimal("4.000"),
            side="BOTH",
            status=ActivityStatus.HOLD,
            meeting_date=date(2026, 1, 6),
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 7),
            from_chainage_km=Decimal("6.000"),
            to_chainage_km=Decimal("8.000"),
            side="BOTH",
            status=ActivityStatus.COMPLETE,
            meeting_date=date(2026, 1, 7),
            actor=actor,
        )

        diagram = compute_diagram(
            item,
            chainage_start_km=Decimal("0.000"),
            chainage_end_km=Decimal("10.000"),
            segment_length_km=Decimal("1"),
        )
        cells = diagram["sides"]["BOTH"]["cells"]

        # 2-4 km: Hold overrides the underlying Ongoing.
        assert cells[2]["hold"] == [[0.0, 1.0]]
        assert cells[2]["ongoing"] == []
        # 6-8 km: Done overrides everything, including Hold/Ongoing.
        assert cells[6]["done"] == [[0.0, 1.0]]
        assert cells[6]["hold"] == []
        assert cells[6]["ongoing"] == []

    def test_a_partially_covered_segment_reports_its_exact_position(
        self, site, actor
    ):
        """
        A segment that is only partly covered, with the covered part
        sitting away from its left edge, must report exactly where -
        not just "how much". This is what lets the UI paint the
        colour at the real chainage position instead of a same-sized
        block always flush against the segment's own start.
        """
        item = create_linear_item(
            site=site,
            name="Drain",
            unit=LinearUnit.M,
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("10.000"),
            side="BOTH",
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 5),
            # Within segment 2 (2-3 km), only 2.4-2.9 km is done -
            # 10% in from the left edge, 90% of the way across.
            from_chainage_km=Decimal("2.400"),
            to_chainage_km=Decimal("2.900"),
            side="BOTH",
            status=ActivityStatus.COMPLETE,
            meeting_date=date(2026, 1, 5),
            actor=actor,
        )

        diagram = compute_diagram(
            item,
            chainage_start_km=Decimal("0.000"),
            chainage_end_km=Decimal("10.000"),
            segment_length_km=Decimal("1"),
        )

        assert diagram["sides"]["BOTH"]["cells"][2][
            "done"
        ] == [[0.4, 0.9]]

    def test_multiple_disjoint_stretches_in_one_segment_all_report(
        self, site, actor
    ):
        """A single segment can contain more than one disjoint done
        stretch (from separate entries) - both must be reported, not
        just the first/last or a merged approximation."""
        item = create_linear_item(
            site=site,
            name="Drain",
            unit=LinearUnit.M,
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("10.000"),
            side="BOTH",
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 5),
            from_chainage_km=Decimal("2.000"),
            to_chainage_km=Decimal("2.200"),
            side="BOTH",
            status=ActivityStatus.COMPLETE,
            meeting_date=date(2026, 1, 5),
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 6),
            from_chainage_km=Decimal("2.700"),
            to_chainage_km=Decimal("3.000"),
            side="BOTH",
            status=ActivityStatus.COMPLETE,
            meeting_date=date(2026, 1, 6),
            actor=actor,
        )

        diagram = compute_diagram(
            item,
            chainage_start_km=Decimal("0.000"),
            chainage_end_km=Decimal("10.000"),
            segment_length_km=Decimal("1"),
        )

        assert diagram["sides"]["BOTH"]["cells"][2][
            "done"
        ] == [[0.0, 0.2], [0.7, 1.0]]

    def test_progress_percent_matches_the_reference_image_style(
        self, site, actor
    ):
        item = create_linear_item(
            site=site,
            name="Drain",
            unit=LinearUnit.M,
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("5.000"),
            side="LHS",
            actor=actor,
        )
        create_scope_patch(
            linear_item=item,
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("5.000"),
            side="RHS",
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 5),
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("1.800"),
            side="LHS",
            status=ActivityStatus.COMPLETE,
            meeting_date=date(2026, 1, 5),
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 5),
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("1.200"),
            side="RHS",
            status=ActivityStatus.COMPLETE,
            meeting_date=date(2026, 1, 5),
            actor=actor,
        )

        diagram = compute_diagram(
            item,
            chainage_start_km=Decimal("0.000"),
            chainage_end_km=Decimal("5.000"),
            segment_length_km=Decimal("0.1"),
        )

        assert (
            diagram["sides"]["LHS"]["progress_percent"] == 36.0
        )
        assert (
            diagram["sides"]["RHS"]["progress_percent"] == 24.0
        )

    def test_progress_percent_is_none_without_any_scope(
        self, site, actor
    ):
        item = create_linear_item(
            site=site,
            name="Earthwork",
            unit=LinearUnit.M,
            actor=actor,
        )
        create_progress_entry(
            linear_item=item,
            date=date(2026, 1, 5),
            from_chainage_km=Decimal("0.000"),
            to_chainage_km=Decimal("2.000"),
            side="BOTH",
            status=ActivityStatus.COMPLETE,
            meeting_date=date(2026, 1, 5),
            actor=actor,
        )

        diagram = compute_diagram(item)

        assert (
            diagram["sides"]["BOTH"]["progress_percent"] is None
        )

    def test_an_explicit_segment_length_overrides_the_suggestion(
        self, site, actor
    ):
        item = create_linear_item(
            site=site,
            name="Earthwork",
            unit=LinearUnit.M,
            actor=actor,
        )

        diagram = compute_diagram(
            item,
            chainage_start_km=Decimal("0.000"),
            chainage_end_km=Decimal("5.000"),
            segment_length_km=Decimal("0.5"),
        )

        assert diagram["segment_length_km"] == Decimal("0.5")
        assert len(diagram["segments"]) == 10
