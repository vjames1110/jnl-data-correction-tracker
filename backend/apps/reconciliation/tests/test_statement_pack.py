from datetime import date
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    DirectorUserFactory,
    UserFactory,
)
from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationType,
)
from apps.reconciliation.selectors.statement_pack import (
    build_statement_pack,
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
def cement():
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
        closing_stock=Decimal("8.000"),
    )

    # Site B has a period but never actually entered anything -
    # should not appear in the pack.
    get_or_create_period(
        site=site_b,
        period_month=date(2026, 6, 1),
    )

    return period_a


@pytest.mark.django_db
def test_build_statement_pack_excludes_sites_with_no_entries(
    dataset, site_a,
):
    pack = build_statement_pack(
        period_month=date(2026, 6, 1),
    )

    assert len(pack) == 1
    assert pack[0]["period"].site_id == site_a.id
    assert len(pack[0]["entries"]) == 1
    assert len(pack[0]["output_entries"]) == 1


@pytest.mark.django_db
def test_build_statement_pack_empty_for_month_with_no_data():
    pack = build_statement_pack(
        period_month=date(2099, 1, 1),
    )
    assert pack == []


@pytest.mark.django_db
def test_statement_pack_api_accessible_to_director(
    dataset,
):
    director = DirectorUserFactory(
        employee_id="DIR002",
    )
    client = APIClient()
    client.force_authenticate(user=director)

    response = client.get(
        reverse(
            "reconciliation-api:statement-pack"
        ),
        {"month": "2026-06-01"},
    )

    assert response.status_code == status.HTTP_200_OK
    statements = response.data["data"]["statements"]
    assert len(statements) == 1
    assert (
        statements[0]["entries"][0][
            "actual_quantity"
        ]
        == "32.000"
    )


@pytest.mark.django_db
def test_statement_pack_api_forbidden_for_plain_user(
    dataset,
):
    plain_user = UserFactory(
        employee_id="USER040",
    )
    client = APIClient()
    client.force_authenticate(user=plain_user)

    response = client.get(
        reverse(
            "reconciliation-api:statement-pack"
        ),
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_build_statement_pack_filters_to_one_site(
    dataset, site_a, site_b,
):
    pack = build_statement_pack(
        period_month=date(2026, 6, 1),
        site_id=site_a.id,
    )

    assert len(pack) == 1
    assert pack[0]["period"].site_id == site_a.id


@pytest.mark.django_db
def test_statement_pack_api_accepts_site_filter(
    dataset, site_a,
):
    director = DirectorUserFactory(
        employee_id="DIR003",
    )
    client = APIClient()
    client.force_authenticate(user=director)

    response = client.get(
        reverse(
            "reconciliation-api:statement-pack"
        ),
        {
            "month": "2026-06-01",
            "site": str(site_a.id),
        },
    )

    assert response.status_code == status.HTTP_200_OK
    statements = response.data["data"]["statements"]
    assert len(statements) == 1
    assert str(
        statements[0]["period"]["site"]
    ) == str(site_a.id)
