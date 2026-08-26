from datetime import date
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    StoreHoUserFactory,
)
from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationPeriodStatus,
    ReconciliationType,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def company():
    return Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )


@pytest.fixture
def site(company):
    return Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )


@pytest.fixture
def other_site(company):
    return Site.objects.create(
        company=company,
        site_code="JPR",
        site_name="Jaipur Site",
    )


@pytest.fixture
def store_ho():
    return StoreHoUserFactory(
        employee_id="STOREHO001",
        first_name="Store",
        last_name="Ho",
    )


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


@pytest.mark.django_db
def test_store_ho_can_fetch_any_sites_current_period(
    api_client,
    store_ho,
    site,
    other_site,
):
    api_client.force_authenticate(user=store_ho)

    response = api_client.get(
        reverse(
            "reconciliation-api:periods-current"
        ),
        {"site": str(site.id), "month": "2026-04-15"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert (
        str(response.data["data"]["site"])
        == str(site.id)
    )
    assert (
        response.data["data"]["period_month"]
        == "2026-04-01"
    )
    assert (
        response.data["data"]["status"]
        == ReconciliationPeriodStatus.DRAFT
    )

    other_response = api_client.get(
        reverse(
            "reconciliation-api:periods-current"
        ),
        {"site": str(other_site.id)},
    )
    assert (
        other_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        str(other_response.data["data"]["site"])
        == str(other_site.id)
    )


@pytest.mark.django_db
def test_store_ho_can_set_stock_count_dates(
    api_client,
    store_ho,
    site,
):
    api_client.force_authenticate(user=store_ho)

    period_response = api_client.get(
        reverse(
            "reconciliation-api:periods-current"
        ),
        {"site": str(site.id)},
    )
    period_id = period_response.data["data"]["id"]

    response = api_client.patch(
        reverse(
            "reconciliation-api:periods-detail",
            kwargs={"id": period_id},
        ),
        {
            "opening_stock_date": "2026-04-01",
            "closing_stock_date": "2026-04-30",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert (
        response.data["data"]["opening_stock_date"]
        == "2026-04-01"
    )
    assert (
        response.data["data"]["closing_stock_date"]
        == "2026-04-30"
    )


@pytest.mark.django_db
def test_closing_stock_date_before_opening_is_rejected(
    api_client,
    store_ho,
    site,
):
    api_client.force_authenticate(user=store_ho)

    period_response = api_client.get(
        reverse(
            "reconciliation-api:periods-current"
        ),
        {"site": str(site.id)},
    )
    period_id = period_response.data["data"]["id"]

    response = api_client.patch(
        reverse(
            "reconciliation-api:periods-detail",
            kwargs={"id": period_id},
        ),
        {
            "opening_stock_date": "2026-04-30",
            "closing_stock_date": "2026-04-01",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_current_period_requires_a_site(
    api_client,
    store_ho,
):
    api_client.force_authenticate(user=store_ho)

    response = api_client.get(
        reverse(
            "reconciliation-api:periods-current"
        )
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_full_entry_lifecycle_and_submit(
    api_client,
    store_ho,
    site,
    norm_based_item,
):
    director = DirectorUserFactory(
        employee_id="DIRECTOR001A",
    )
    api_client.force_authenticate(user=store_ho)

    period_response = api_client.get(
        reverse(
            "reconciliation-api:periods-current"
        ),
        {"site": str(site.id), "month": "2026-04-01"},
    )
    period_id = period_response.data["data"]["id"]

    output_response = api_client.post(
        reverse(
            "reconciliation-api:output-entries-list"
        ),
        {
            "period": period_id,
            "item": str(norm_based_item.id),
            "output_quantity": "100.000",
        },
        format="json",
    )
    assert (
        output_response.status_code
        == status.HTTP_201_CREATED
    )

    entry_response = api_client.post(
        reverse(
            "reconciliation-api:entries-list"
        ),
        {
            "period": period_id,
            "item": str(norm_based_item.id),
            "opening_stock": "10.000",
            "receipts": "30.000",
            "closing_stock": "8.000",
        },
        format="json",
    )
    assert (
        entry_response.status_code
        == status.HTTP_201_CREATED
    )
    assert (
        entry_response.data["data"][
            "actual_quantity"
        ]
        == "32.000"
    )
    assert (
        entry_response.data["data"][
            "theoretical_or_book_quantity"
        ]
        == "32.000"
    )
    assert (
        entry_response.data["data"]["status"]
        == "WITHIN_TOLERANCE"
    )

    submit_response = api_client.post(
        reverse(
            "reconciliation-api:periods-submit",
            kwargs={"id": period_id},
        )
    )
    assert (
        submit_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        submit_response.data["data"]["status"]
        == ReconciliationPeriodStatus.PENDING_APPROVAL
    )
    assert (
        submit_response.data["data"][
            "current_approver_name"
        ]
        == director.full_name
    )
    assert (
        len(
            submit_response.data["data"][
                "approval_steps"
            ]
        )
        == 1
    )

    locked_entry_response = api_client.post(
        reverse(
            "reconciliation-api:entries-list"
        ),
        {
            "period": period_id,
            "item": str(norm_based_item.id),
            "opening_stock": "1.000",
            "receipts": "1.000",
            "closing_stock": "1.000",
        },
        format="json",
    )
    assert (
        locked_entry_response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_submit_requires_at_least_one_entry(
    api_client,
    store_ho,
    site,
):
    api_client.force_authenticate(user=store_ho)

    period_response = api_client.get(
        reverse(
            "reconciliation-api:periods-current"
        ),
        {"site": str(site.id)},
    )
    period_id = period_response.data["data"]["id"]

    submit_response = api_client.post(
        reverse(
            "reconciliation-api:periods-submit",
            kwargs={"id": period_id},
        )
    )
    assert (
        submit_response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_submit_without_configured_approver_fails(
    api_client,
    store_ho,
    site,
    norm_based_item,
):
    api_client.force_authenticate(user=store_ho)

    period_response = api_client.get(
        reverse(
            "reconciliation-api:periods-current"
        ),
        {"site": str(site.id)},
    )
    period_id = period_response.data["data"]["id"]

    api_client.post(
        reverse(
            "reconciliation-api:entries-list"
        ),
        {
            "period": period_id,
            "item": str(norm_based_item.id),
            "opening_stock": "10.000",
            "receipts": "30.000",
            "closing_stock": "8.000",
        },
        format="json",
    )

    submit_response = api_client.post(
        reverse(
            "reconciliation-api:periods-submit",
            kwargs={"id": period_id},
        )
    )
    assert (
        submit_response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


def _submit_period_with_entry(
    api_client, store_ho, site, norm_based_item
):
    api_client.force_authenticate(user=store_ho)
    period_response = api_client.get(
        reverse(
            "reconciliation-api:periods-current"
        ),
        {"site": str(site.id)},
    )
    period_id = period_response.data["data"]["id"]

    api_client.post(
        reverse(
            "reconciliation-api:entries-list"
        ),
        {
            "period": period_id,
            "item": str(norm_based_item.id),
            "opening_stock": "10.000",
            "receipts": "30.000",
            "closing_stock": "8.000",
        },
        format="json",
    )
    api_client.post(
        reverse(
            "reconciliation-api:periods-submit",
            kwargs={"id": period_id},
        )
    )
    return period_id


@pytest.mark.django_db
def test_director_can_approve_pending_period(
    api_client,
    store_ho,
    site,
    norm_based_item,
):
    director = DirectorUserFactory(
        employee_id="DIRECTOR003",
    )
    period_id = _submit_period_with_entry(
        api_client, store_ho, site, norm_based_item
    )

    api_client.force_authenticate(user=director)

    inbox_response = api_client.get(
        reverse(
            "reconciliation-api:periods-pending-approvals"
        )
    )
    assert (
        inbox_response.status_code
        == status.HTTP_200_OK
    )
    assert len(inbox_response.data["data"]) == 1

    approve_response = api_client.post(
        reverse(
            "reconciliation-api:periods-approve",
            kwargs={"id": period_id},
        )
    )
    assert (
        approve_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        approve_response.data["data"]["status"]
        == ReconciliationPeriodStatus.APPROVED
    )


@pytest.mark.django_db
def test_store_ho_cannot_approve_or_see_approvals(
    api_client,
    store_ho,
    site,
    norm_based_item,
):
    """
    Store HO prepares and submits every site's period but is no
    longer an approver - not even for its own submission.
    """
    DirectorUserFactory(employee_id="DIRECTOR004")
    period_id = _submit_period_with_entry(
        api_client, store_ho, site, norm_based_item
    )

    inbox_response = api_client.get(
        reverse(
            "reconciliation-api:periods-pending-approvals"
        )
    )
    assert (
        inbox_response.status_code
        == status.HTTP_403_FORBIDDEN
    )

    approve_response = api_client.post(
        reverse(
            "reconciliation-api:periods-approve",
            kwargs={"id": period_id},
        )
    )
    assert (
        approve_response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_director_can_return_period_for_correction(
    api_client,
    store_ho,
    site,
    norm_based_item,
):
    director = DirectorUserFactory(
        employee_id="DIRECTOR006",
    )
    period_id = _submit_period_with_entry(
        api_client, store_ho, site, norm_based_item
    )

    api_client.force_authenticate(user=director)
    return_response = api_client.post(
        reverse(
            "reconciliation-api:periods-return",
            kwargs={"id": period_id},
        ),
        {"comment": "Please recheck opening stock."},
        format="json",
    )
    assert (
        return_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        return_response.data["data"]["status"]
        == ReconciliationPeriodStatus.DRAFT
    )

    api_client.force_authenticate(user=store_ho)
    resubmit_response = api_client.post(
        reverse(
            "reconciliation-api:periods-submit",
            kwargs={"id": period_id},
        )
    )
    assert (
        resubmit_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        resubmit_response.data["data"]["status"]
        == ReconciliationPeriodStatus.PENDING_APPROVAL
    )
    assert (
        len(
            resubmit_response.data["data"][
                "approval_steps"
            ]
        )
        == 2
    )


@pytest.mark.django_db
def test_admin_can_update_tolerance_settings(
    api_client,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.patch(
        reverse(
            "reconciliation-api:tolerance-settings"
        ),
        {"default_tolerance_percentage": "5.00"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert (
        response.data["data"][
            "default_tolerance_percentage"
        ]
        == "5.00"
    )


@pytest.mark.django_db
def test_store_ho_can_update_tolerance_settings(
    api_client,
    store_ho,
):
    api_client.force_authenticate(user=store_ho)

    response = api_client.patch(
        reverse(
            "reconciliation-api:tolerance-settings"
        ),
        {"default_tolerance_percentage": "4.00"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_director_sees_and_can_approve_any_pending_period(
    api_client,
    store_ho,
    site,
    norm_based_item,
):
    director = DirectorUserFactory(
        employee_id="DIRECTOR007",
    )
    period_id = _submit_period_with_entry(
        api_client, store_ho, site, norm_based_item
    )

    api_client.force_authenticate(user=director)

    inbox_response = api_client.get(
        reverse(
            "reconciliation-api:periods-pending-approvals"
        )
    )
    assert (
        inbox_response.status_code
        == status.HTTP_200_OK
    )
    assert len(inbox_response.data["data"]) == 1

    approve_response = api_client.post(
        reverse(
            "reconciliation-api:periods-approve",
            kwargs={"id": period_id},
        )
    )
    assert (
        approve_response.status_code
        == status.HTTP_200_OK
    )
    current_step = approve_response.data["data"][
        "approval_steps"
    ][0]
    assert current_step["approver_type"] == (
        "DIRECTOR"
    )
    assert current_step["status_display"] == (
        "Approved"
    )


@pytest.mark.django_db
def test_director_can_reopen_rejected_period(
    api_client,
    store_ho,
    site,
    norm_based_item,
):
    director = DirectorUserFactory(
        employee_id="DIRECTOR002",
    )
    period_id = _submit_period_with_entry(
        api_client, store_ho, site, norm_based_item
    )

    api_client.force_authenticate(user=director)
    reject_response = api_client.post(
        reverse(
            "reconciliation-api:periods-reject",
            kwargs={"id": period_id},
        ),
        {"comment": "Numbers look implausible."},
        format="json",
    )
    assert (
        reject_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        reject_response.data["data"]["status"]
        == ReconciliationPeriodStatus.REJECTED
    )

    reopen_response = api_client.post(
        reverse(
            "reconciliation-api:periods-reopen",
            kwargs={"id": period_id},
        )
    )
    assert (
        reopen_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        reopen_response.data["data"]["status"]
        == ReconciliationPeriodStatus.DRAFT
    )

    api_client.force_authenticate(user=store_ho)
    resubmit_response = api_client.post(
        reverse(
            "reconciliation-api:periods-submit",
            kwargs={"id": period_id},
        )
    )
    assert (
        resubmit_response.status_code
        == status.HTTP_200_OK
    )


@pytest.mark.django_db
def test_store_ho_can_reopen_rejected_period(
    api_client,
    store_ho,
    site,
    norm_based_item,
):
    director = DirectorUserFactory(
        employee_id="DIRECTOR010A",
    )
    period_id = _submit_period_with_entry(
        api_client, store_ho, site, norm_based_item
    )

    api_client.force_authenticate(user=director)
    api_client.post(
        reverse(
            "reconciliation-api:periods-reject",
            kwargs={"id": period_id},
        ),
        {"comment": "Not valid."},
        format="json",
    )

    api_client.force_authenticate(user=store_ho)
    reopen_response = api_client.post(
        reverse(
            "reconciliation-api:periods-reopen",
            kwargs={"id": period_id},
        )
    )
    assert (
        reopen_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        reopen_response.data["data"]["status"]
        == ReconciliationPeriodStatus.DRAFT
    )


@pytest.mark.django_db
def test_reopen_requires_rejected_status(
    api_client,
    store_ho,
    site,
    norm_based_item,
):
    DirectorUserFactory(
        employee_id="DIRECTOR010B",
    )
    period_id = _submit_period_with_entry(
        api_client, store_ho, site, norm_based_item
    )

    api_client.force_authenticate(user=store_ho)
    reopen_response = api_client.post(
        reverse(
            "reconciliation-api:periods-reopen",
            kwargs={"id": period_id},
        )
    )
    assert (
        reopen_response.status_code
        == status.HTTP_400_BAD_REQUEST
    )
