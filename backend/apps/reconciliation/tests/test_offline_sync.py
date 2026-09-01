import uuid
from datetime import date
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    StoreHoUserFactory,
)
from apps.employees.models import EmployeeProfile
from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationEntry,
    ReconciliationOutputEntry,
    ReconciliationType,
)
from apps.reconciliation.services.periods import (
    get_or_create_period,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    return Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )


@pytest.fixture
def store_ho(site):
    user = StoreHoUserFactory(
        employee_id="STOREHO030",
    )
    EmployeeProfile.objects.create(
        user=user,
        employee_id=user.employee_id,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        site=site,
    )
    return user


@pytest.fixture
def norm_based_item():
    category = ItemCategory.objects.create(
        category_name="Cement",
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
def production_category(norm_based_item):
    category = norm_based_item.category
    category.is_production_output = True
    category.save(
        update_fields=["is_production_output"],
    )
    return category


@pytest.fixture
def period(site):
    return get_or_create_period(
        site=site,
        period_month=date(2026, 5, 1),
    )


@pytest.mark.django_db
def test_create_entry_with_client_id_uses_that_id(
    api_client,
    store_ho,
    period,
    norm_based_item,
):
    api_client.force_authenticate(user=store_ho)
    client_id = str(uuid.uuid4())

    response = api_client.post(
        reverse(
            "reconciliation-api:entries-list"
        ),
        {
            "id": client_id,
            "period": str(period.id),
            "item": str(norm_based_item.id),
            "opening_stock": "10.000",
            "receipts": "30.000",
            "closing_stock": "8.000",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert (
        response.data["data"]["id"] == client_id
    )
    assert ReconciliationEntry.objects.count() == 1


@pytest.mark.django_db
def test_replaying_create_entry_with_same_client_id_is_idempotent(
    api_client,
    store_ho,
    period,
    norm_based_item,
):
    api_client.force_authenticate(user=store_ho)
    client_id = str(uuid.uuid4())
    payload = {
        "id": client_id,
        "period": str(period.id),
        "item": str(norm_based_item.id),
        "opening_stock": "10.000",
        "receipts": "30.000",
        "closing_stock": "8.000",
    }

    first_response = api_client.post(
        reverse(
            "reconciliation-api:entries-list"
        ),
        payload,
        format="json",
    )
    assert (
        first_response.status_code
        == status.HTTP_201_CREATED
    )

    replay_response = api_client.post(
        reverse(
            "reconciliation-api:entries-list"
        ),
        payload,
        format="json",
    )

    assert (
        replay_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        replay_response.data["data"]["id"]
        == client_id
    )
    assert ReconciliationEntry.objects.count() == 1


@pytest.mark.django_db
def test_create_entry_rejects_malformed_client_id(
    api_client,
    store_ho,
    period,
    norm_based_item,
):
    api_client.force_authenticate(user=store_ho)

    response = api_client.post(
        reverse(
            "reconciliation-api:entries-list"
        ),
        {
            "id": "not-a-uuid",
            "period": str(period.id),
            "item": str(norm_based_item.id),
            "opening_stock": "10.000",
            "receipts": "30.000",
            "closing_stock": "8.000",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert ReconciliationEntry.objects.count() == 0


@pytest.mark.django_db
def test_replaying_create_entry_after_period_locked_still_idempotent(
    api_client,
    store_ho,
    period,
    norm_based_item,
):
    """
    A queued create that actually succeeded before the period was
    submitted must still return the existing row on replay, even
    though a *new* create would now be rejected as not editable.
    """
    api_client.force_authenticate(user=store_ho)
    client_id = str(uuid.uuid4())
    payload = {
        "id": client_id,
        "period": str(period.id),
        "item": str(norm_based_item.id),
        "opening_stock": "10.000",
        "receipts": "30.000",
        "closing_stock": "8.000",
    }
    api_client.post(
        reverse(
            "reconciliation-api:entries-list"
        ),
        payload,
        format="json",
    )

    api_client.post(
        reverse(
            "reconciliation-api:periods-submit",
            kwargs={"id": str(period.id)},
        )
    )

    replay_response = api_client.post(
        reverse(
            "reconciliation-api:entries-list"
        ),
        payload,
        format="json",
    )

    assert (
        replay_response.status_code
        == status.HTTP_200_OK
    )
    assert ReconciliationEntry.objects.count() == 1


@pytest.mark.django_db
def test_create_output_entry_with_client_id_is_idempotent(
    api_client,
    store_ho,
    period,
    production_category,
):
    api_client.force_authenticate(user=store_ho)
    client_id = str(uuid.uuid4())
    payload = {
        "id": client_id,
        "period": str(period.id),
        "category": str(production_category.id),
        "output_quantity": "100.000",
    }

    first_response = api_client.post(
        reverse(
            "reconciliation-api:output-entries-list"
        ),
        payload,
        format="json",
    )
    assert (
        first_response.status_code
        == status.HTTP_201_CREATED
    )

    replay_response = api_client.post(
        reverse(
            "reconciliation-api:output-entries-list"
        ),
        payload,
        format="json",
    )

    assert (
        replay_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        ReconciliationOutputEntry.objects.count()
        == 1
    )


@pytest.mark.django_db
def test_create_entry_without_client_id_still_works(
    api_client,
    store_ho,
    period,
    norm_based_item,
):
    """
    Backward compatibility: the server still generates an id when
    the client doesn't supply one, exactly as before this phase.
    """
    api_client.force_authenticate(user=store_ho)

    response = api_client.post(
        reverse(
            "reconciliation-api:entries-list"
        ),
        {
            "period": str(period.id),
            "item": str(norm_based_item.id),
            "opening_stock": "10.000",
            "receipts": "30.000",
            "closing_stock": "8.000",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert response.data["data"]["id"]
