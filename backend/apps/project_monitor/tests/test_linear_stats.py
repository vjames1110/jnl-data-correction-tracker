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
from apps.project_monitor.services.linear_generator import (
    create_linear_item,
    create_progress_entry,
    create_scope_patch,
)
from apps.project_monitor.services.linear_stats import (
    compute_item_stats,
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


@pytest.mark.django_db
def test_no_scope_means_unrestricted(
    site, actor
):
    item = create_linear_item(
        site=site,
        name="Earthwork (formation)",
        unit=LinearUnit.M,
        actor=actor,
    )
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

    stats = compute_item_stats(item)

    assert stats["scope"] == 0
    assert stats["done"] == Decimal("2000")
    assert stats["ongoing"] == 0
    assert stats["pending"] == 0


@pytest.mark.django_db
def test_done_shrinks_ongoing(site, actor):
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
        from_chainage_km=Decimal("2.000"),
        to_chainage_km=Decimal("8.000"),
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
        status=ActivityStatus.COMPLETE,
        meeting_date=date(2026, 1, 6),
        actor=actor,
    )

    stats = compute_item_stats(item)

    assert stats["scope"] == Decimal("10000")
    assert stats["done"] == Decimal("2000")
    # ongoing was 2-8 (6 km = 6000 m), minus the
    # 2-4 (2 km = 2000 m) now done, leaving 4-8
    # (4 km = 4000 m).
    assert stats["ongoing"] == Decimal("4000")
    assert stats["pending"] == Decimal("8000")


@pytest.mark.django_db
def test_entries_outside_scope_are_clipped(
    site, actor
):
    item = create_linear_item(
        site=site,
        name="Side drain",
        unit=LinearUnit.M,
        actor=actor,
    )
    create_scope_patch(
        linear_item=item,
        from_chainage_km=Decimal("5.000"),
        to_chainage_km=Decimal("6.000"),
        side="BOTH",
        actor=actor,
    )
    create_progress_entry(
        linear_item=item,
        date=date(2026, 1, 5),
        from_chainage_km=Decimal("0.000"),
        to_chainage_km=Decimal("10.000"),
        side="BOTH",
        status=ActivityStatus.COMPLETE,
        meeting_date=date(2026, 1, 5),
        actor=actor,
    )

    stats = compute_item_stats(item)

    assert stats["scope"] == Decimal("1000")
    # done is clipped to only the in-scope 5-6 km
    # stretch, not the full 0-10 km entry.
    assert stats["done"] == Decimal("1000")
    assert stats["pending"] == 0


@pytest.mark.django_db
def test_hold_status_is_excluded_from_stats(
    site, actor
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
        to_chainage_km=Decimal("5.000"),
        side="BOTH",
        actor=actor,
    )
    create_progress_entry(
        linear_item=item,
        date=date(2026, 1, 5),
        from_chainage_km=Decimal("1.000"),
        to_chainage_km=Decimal("2.000"),
        side="BOTH",
        status=ActivityStatus.HOLD,
        meeting_date=date(2026, 1, 5),
        actor=actor,
    )

    stats = compute_item_stats(item)

    assert stats["done"] == 0
    assert stats["ongoing"] == 0
    assert stats["pending"] == Decimal("5000")


@pytest.mark.django_db
def test_cum_unit_is_a_flat_quantity_sum_with_no_chainage_math(
    site, actor
):
    item = create_linear_item(
        site=site,
        name="Blanketing",
        unit=LinearUnit.CUM,
        actor=actor,
    )
    create_scope_patch(
        linear_item=item,
        from_chainage_km=Decimal("0.000"),
        to_chainage_km=Decimal("10.000"),
        side="BOTH",
        qty=Decimal("500"),
        actor=actor,
    )
    create_progress_entry(
        linear_item=item,
        date=date(2026, 1, 5),
        from_chainage_km=Decimal("0.000"),
        to_chainage_km=Decimal("10.000"),
        side="BOTH",
        qty=Decimal("150"),
        status=ActivityStatus.COMPLETE,
        meeting_date=date(2026, 1, 5),
        actor=actor,
    )
    create_progress_entry(
        linear_item=item,
        date=date(2026, 1, 6),
        from_chainage_km=Decimal("0.000"),
        to_chainage_km=Decimal("10.000"),
        side="BOTH",
        qty=Decimal("80"),
        status=ActivityStatus.IN_PROGRESS,
        meeting_date=date(2026, 1, 6),
        actor=actor,
    )

    stats = compute_item_stats(item)

    assert stats["scope"] == Decimal("500")
    assert stats["done"] == Decimal("150")
    assert stats["ongoing"] == Decimal("80")
    assert stats["pending"] == Decimal("350")


@pytest.mark.django_db
def test_nos_unit_pending_never_goes_negative(
    site, actor
):
    item = create_linear_item(
        site=site,
        name="Trolley refuge",
        unit=LinearUnit.NOS,
        actor=actor,
    )
    create_scope_patch(
        linear_item=item,
        from_chainage_km=Decimal("0.000"),
        to_chainage_km=Decimal("0.000"),
        side="BOTH",
        qty=Decimal("3"),
        actor=actor,
    )
    create_progress_entry(
        linear_item=item,
        date=date(2026, 1, 5),
        from_chainage_km=Decimal("0.000"),
        to_chainage_km=Decimal("0.000"),
        side="BOTH",
        qty=Decimal("5"),
        status=ActivityStatus.COMPLETE,
        meeting_date=date(2026, 1, 5),
        actor=actor,
    )

    stats = compute_item_stats(item)

    assert stats["done"] == Decimal("5")
    assert stats["pending"] == 0
