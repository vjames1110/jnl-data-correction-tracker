"""
Miscellaneous (non-production) use of a recipe material - the
consumed quantity is deducted from the month's consumption before
variance is worked out, so use outside production doesn't read as an
unexplained loss against the production output.
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    DirectorUserFactory,
    StoreHoUserFactory,
)
from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationEntry,
    ReconciliationFlagType,
    ReconciliationMiscUsage,
    ReconciliationOutputEntry,
    ReconciliationPeriod,
    ReconciliationPeriodStatus,
    ReconciliationType,
)


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
def category():
    return ItemCategory.objects.create(
        category_name="Concrete",
        is_production_output=True,
    )


@pytest.fixture
def cement(category):
    item = Item.objects.create(
        item_name="OPC 43 Grade Cement",
        reconciliation_type=ReconciliationType.NORM_BASED,
        uom="MT",
    )
    item.categories.add(category)
    ItemStandard.objects.create(
        item=item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.50"),
        effective_from=date(2026, 1, 1),
    )
    return item


@pytest.fixture
def steel(category):
    item = Item.objects.create(
        item_name="TMT Steel Bars",
        reconciliation_type=ReconciliationType.DIRECT_COUNT,
        uom="MT",
    )
    item.categories.add(category)
    ItemStandard.objects.create(
        item=item,
        rate=Decimal("60000.00"),
        effective_from=date(2026, 1, 1),
    )
    return item


@pytest.fixture
def period(site):
    return ReconciliationPeriod.objects.create(
        site=site, period_month=date(2026, 4, 1)
    )


def _entry(period, item, opening="100", receipts="50", closing="40"):
    return ReconciliationEntry.objects.create(
        period=period,
        item=item,
        opening_stock=Decimal(opening),
        receipts=Decimal(receipts),
        closing_stock=Decimal(closing),
    )


def _produce(period, category, quantity="200"):
    return ReconciliationOutputEntry.objects.create(
        period=period,
        category=category,
        output_quantity=Decimal(quantity),
    )


# ---- the adjustment itself ---------------------------------------------------------------------


@pytest.mark.django_db
def test_misc_use_is_deducted_from_actual_consumption(
    period, cement, category
):
    _produce(period, category, "200")  # theoretical 200 x 0.50 = 100
    entry = _entry(period, cement)  # 100 + 50 - 40 = 110 gross

    assert entry.actual_quantity == Decimal("110.000")
    # 10 more than the recipe says - looks like an overuse.
    assert entry.variance_quantity == Decimal("-10.000")

    ReconciliationMiscUsage.objects.create(
        period=period, item=cement, quantity=Decimal("10")
    )
    entry.refresh_from_db()

    assert entry.miscellaneous_quantity == Decimal("10.000")
    assert entry.actual_quantity == Decimal("100.000")
    assert entry.variance_quantity == Decimal("0.000")
    assert entry.variance_value == Decimal("0.00")
    assert entry.status == "WITHIN_TOLERANCE"


@pytest.mark.django_db
def test_changing_the_quantity_recomputes_the_entry(
    period, cement, category
):
    _produce(period, category, "200")
    entry = _entry(period, cement)
    misc = ReconciliationMiscUsage.objects.create(
        period=period, item=cement, quantity=Decimal("10")
    )

    misc.quantity = Decimal("4")
    misc.save()

    entry.refresh_from_db()
    assert entry.actual_quantity == Decimal("106.000")
    assert entry.miscellaneous_quantity == Decimal("4.000")


@pytest.mark.django_db
def test_removing_it_restores_the_full_consumption(
    period, cement, category
):
    _produce(period, category, "200")
    entry = _entry(period, cement)
    misc = ReconciliationMiscUsage.objects.create(
        period=period, item=cement, quantity=Decimal("10")
    )

    misc.delete()

    entry.refresh_from_db()
    assert entry.miscellaneous_quantity == Decimal("0.000")
    assert entry.actual_quantity == Decimal("110.000")


@pytest.mark.django_db
def test_an_entry_saved_after_the_misc_use_picks_it_up(
    period, cement, category
):
    _produce(period, category, "200")
    ReconciliationMiscUsage.objects.create(
        period=period, item=cement, quantity=Decimal("10")
    )

    entry = _entry(period, cement)

    assert entry.actual_quantity == Decimal("100.000")


@pytest.mark.django_db
def test_misc_use_shows_even_while_the_entry_is_incomplete(
    period, cement
):
    ReconciliationMiscUsage.objects.create(
        period=period, item=cement, quantity=Decimal("10")
    )
    entry = ReconciliationEntry.objects.create(
        period=period, item=cement, opening_stock=Decimal("5")
    )

    assert entry.miscellaneous_quantity == Decimal("10.000")
    assert entry.actual_quantity is None


@pytest.mark.django_db
def test_misc_use_of_another_material_or_month_is_not_deducted(
    site, period, cement, category
):
    other_material = Item.objects.create(
        item_name="River Sand",
        reconciliation_type=ReconciliationType.NORM_BASED,
        uom="MT",
    )
    other_material.categories.add(category)
    ReconciliationMiscUsage.objects.create(
        period=period,
        item=other_material,
        quantity=Decimal("30"),
    )
    other_month = ReconciliationPeriod.objects.create(
        site=site, period_month=date(2026, 5, 1)
    )
    ReconciliationMiscUsage.objects.create(
        period=other_month, item=cement, quantity=Decimal("30")
    )

    entry = _entry(period, cement)

    assert entry.miscellaneous_quantity == Decimal("0.000")
    assert entry.actual_quantity == Decimal("110.000")


@pytest.mark.django_db
def test_more_misc_use_than_left_stock_is_flagged_as_negative(
    period, cement, category
):
    _produce(period, category, "200")
    entry = _entry(period, cement)  # gross 110
    ReconciliationMiscUsage.objects.create(
        period=period, item=cement, quantity=Decimal("150")
    )

    entry.refresh_from_db()

    assert entry.actual_quantity == Decimal("-40.000")
    flag = entry.flags.get(
        flag_type=ReconciliationFlagType.NEGATIVE_CONSUMPTION
    )
    assert "miscellaneous" in flag.message.lower()


@pytest.mark.django_db
def test_a_direct_count_entry_is_never_adjusted(period, steel):
    entry = ReconciliationEntry.objects.create(
        period=period,
        item=steel,
        book_stock=Decimal("10"),
        physical_count=Decimal("9"),
    )

    assert entry.miscellaneous_quantity == Decimal("0")
    assert entry.actual_quantity == Decimal("9.000")


# ---- validation --------------------------------------------------------------------------------


@pytest.mark.django_db
def test_only_recipe_materials_can_be_logged(period, steel):
    with pytest.raises(ValidationError) as caught:
        ReconciliationMiscUsage.objects.create(
            period=period, item=steel, quantity=Decimal("1")
        )

    assert "item" in caught.value.message_dict


@pytest.mark.django_db
@pytest.mark.parametrize("quantity", ["0", "-3"])
def test_the_quantity_must_be_above_zero(
    period, cement, quantity
):
    with pytest.raises(ValidationError) as caught:
        ReconciliationMiscUsage.objects.create(
            period=period,
            item=cement,
            quantity=Decimal(quantity),
        )

    assert "quantity" in caught.value.message_dict


@pytest.mark.django_db
def test_one_row_per_material_per_month(period, cement):
    ReconciliationMiscUsage.objects.create(
        period=period, item=cement, quantity=Decimal("1")
    )

    with pytest.raises(ValidationError):
        ReconciliationMiscUsage.objects.create(
            period=period, item=cement, quantity=Decimal("2")
        )


# ---- API ---------------------------------------------------------------------------------------


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def store_ho():
    return StoreHoUserFactory(employee_id="STOREHO001")


def _url(name, **kwargs):
    return reverse(f"reconciliation-api:{name}", kwargs=kwargs)


@pytest.mark.django_db
def test_store_ho_logs_lists_edits_and_deletes_misc_use(
    api_client, store_ho, period, cement, category
):
    _produce(period, category, "200")
    entry = _entry(period, cement)
    api_client.force_authenticate(user=store_ho)

    created = api_client.post(
        _url("misc-usage-list"),
        {
            "period": str(period.id),
            "item": str(cement.id),
            "quantity": "10.000",
        },
        format="json",
    )
    assert created.status_code == status.HTTP_201_CREATED
    assert created.data["data"]["item_name"] == cement.item_name
    misc_id = created.data["data"]["id"]

    entry.refresh_from_db()
    assert entry.actual_quantity == Decimal("100.000")

    listed = api_client.get(
        _url("misc-usage-list"), {"period": str(period.id)}
    )
    assert len(listed.data["data"]) == 1

    edited = api_client.patch(
        _url("misc-usage-detail", id=misc_id),
        {"quantity": "6.000"},
        format="json",
    )
    assert edited.status_code == status.HTTP_200_OK
    entry.refresh_from_db()
    assert entry.actual_quantity == Decimal("104.000")

    deleted = api_client.delete(
        _url("misc-usage-detail", id=misc_id)
    )
    assert deleted.status_code == status.HTTP_200_OK
    entry.refresh_from_db()
    assert entry.actual_quantity == Decimal("110.000")


@pytest.mark.django_db
def test_the_entry_api_exposes_the_misc_quantity(
    api_client, store_ho, period, cement, category
):
    _produce(period, category, "200")
    _entry(period, cement)
    ReconciliationMiscUsage.objects.create(
        period=period, item=cement, quantity=Decimal("10")
    )
    api_client.force_authenticate(user=store_ho)

    response = api_client.get(
        _url("entries-list"), {"period": str(period.id)}
    )

    row = response.data["data"][0]
    assert row["miscellaneous_quantity"] == "10.000"
    assert row["actual_quantity"] == "100.000"


@pytest.mark.django_db
def test_a_duplicate_material_gets_a_friendly_message(
    api_client, store_ho, period, cement
):
    api_client.force_authenticate(user=store_ho)
    payload = {
        "period": str(period.id),
        "item": str(cement.id),
        "quantity": "1.000",
    }
    api_client.post(
        _url("misc-usage-list"), payload, format="json"
    )

    again = api_client.post(
        _url("misc-usage-list"), payload, format="json"
    )

    assert again.status_code == status.HTTP_400_BAD_REQUEST
    assert "edit it instead" in str(again.data).lower()


@pytest.mark.django_db
def test_a_direct_count_item_is_rejected_by_the_api(
    api_client, store_ho, period, steel
):
    api_client.force_authenticate(user=store_ho)

    response = api_client.post(
        _url("misc-usage-list"),
        {
            "period": str(period.id),
            "item": str(steel.id),
            "quantity": "1.000",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_the_material_and_month_cannot_be_changed_once_logged(
    api_client, store_ho, site, period, cement, category
):
    other_material = Item.objects.create(
        item_name="River Sand",
        reconciliation_type=ReconciliationType.NORM_BASED,
        uom="MT",
    )
    other_material.categories.add(category)
    misc = ReconciliationMiscUsage.objects.create(
        period=period, item=cement, quantity=Decimal("1")
    )
    api_client.force_authenticate(user=store_ho)

    response = api_client.patch(
        _url("misc-usage-detail", id=misc.id),
        {"item": str(other_material.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_replaying_a_queued_create_is_idempotent(
    api_client, store_ho, period, cement
):
    api_client.force_authenticate(user=store_ho)
    payload = {
        "id": str(uuid.uuid4()),
        "period": str(period.id),
        "item": str(cement.id),
        "quantity": "5.000",
    }

    first = api_client.post(
        _url("misc-usage-list"), payload, format="json"
    )
    replay = api_client.post(
        _url("misc-usage-list"), payload, format="json"
    )

    assert first.status_code == status.HTTP_201_CREATED
    assert replay.status_code == status.HTTP_200_OK
    assert ReconciliationMiscUsage.objects.count() == 1


@pytest.mark.django_db
def test_a_locked_period_cannot_be_changed(
    api_client, store_ho, period, cement
):
    misc = ReconciliationMiscUsage.objects.create(
        period=period, item=cement, quantity=Decimal("1")
    )
    period.status = ReconciliationPeriodStatus.APPROVED
    period.save(update_fields=["status"])
    api_client.force_authenticate(user=store_ho)

    edit = api_client.patch(
        _url("misc-usage-detail", id=misc.id),
        {"quantity": "2.000"},
        format="json",
    )
    remove = api_client.delete(
        _url("misc-usage-detail", id=misc.id)
    )

    assert edit.status_code == status.HTTP_400_BAD_REQUEST
    assert remove.status_code == status.HTTP_400_BAD_REQUEST
    misc.refresh_from_db()
    assert misc.quantity == Decimal("1.000")


@pytest.mark.django_db
def test_director_can_read_but_not_write(
    api_client, period, cement
):
    ReconciliationMiscUsage.objects.create(
        period=period, item=cement, quantity=Decimal("1")
    )
    director = DirectorUserFactory(employee_id="DIRECTOR777")
    api_client.force_authenticate(user=director)

    read = api_client.get(
        _url("misc-usage-list"), {"period": str(period.id)}
    )
    write = api_client.post(
        _url("misc-usage-list"),
        {
            "period": str(period.id),
            "item": str(cement.id),
            "quantity": "2.000",
        },
        format="json",
    )

    assert read.status_code == status.HTTP_200_OK
    assert write.status_code == status.HTTP_403_FORBIDDEN
