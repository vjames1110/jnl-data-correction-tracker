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
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    item.categories.add(category)
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
        category=cement.categories.first(),
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
        category=cement.categories.first(),
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


# ---- the detail behind each summary card ---------------------------------


def _card(user, kind, month="2026-06-01"):
    client = APIClient()
    client.force_authenticate(user=user)
    return client.get(
        reverse(
            "reconciliation-api:dashboard-card",
            kwargs={"kind": kind},
        ),
        {"month": month},
    )


@pytest.mark.django_db
def test_sites_reporting_lists_every_active_site_reported_first(
    dataset, site_a, site_b, company,
):
    quiet = Site.objects.create(
        company=company,
        site_code="AAA",
        site_name="Quiet Site",
    )
    Site.objects.create(
        company=company,
        site_code="OFF",
        site_name="Closed Site",
        is_active=False,
    )

    response = _card(DirectorUserFactory(), "sites_reporting")

    assert response.status_code == status.HTTP_200_OK
    data = response.data["data"]
    assert data["shape"] == "sites"
    rows = data["rows"]
    # Reported sites first (worst first), then the rest by code; the
    # closed site is not a site that should have reported.
    assert [row["site_code"] for row in rows] == ["BKN", "JPR", "AAA"]
    assert [row["reported"] for row in rows] == [True, True, False]
    assert rows[2]["site_id"] == quiet.id
    assert rows[2]["total_entries"] == 0
    # The card's own figures: reporting / total.
    summary = company_summary(period_month=date(2026, 6, 1))
    assert sum(row["reported"] for row in rows) == summary["sites_reporting"]


@pytest.mark.django_db
def test_an_unreported_site_shows_the_status_of_a_period_it_has(
    dataset, company,
):
    quiet = Site.objects.create(
        company=company, site_code="AAA", site_name="Quiet Site"
    )
    get_or_create_period(site=quiet, period_month=date(2026, 6, 1))

    rows = _card(DirectorUserFactory(), "sites_reporting").data["data"]["rows"]

    row = next(r for r in rows if r["site_code"] == "AAA")
    assert row["reported"] is False
    assert row["period_status"] == "DRAFT"


@pytest.mark.django_db
def test_total_entries_lists_only_reporting_sites_busiest_first(
    dataset, site_a, cement,
):
    period_a = dataset[0]
    period_a.entries.create(
        item=Item.objects.create(
            item_name="Sand", reconciliation_type=ReconciliationType.NORM_BASED, uom="CUM",
        ),
        opening_stock=Decimal("1.000"),
        receipts=Decimal("1.000"),
        closing_stock=Decimal("0.000"),
    )

    rows = _card(DirectorUserFactory(), "total_entries").data["data"]["rows"]

    assert [row["site_code"] for row in rows] == ["BKN", "JPR"]
    assert [row["total_entries"] for row in rows] == [2, 1]
    assert all(row["reported"] for row in rows)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "kind, expected_status, expected_site",
    [
        ("over_tolerance", "OVER_TOLERANCE", "BKN"),
        ("within_tolerance", "WITHIN_TOLERANCE", "JPR"),
    ],
)
def test_status_cards_list_the_entries_behind_them(
    dataset, kind, expected_status, expected_site,
):
    data = _card(DirectorUserFactory(), kind).data["data"]

    assert data["shape"] == "entries"
    assert data["total"] == 1 and data["truncated"] is False
    (row,) = data["rows"]
    assert row["status"] == expected_status
    assert row["site_code"] == expected_site
    assert row["item_name"] == "OPC 43 Grade Cement"
    assert {"actual_quantity", "theoretical_or_book_quantity", "variance_value", "site_id"} <= set(row)


@pytest.mark.django_db
def test_a_status_card_with_nothing_behind_it_is_empty(dataset):
    data = _card(DirectorUserFactory(), "watch").data["data"]

    assert data["rows"] == []
    assert data["total"] == 0


@pytest.mark.django_db
@pytest.mark.parametrize("kind", ["total_variance", "largest_variance"])
def test_variance_cards_rank_sites_by_variance(dataset, kind):
    rows = _card(DirectorUserFactory(), kind).data["data"]["rows"]

    assert [row["site_code"] for row in rows] == ["BKN", "JPR"]
    assert Decimal(rows[0]["total_variance_value"]) > Decimal(rows[1]["total_variance_value"])


@pytest.mark.django_db
def test_an_unknown_card_is_a_404(dataset):
    assert _card(DirectorUserFactory(), "nonsense").status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_card_details_follow_the_reports_permission(dataset):
    assert _card(StoreHoUserFactory(), "sites_reporting").status_code == status.HTTP_200_OK
    assert _card(UserFactory(), "sites_reporting").status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_card_details_default_to_the_latest_reported_month(dataset):
    client = APIClient()
    client.force_authenticate(user=DirectorUserFactory())

    response = client.get(
        reverse("reconciliation-api:dashboard-card", kwargs={"kind": "sites_reporting"})
    )

    assert response.data["data"]["period_month"] == "2026-06-01"
