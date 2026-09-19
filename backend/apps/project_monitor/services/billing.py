"""
RA (running-account) bills. A bill's gross value is always computed
from its lines (quantity x the contract rate snapshotted on the
line); nothing here keeps a running total, so deleting or correcting
a bill can never leave a stale figure behind. Cumulative billed =
the site's ``opening_billed_value`` (billed before this system) plus
the gross of every recorded bill.
"""

from datetime import date
from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import (
    DprItem,
    RaBill,
    RaBillLine,
)
from apps.project_monitor.services import dpr

ZERO = Decimal("0")


def bill_gross(bill: RaBill) -> Decimal:
    return sum(
        (line.qty * line.rate for line in bill.lines.all()),
        ZERO,
    )


def bill_received(bill: RaBill) -> Decimal:
    return bill.received_amount or ZERO


def _validate_receipt(received_amount, received_on):
    if received_amount is not None and received_amount < 0:
        raise ValidationError(
            {
                "received_amount": (
                    "Amount received cannot be negative."
                )
            }
        )
    if received_amount and received_on is None:
        raise ValidationError(
            {
                "received_on": (
                    "Say when the amount was received."
                )
            }
        )


@transaction.atomic
def create_bill(
    *,
    site,
    bill_no,
    bill_date,
    lines,
    received_amount=None,
    received_on=None,
    remarks="",
    actor=None,
) -> RaBill:
    """
    ``lines`` is a list of ``{"item": DprItem, "qty": Decimal}``.
    Items with a zero quantity are ignored; at least one item with
    a quantity above zero is required.
    """
    bill_no = (bill_no or "").strip()
    if not bill_no:
        raise ValidationError(
            {"bill_no": "Bill number is required."}
        )
    if RaBill.objects.filter(
        site=site, bill_no=bill_no
    ).exists():
        raise ValidationError(
            {
                "bill_no": (
                    "A bill with this number already "
                    "exists for this site."
                )
            }
        )
    _validate_receipt(received_amount, received_on)

    billable = [
        line for line in lines if line["qty"] > 0
    ]
    if not billable:
        raise ValidationError(
            {
                "lines": (
                    "Add a quantity against at least one "
                    "item."
                )
            }
        )
    seen = set()
    for line in billable:
        item: DprItem = line["item"]
        if item.site_id != site.id:
            raise ValidationError(
                {
                    "lines": (
                        "An item does not belong to this "
                        "site."
                    )
                }
            )
        if item.id in seen:
            raise ValidationError(
                {"lines": "An item appears twice."}
            )
        seen.add(item.id)

    bill = RaBill.objects.create(
        site=site,
        bill_no=bill_no,
        bill_date=bill_date,
        received_amount=received_amount,
        received_on=received_on,
        remarks=remarks,
        created_by=actor,
        updated_by=actor,
    )
    RaBillLine.objects.bulk_create(
        [
            RaBillLine(
                bill=bill,
                item=line["item"],
                qty=line["qty"],
                rate=line["item"].rate,
            )
            for line in billable
        ]
    )
    return bill


def update_receipt(
    bill: RaBill,
    *,
    received_amount,
    received_on,
    remarks=None,
    actor=None,
) -> RaBill:
    _validate_receipt(received_amount, received_on)
    bill.received_amount = received_amount
    bill.received_on = received_on
    if remarks is not None:
        bill.remarks = remarks
    bill.updated_by = actor
    bill.save()
    return bill


def _bills(site):
    return RaBill.objects.filter(site=site).prefetch_related(
        "lines"
    )


def cumulative_billed(site) -> Decimal:
    return site.opening_billed_value + sum(
        (bill_gross(bill) for bill in _bills(site)),
        ZERO,
    )


def last_bill(site):
    """
    ``(bill_no, bill_date)`` of the latest recorded bill, else the
    site's opening (pre-system) bill figures, else ``("", None)``.
    """
    latest = (
        RaBill.objects.filter(site=site)
        .order_by("-bill_date", "-created_at")
        .first()
    )
    if latest is not None:
        return latest.bill_no, latest.bill_date
    return site.opening_bill_no, site.opening_bill_date


def bill_rows(site) -> dict:
    rows = []
    total_gross = ZERO
    total_received = ZERO
    for bill in _bills(site):
        gross = bill_gross(bill)
        received = bill_received(bill)
        total_gross += gross
        total_received += received
        rows.append(
            {
                "id": bill.id,
                "bill_no": bill.bill_no,
                "bill_date": bill.bill_date,
                "gross": gross,
                "received_amount": bill.received_amount,
                "received_on": bill.received_on,
                "outstanding": gross - received,
                "remarks": bill.remarks,
                "lines": [
                    {
                        "item": line.item_id,
                        "item_no": line.item.item_no,
                        "description": line.item.description,
                        "unit": line.item.unit,
                        "qty": line.qty,
                        "rate": line.rate,
                        "value": line.qty * line.rate,
                    }
                    for line in bill.lines.select_related(
                        "item"
                    )
                ],
            }
        )
    return {
        "bills": rows,
        "totals": {
            "gross": total_gross,
            "received": total_received,
            "outstanding": total_gross - total_received,
        },
        "opening": {
            "billed_value": site.opening_billed_value,
            "bill_no": site.opening_bill_no,
            "bill_date": site.opening_bill_date,
        },
    }


def unbilled_value(site, upto: date | None = None) -> Decimal:
    """Executed-but-not-yet-billed value at contract rates."""
    executed = dpr.executed_totals(site, upto)
    billed = dpr.billed_qty_map(site, upto)
    total = ZERO
    items = {
        item.id: item
        for item in DprItem.objects.filter(site=site)
    }
    for item_id, (qty, _value) in executed.items():
        item = items.get(item_id)
        if item is None:
            continue
        total += (qty - billed.get(item_id, ZERO)) * item.rate
    return total
