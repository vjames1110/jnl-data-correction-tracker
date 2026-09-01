from datetime import date

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    StoreHoUserFactory,
    UserFactory,
)
from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationType,
    SiteItemConfig,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def reconciliation_master_data():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    site = Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )
    category = ItemCategory.objects.create(
        category_name="Cement",
    )
    inactive_category = ItemCategory.objects.create(
        category_name="Discontinued",
        is_active=False,
    )
    item = Item.objects.create(
        item_name="OPC 43 Grade Cement",
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    item.categories.add(category)
    standard = ItemStandard.objects.create(
        item=item,
        rate=6500,
        mix_ratio="0.32",
        effective_from=date(2026, 1, 1),
    )

    return {
        "company": company,
        "site": site,
        "category": category,
        "inactive_category": inactive_category,
        "item": item,
        "standard": standard,
    }


@pytest.mark.django_db
def test_normal_user_can_list_only_active_categories(
    api_client,
    reconciliation_master_data,
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.get(
        reverse(
            "reconciliation-api:item-categories-list"
        )
    )

    assert response.status_code == status.HTTP_200_OK
    codes = {
        item["category_code"]
        for item in response.data["data"]
    }
    assert (
        reconciliation_master_data[
            "category"
        ].category_code
        in codes
    )
    assert (
        reconciliation_master_data[
            "inactive_category"
        ].category_code
        not in codes
    )


@pytest.mark.django_db
def test_normal_user_cannot_create_item_category(
    api_client,
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse(
            "reconciliation-api:item-categories-list"
        ),
        {"category_name": "Fuel"},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_admin_can_create_item_category(
    api_client,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse(
            "reconciliation-api:item-categories-list"
        ),
        {"category_name": "Fuel And Lubricants"},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert (
        response.data["data"]["category_code"]
        == "FAL"
    )


@pytest.mark.django_db
def test_store_ho_can_create_item_category(
    api_client,
):
    store_ho = StoreHoUserFactory()
    api_client.force_authenticate(user=store_ho)

    response = api_client.post(
        reverse(
            "reconciliation-api:item-categories-list"
        ),
        {"category_name": "Sand And Aggregates"},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )


@pytest.mark.django_db
def test_store_ho_can_see_and_reactivate_inactive_category(
    api_client,
    reconciliation_master_data,
):
    store_ho = StoreHoUserFactory()
    api_client.force_authenticate(user=store_ho)

    list_response = api_client.get(
        reverse(
            "reconciliation-api:item-categories-list"
        )
    )
    codes = {
        item["category_code"]
        for item in list_response.data["data"]
    }
    assert (
        reconciliation_master_data[
            "inactive_category"
        ].category_code
        in codes
    )

    activate_response = api_client.post(
        reverse(
            "reconciliation-api:item-categories-activate",
            kwargs={
                "id": reconciliation_master_data[
                    "inactive_category"
                ].id
            },
        )
    )
    assert (
        activate_response.status_code
        == status.HTTP_200_OK
    )


@pytest.mark.django_db
def test_admin_can_create_item_scoped_to_category(
    api_client,
    reconciliation_master_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse("reconciliation-api:items-list"),
        {
            "item_name": "TMT Steel Bars",
            "categories": [
                str(
                    reconciliation_master_data[
                        "category"
                    ].id
                )
            ],
            "reconciliation_type": (
                ReconciliationType.DIRECT_COUNT
            ),
            "uom": "MT",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert (
        response.data["data"][
            "reconciliation_type"
        ]
        == ReconciliationType.DIRECT_COUNT
    )


@pytest.mark.django_db
def test_store_ho_can_create_item(
    api_client,
    reconciliation_master_data,
):
    store_ho = StoreHoUserFactory()
    api_client.force_authenticate(user=store_ho)

    response = api_client.post(
        reverse("reconciliation-api:items-list"),
        {
            "item_name": "Diesel",
            "categories": [
                str(
                    reconciliation_master_data[
                        "category"
                    ].id
                )
            ],
            "reconciliation_type": (
                ReconciliationType.DIRECT_COUNT
            ),
            "uom": "LTR",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )


@pytest.mark.django_db
def test_admin_can_create_company_default_standard(
    api_client,
    reconciliation_master_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse(
            "reconciliation-api:item-standards-list"
        ),
        {
            "item": str(
                reconciliation_master_data["item"].id
            ),
            "rate": "6700.00",
            "mix_ratio": "0.34",
            "effective_from": "2026-05-01",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert (
        response.data["data"]["item_code"]
        == reconciliation_master_data[
            "item"
        ].item_code
    )
    assert (
        response.data["data"][
            "created_by_employee_id"
        ]
        == admin_user.employee_id
    )


@pytest.mark.django_db
def test_admin_can_create_site_item_config(
    api_client,
    reconciliation_master_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse(
            "reconciliation-api:site-item-configs-list"
        ),
        {
            "item": str(
                reconciliation_master_data["item"].id
            ),
            "site": str(
                reconciliation_master_data["site"].id
            ),
            "rate": "6600.00",
            "mix_ratio": "0.33",
            "effective_from": "2026-04-01",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert (
        response.data["data"]["site_code"]
        == reconciliation_master_data[
            "site"
        ].site_code
    )

    duplicate_response = api_client.post(
        reverse(
            "reconciliation-api:site-item-configs-list"
        ),
        {
            "item": str(
                reconciliation_master_data["item"].id
            ),
            "site": str(
                reconciliation_master_data["site"].id
            ),
            "rate": "6800.00",
            "mix_ratio": "0.35",
            "effective_from": "2026-05-01",
        },
        format="json",
    )
    assert (
        duplicate_response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_dropdown_and_export_endpoints(
    api_client,
    reconciliation_master_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    dropdown_response = api_client.get(
        reverse(
            "reconciliation-api:items-dropdown"
        )
    )
    export_response = api_client.get(
        reverse("reconciliation-api:items-export")
    )

    assert (
        dropdown_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        dropdown_response.data["data"][0]["code"]
        == reconciliation_master_data[
            "item"
        ].item_code
    )
    assert (
        export_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        export_response.data["data"][0][
            "item_code"
        ]
        == reconciliation_master_data[
            "item"
        ].item_code
    )
