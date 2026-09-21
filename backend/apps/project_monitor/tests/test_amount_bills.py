"""
Amount-only RA bills: a lump sum received against the total project
value, tied to no item or quantity. It counts as billed AND received,
so the balance value drops and the payment shows up, without moving
the DPR window that item bills define.
"""

from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.authentication.tests.factories import AdminUserFactory
from apps.project_monitor.models import (
    DprEntry,
    DprEntrySource,
    RaBill,
    RaBillKind,
)
from apps.project_monitor.services import (
    billing,
    contract_finance,
)
from apps.project_monitor.tests.finance_helpers import (
    days_ago,
    make_item,
)


def add_entry(item, day, qty):
    return DprEntry.objects.create(
        item=item,
        date=day,
        qty=Decimal(qty),
        rate=item.rate,
        source=DprEntrySource.DETAILED,
    )


def amount_bill(site, amount="100000", day=None, number="RA-L1", **kwargs):
    return billing.create_bill(
        site=site,
        bill_no=number,
        bill_date=day or days_ago(1),
        kind=RaBillKind.AMOUNT,
        amount=Decimal(amount),
        **kwargs,
    )


# ---- the bill itself ---------------------------------------------------


@pytest.mark.django_db
def test_an_amount_bill_is_billed_and_received_on_its_date(site):
    bill = amount_bill(site, "100000", days_ago(4))

    assert billing.bill_gross(bill) == Decimal("100000")
    assert bill.received_amount == Decimal("100000")
    assert bill.received_on == days_ago(4)
    assert bill.lines.count() == 0
    assert billing.cumulative_billed(site) == Decimal("100000")


@pytest.mark.django_db
def test_the_received_amount_can_be_less_than_the_amount(site):
    bill = amount_bill(
        site,
        "100000",
        received_amount=Decimal("60000"),
        received_on=days_ago(1),
    )
    rows = billing.bill_rows(site)["bills"]

    assert bill.received_amount == Decimal("60000")
    assert rows[0]["outstanding"] == Decimal("40000")
    assert rows[0]["kind"] == "AMOUNT"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "kwargs",
    [
        {"amount": None},
        {"amount": Decimal("0")},
        {"amount": Decimal("-5")},
    ],
)
def test_an_amount_bill_needs_a_positive_amount(site, kwargs):
    with pytest.raises(ValidationError):
        billing.create_bill(
            site=site,
            bill_no="RA-L1",
            bill_date=days_ago(1),
            kind=RaBillKind.AMOUNT,
            **kwargs,
        )


@pytest.mark.django_db
def test_an_amount_bill_cannot_carry_item_quantities(site):
    item = make_item(site)
    with pytest.raises(ValidationError) as error:
        billing.create_bill(
            site=site,
            bill_no="RA-L1",
            bill_date=days_ago(1),
            kind=RaBillKind.AMOUNT,
            amount=Decimal("5000"),
            lines=[{"item": item, "qty": Decimal("3")}],
        )
    assert "not tied to items" in str(error.value)


@pytest.mark.django_db
def test_an_item_bill_still_needs_items_and_takes_no_amount(site):
    item = make_item(site)
    with pytest.raises(ValidationError):
        billing.create_bill(
            site=site, bill_no="A", bill_date=days_ago(1), lines=[]
        )
    with pytest.raises(ValidationError):
        billing.create_bill(
            site=site,
            bill_no="B",
            bill_date=days_ago(1),
            amount=Decimal("100"),
            lines=[{"item": item, "qty": Decimal("1")}],
        )


@pytest.mark.django_db
def test_the_database_refuses_an_inconsistent_bill(site):
    with pytest.raises(IntegrityError), transaction.atomic():
        RaBill.objects.create(
            site=site,
            bill_no="X",
            bill_date=days_ago(1),
            kind=RaBillKind.AMOUNT,
            amount=None,
        )


@pytest.mark.django_db
def test_bill_numbers_stay_unique_across_both_kinds(site):
    amount_bill(site, number="RA-1")
    with pytest.raises(ValidationError):
        amount_bill(site, number="RA-1")


@pytest.mark.django_db
def test_deleting_an_amount_bill_gives_the_balance_back(site):
    bill = amount_bill(site, "250000")
    assert (
        contract_finance.financial_summary(site)["balance_value"]
        == Decimal("750000")
    )
    bill.delete()
    assert (
        contract_finance.financial_summary(site)["balance_value"]
        == Decimal("1000000")
    )


# ---- the money figures ----------------------------------------------------


@pytest.mark.django_db
def test_an_amount_bill_reduces_the_balance_without_moving_the_dpr_window(
    site,
):
    item = make_item(site)  # rate 100
    add_entry(item, days_ago(8), "100")  # 10,000
    billing.create_bill(
        site=site,
        bill_no="RA-1",
        bill_date=days_ago(6),
        lines=[{"item": item, "qty": Decimal("100")}],
    )  # bills that 10,000
    add_entry(item, days_ago(3), "50")  # 5,000 executed after the bill

    before = contract_finance.financial_summary(site)
    assert before["work_done_to_last_bill"] == Decimal("10000")
    assert before["dpr_value_after_last_bill"] == Decimal("5000")
    assert before["balance_value"] == Decimal("985000")

    # A lump sum dated AFTER that DPR entry.
    amount_bill(site, "100000", days_ago(1))
    after = contract_finance.financial_summary(site)

    assert after["work_done_to_last_bill"] == Decimal("110000")
    # The DPR window still starts at the last ITEM bill, so the 5,000
    # executed since is not swallowed.
    assert after["last_bill_no"] == "RA-1"
    assert after["last_bill_date"] == days_ago(6)
    assert after["dpr_value_after_last_bill"] == Decimal("5000")
    assert after["work_done_total"] == Decimal("115000")
    assert after["balance_value"] == Decimal("885000")
    assert after["percent_done"] == Decimal("11.5")


