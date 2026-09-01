from datetime import date

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    UserFactory,
)
from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationEntry,
    ReconciliationPeriod,
    ReconciliationType,
    SiteItemConfig,
)

"""
Reconciliation masters (item categories, items, company defaults,
site overrides) can now be hard-deleted, not just deactivated - a
sample/mistaken row that was never actually used should be
removable outright rather than lingering forever in an "inactive"
state. Anything already referenced by real data is protected at the
database level (PROTECT FKs on Item/ItemCategory), so these tests
cover both the happy path (an unused row deletes cleanly) and the
protected path (a used row is refused with a clear reason, and
nothing is lost).
"""


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


@pytest.mark.django_db
def test_admin_can_delete_an_unused_item_category(
    api_client,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)
    category = ItemCategory.objects.create(
        category_name="0QA Sample Category",
    )

    response = api_client.delete(
        reverse(
            "reconciliation-api:item-categories-detail",
            kwargs={"id": category.id},
        )
    )

    assert (
        response.status_code == status.HTTP_200_OK
    )
    assert not ItemCategory.objects.filter(
        id=category.id
    ).exists()


@pytest.mark.django_db
def test_admin_can_delete_an_unused_item():
    api_client = APIClient()
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)
    category = ItemCategory.objects.create(
        category_name="0QA Sample Category",
    )
    item = Item.objects.create(
        item_name="0QA Sample Item",
        reconciliation_type=(
            ReconciliationType.DIRECT_COUNT
        ),
        uom="MT",
    )
    item.categories.add(category)

    response = api_client.delete(
        reverse(
            "reconciliation-api:items-detail",
            kwargs={"id": item.id},
        )
    )

    assert (
        response.status_code == status.HTTP_200_OK
    )
    assert not Item.objects.filter(
        id=item.id
    ).exists()
    # Deleting the item must not have touched the category it was
    # (only) linked to via the M2M join table.
    assert ItemCategory.objects.filter(
        id=category.id
    ).exists()


@pytest.mark.django_db
def test_admin_can_delete_an_unused_company_default():
    api_client = APIClient()
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)
    category = ItemCategory.objects.create(
        category_name="0QA Sample Category",
    )
    item = Item.objects.create(
        item_name="0QA Sample Item",
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

    response = api_client.delete(
        reverse(
            "reconciliation-api:item-standards-detail",
            kwargs={"id": standard.id},
        )
    )

    assert (
        response.status_code == status.HTTP_200_OK
    )
    assert not ItemStandard.objects.filter(
        id=standard.id
    ).exists()


@pytest.mark.django_db
def test_admin_can_delete_an_unused_site_override(
    site,
):
    api_client = APIClient()
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)
    category = ItemCategory.objects.create(
        category_name="0QA Sample Category",
    )
    item = Item.objects.create(
        item_name="0QA Sample Item",
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    item.categories.add(category)
    config = SiteItemConfig.objects.create(
        item=item,
        site=site,
        rate=6600,
        mix_ratio="0.33",
        effective_from=date(2026, 1, 1),
    )

    response = api_client.delete(
        reverse(
            "reconciliation-api:site-item-configs-detail",
            kwargs={"id": config.id},
        )
    )

    assert (
        response.status_code == status.HTTP_200_OK
    )
    assert not SiteItemConfig.objects.filter(
        id=config.id
    ).exists()


@pytest.mark.django_db
def test_deleting_an_item_used_by_a_company_default_is_refused():
    api_client = APIClient()
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)
    category = ItemCategory.objects.create(
        category_name="0QA Sample Category",
    )
    item = Item.objects.create(
        item_name="0QA Sample Item",
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    item.categories.add(category)
    ItemStandard.objects.create(
        item=item,
        rate=6500,
        mix_ratio="0.32",
        effective_from=date(2026, 1, 1),
    )

    response = api_client.delete(
        reverse(
            "reconciliation-api:items-detail",
            kwargs={"id": item.id},
        )
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert (
        "deactivate"
        in response.data["errors"][0].lower()
    )
    # Nothing was actually removed.
    assert Item.objects.filter(id=item.id).exists()
    assert ItemStandard.objects.filter(
        item_id=item.id
    ).exists()


@pytest.mark.django_db
def test_deleting_a_category_used_by_a_saved_entry_is_refused(
    site,
):
    api_client = APIClient()
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)
    category = ItemCategory.objects.create(
        category_name="0QA Sample Category",
        is_production_output=True,
    )
    item = Item.objects.create(
        item_name="0QA Sample Item",
        reconciliation_type=(
            ReconciliationType.DIRECT_COUNT
        ),
        uom="MT",
    )
    item.categories.add(category)
    period = ReconciliationPeriod.objects.create(
        site=site,
        period_month=date(2026, 4, 1),
    )
    ReconciliationEntry.objects.create(
        period=period,
        item=item,
        category=category,
        book_stock=10,
        physical_count=10,
    )

    response = api_client.delete(
        reverse(
            "reconciliation-api:item-categories-detail",
            kwargs={"id": category.id},
        )
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert ItemCategory.objects.filter(
        id=category.id
    ).exists()


@pytest.mark.django_db
def test_normal_user_cannot_delete_an_item_category():
    api_client = APIClient()
    user = UserFactory()
    api_client.force_authenticate(user=user)
    category = ItemCategory.objects.create(
        category_name="0QA Sample Category",
    )

    response = api_client.delete(
        reverse(
            "reconciliation-api:item-categories-detail",
            kwargs={"id": category.id},
        )
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert ItemCategory.objects.filter(
        id=category.id
    ).exists()
