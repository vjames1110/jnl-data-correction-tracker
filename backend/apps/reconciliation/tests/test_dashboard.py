from datetime import date
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    DirectorUserFactory,
    StoreHoUserFactory,
    UserFactory,
)
from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationType,
)
from apps.reconciliation.selectors.dashboard import (
    company_summary,
    company_trend,
    item_variance_summary,
    latest_reported_month,
    site_variance_summary,
)
from apps.reconciliation.services.periods import (
    get_or_create_period,
)


@pytest.fixture
def company():
    return Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )


@pytest.fixture
def site_a(company):
    return Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )


@pytest.fixture
def site_b(company):
    return Site.objects.create(
        company=company,
        site_code="JPR",
        site_name="Jaipur Site",
    )


@pytest.fixture
def cement(site_a, site_b):
    category = ItemCategory.objects.create(
        category_name="Cement",
        is_production_output=True,
    )
    item = Item.objects.create(
        item_name="OPC 43 Grade Cement",
        category=category,
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    ItemStandard.objects.create(
        item=item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )
    return item


@pytest.fixture
def dataset(site_a, site_b, cement):
    """
    Site A: one badly over-tolerance entry. Site B: one entry
    comfortably within tolerance. Site A should rank first on the
    leaderboard.
    """
    period_a = get_or_create_period(
        site=site_a,
        period_month=date(2026, 6, 1),
    )
    period_a.output_entries.create(
        category=cement.category,
        output_quantity=Decimal("100.000"),
    )
    period_a.entries.create(
        item=cement,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("0.000"),
    )

    period_b = get_or_create_period(
        site=site_b,
        period_month=date(2026, 6, 1),
    )
    period_b.output_entries.create(
        category=cement.category,
        output_quantity=Decimal("100.000"),
    )
    period_b.entries.create(
        item=cement,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("8.000"),
    )

    return period_a, period_b


@pytest.mark.django_db
def test_latest_reported_month_returns_most_recent(
    dataset,
):
    assert latest_reported_month() == date(2026, 6, 1)


@pytest.mark.django_db
def test_latest_reported_month_none_when_no_entries():
    assert latest_reported_month() is None


@pytest.mark.django_db
def test_site_variance_summary_ranks_worst_site_first(
    dataset, site_a, site_b,
):
    rows = site_variance_summary(
        period_month=date(2026, 6, 1),
    )

    assert len(rows) == 2
    assert rows[0]["site_id"] == site_a.id
    assert rows[0]["over_tolerance_count"] == 1
    assert rows[1]["site_id"] == site_b.id
    assert rows[1]["within_tolerance_count"] == 1


@pytest.mark.django_db
def test_site_variance_summary_reports_signed_net_value(
    dataset, site_a, site_b,
):
    # Site A used more than the recipe called for (40 actual vs 32
    # theoretical) - a loss, so net_variance_value should be
    # negative even though total_variance_value (the magnitude used
    # for ranking) is the same positive number either way.
    rows = site_variance_summary(
        period_month=date(2026, 6, 1),
    )
    row_a = next(
        row
        for row in rows
        if row["site_id"] == site_a.id
    )
    row_b = next(
        row
        for row in rows
        if row["site_id"] == site_b.id
    )

    assert row_a["net_variance_value"] == Decimal(
        "-52000.00"
    )
    assert row_a["total_variance_value"] == Decimal(
        "52000.00"
    )
    # Site B's entry was exactly within tolerance (actual ==
    # theoretical), so its net and total variance are both zero.
    assert row_b["net_variance_value"] == Decimal(
        "0.00"
    )


@pytest.mark.django_db
def test_item_variance_summary_counts_sites_affected(
    dataset, cement,
):
    rows = item_variance_summary(
        period_month=date(2026, 6, 1),
    )

    assert len(rows) == 1
    row = rows[0]
    assert row["item_id"] == cement.id
    assert row["total_entries"] == 2
    assert row["over_tolerance_count"] == 1
    assert row["sites_affected"] == 1


@pytest.mark.django_db
def test_company_summary_totals_and_reporting_coverage(
    dataset, site_a, site_b,
):
    summary = company_summary(
        period_month=date(2026, 6, 1),
    )

    assert summary["total_entries"] == 2
    assert summary["over_tolerance_count"] == 1
    assert summary["within_tolerance_count"] == 1
    assert summary["total_sites"] == 2
    assert summary["sites_reporting"] == 2
    assert summary["sites_not_reporting"] == 0
    assert "OVER_TOLERANCE" in summary["flag_totals"]


@pytest.mark.django_db
def test_company_summary_flags_unreported_sites(
    dataset, site_a, site_b,
):
    Site.objects.create(
        company=site_a.company,
        site_code="UDR",
        site_name="Udaipur Site",
    )

    summary = company_summary(
        period_month=date(2026, 6, 1),
    )

    assert summary["total_sites"] == 3
    assert summary["sites_reporting"] == 2
    assert summary["sites_not_reporting"] == 1


@pytest.mark.django_db
def test_company_trend_covers_trailing_months(
    dataset,
):
    rows = company_trend(
        as_of_month=date(2026, 6, 1),
        months=3,
    )

    assert [row["month"] for row in rows] == [
        "2026-04",
        "2026-05",
        "2026-06",
    ]
    assert rows[0]["over_tolerance_count"] == 0
    assert rows[-1]["over_tolerance_count"] == 1


@pytest.mark.django_db
def test_dashboard_api_accessible_to_director(
    dataset,
):
    director = DirectorUserFactory(
        employee_id="DIR001",
    )
    client = APIClient()
    client.force_authenticate(user=director)

    response = client.get(
        reverse("reconciliation-api:dashboard"),
        {"month": "2026-06-01"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert (
        response.data["data"]["period_month"]
        == "2026-06-01"
    )
    assert (
        len(
            response.data["data"]["site_summary"]
        )
        == 2
    )


@pytest.mark.django_db
def test_dashboard_api_forbidden_for_plain_user(
    dataset,
):
    plain_user = UserFactory(
        employee_id="USER020",
    )
    client = APIClient()
    client.force_authenticate(user=plain_user)

    response = client.get(
        reverse("reconciliation-api:dashboard"),
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_dashboard_api_accessible_to_store_ho(
    dataset,
):
    store_ho = StoreHoUserFactory(
        employee_id="STOREHO020",
    )
    client = APIClient()
    client.force_authenticate(user=store_ho)

    response = client.get(
        reverse("reconciliation-api:dashboard"),
    )

    assert response.status_code == status.HTTP_200_OK