@pytest.mark.django_db
def test_summary_reports_lump_sum_received_and_outstanding(site):
    item = make_item(site)
    add_entry(item, days_ago(8), "100")
    billing.create_bill(
        site=site,
        bill_no="RA-1",
        bill_date=days_ago(6),
        lines=[{"item": item, "qty": Decimal("100")}],
    )  # gross 10,000, nothing received yet
    amount_bill(site, "100000", days_ago(1))  # received in full

    summary = contract_finance.financial_summary(site)

    assert summary["lump_sum_billed"] == Decimal("100000")
    assert summary["received_total"] == Decimal("100000")
    assert summary["outstanding_total"] == Decimal("10000")


@pytest.mark.django_db
def test_a_project_with_only_amount_bills_still_has_money_figures(site):
    amount_bill(site, "400000")
    summary = contract_finance.financial_summary(site)

    assert summary["work_done_total"] == Decimal("400000")
    assert summary["balance_value"] == Decimal("600000")
    assert summary["percent_done"] == Decimal("40.0")


# ---- through the API ---------------------------------------------------------


@pytest.fixture
def api():
    return APIClient()


def url(name, *args):
    return reverse(f"project-monitor-api:{name}", args=args)


@pytest.mark.django_db
def test_amount_bill_through_the_api(api, site, assigned_pm):
    api.force_authenticate(user=assigned_pm)

    created = api.post(
        url("ra-bill-list"),
        {
            "site": str(site.id),
            "bill_no": "RA-L1",
            "bill_date": str(days_ago(2)),
            "kind": "AMOUNT",
            "amount": "150000",
            "remarks": "Mobilisation advance",
        },
        format="json",
    )
    assert created.status_code == status.HTTP_200_OK, created.data

    listing = api.get(url("ra-bill-list"), {"site": str(site.id)})
    bill = listing.data["data"]["bills"][0]
    assert bill["kind"] == "AMOUNT"
    assert bill["gross"] == Decimal("150000")
    assert bill["received_amount"] == Decimal("150000")
    assert bill["outstanding"] == Decimal("0")
    assert bill["lines"] == []

    summary = api.get(
        url("financial-summary"), {"site": str(site.id)}
    ).data["data"]
    assert summary["balance_value"] == Decimal("850000")
    assert summary["received_total"] == Decimal("150000")
    assert summary["lump_sum_billed"] == Decimal("150000")


@pytest.mark.django_db
def test_amount_bill_validation_through_the_api(api, site, assigned_pm):
    item = make_item(site)
    api.force_authenticate(user=assigned_pm)
    base = {
        "site": str(site.id),
        "bill_date": str(days_ago(1)),
    }

    no_amount = api.post(
        url("ra-bill-list"),
        {**base, "bill_no": "A", "kind": "AMOUNT"},
        format="json",
    )
    with_lines = api.post(
        url("ra-bill-list"),
        {
            **base,
            "bill_no": "B",
            "kind": "AMOUNT",
            "amount": "1000",
            "lines": [{"item": str(item.id), "qty": "2"}],
        },
        format="json",
    )
    item_bill_with_amount = api.post(
        url("ra-bill-list"),
        {
            **base,
            "bill_no": "C",
            "amount": "1000",
            "lines": [{"item": str(item.id), "qty": "2"}],
        },
        format="json",
    )
    default_kind_without_items = api.post(
        url("ra-bill-list"),
        {**base, "bill_no": "D"},
        format="json",
    )

    for response in (
        no_amount,
        with_lines,
        item_bill_with_amount,
        default_kind_without_items,
    ):
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert RaBill.objects.count() == 0


@pytest.mark.django_db
def test_the_received_amount_of_an_amount_bill_can_be_edited(
    api, site, assigned_pm
):
    bill = amount_bill(site, "100000")
    api.force_authenticate(user=assigned_pm)

    edited = api.patch(
        url("ra-bill-detail", bill.id),
        {
            "received_amount": "70000",
            "received_on": str(days_ago(1)),
        },
        format="json",
    )
    assert edited.status_code == status.HTTP_200_OK
    row = api.get(
        url("ra-bill-list"), {"site": str(site.id)}
    ).data["data"]["bills"][0]
    assert row["outstanding"] == Decimal("30000")


@pytest.mark.django_db
def test_dashboard_shows_money_for_a_project_with_only_amount_bills(site):
    amount_bill(site, "200000")
    admin = AdminUserFactory()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.get(
        url("dashboard"), {"include_empty": "1"}
    )
    project = next(
        p
        for p in response.data["data"]["projects"]
        if p["site"]["site_code"] == site.site_code
    )

    assert project["money"]["work_done_total"] == Decimal("200000")
    assert project["money"]["balance_value"] == Decimal("800000")
