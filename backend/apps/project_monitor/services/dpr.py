"""
The daily progress report (DPR): quantities executed per contract
item per day, valued at the contract rate snapshotted on each entry.

Date-lock rule: a day is editable when it is not in the future and is
today or one of the previous ``DPR_EDIT_WINDOW_DAYS`` days - or an
Admin has logged a ``DprDayUnlock`` for that site and day. "Today" is
``timezone.localdate()`` (Asia/Kolkata), not UTC.
"""

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import (
    DecimalField,
    ExpressionWrapper,
    F,
    Max,
    Sum,
)
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import (
    DprDayUnlock,
    DprEntry,
    DprEntrySource,
    DprItem,
    RaBillLine,
)

DPR_EDIT_WINDOW_DAYS = 3
MAJOR_ITEM_PERCENT = Decimal("2")
ZERO = Decimal("0")

_VALUE = ExpressionWrapper(
    F("qty") * F("rate"),
    output_field=DecimalField(
        max_digits=24, decimal_places=5
    ),
)


def contract_value(site) -> Decimal:
    """Value as per the latest variation, else the awarded value."""
    return site.varied_value or site.project_value or ZERO


def is_day_editable(
    site, day, *, today=None, unlocked=None
) -> bool:
    today = today or timezone.localdate()
    if day > today:
        return False
    if (today - day).days <= DPR_EDIT_WINDOW_DAYS:
        return True
    if unlocked is not None:
        return day in unlocked
    return DprDayUnlock.objects.filter(
        site=site, date=day
    ).exists()


def unlocked_dates(site, start, end) -> set:
    return set(
        DprDayUnlock.objects.filter(
            site=site, date__gte=start, date__lte=end
        ).values_list("date", flat=True)
    )


def _entries(site):
    return DprEntry.objects.filter(item__site=site)


def dpr_value_on(site, day) -> Decimal:
    return (
        _entries(site)
        .filter(date=day)
        .aggregate(total=Sum(_VALUE))["total"]
        or ZERO
    )


def dpr_value_between(
    site, after_exclusive, upto_inclusive
) -> Decimal:
    """Value of entries with ``after < date <= upto``."""
    return (
        _entries(site)
        .filter(
            date__gt=after_exclusive,
            date__lte=upto_inclusive,
        )
        .aggregate(total=Sum(_VALUE))["total"]
        or ZERO
    )


def executed_totals(site, upto=None) -> dict:
    """``{item_id: (qty, value)}`` executed up to ``upto``."""
    queryset = _entries(site)
    if upto is not None:
        queryset = queryset.filter(date__lte=upto)
    return {
        row["item_id"]: (row["sum_qty"], row["sum_value"])
        for row in queryset.values("item_id").annotate(
            sum_qty=Sum("qty"), sum_value=Sum(_VALUE)
        )
    }


def billed_qty_map(site, upto=None) -> dict:
    queryset = RaBillLine.objects.filter(bill__site=site)
    if upto is not None:
        queryset = queryset.filter(bill__bill_date__lte=upto)
    return {
        row["item_id"]: row["sum_qty"]
        for row in queryset.values("item_id").annotate(
            sum_qty=Sum("qty")
        )
    }


def day_qty_map(site, start, end) -> dict:
    """``{(item_id, date): qty}`` for the visible grid window."""
    rows = (
        _entries(site)
        .filter(date__gte=start, date__lte=end)
        .values("item_id", "date")
        .annotate(sum_qty=Sum("qty"))
    )
    return {
        (row["item_id"], row["date"]): row["sum_qty"]
        for row in rows
    }


def day_value_map(site, start, end) -> dict:
    rows = (
        _entries(site)
        .filter(date__gte=start, date__lte=end)
        .values("date")
        .annotate(sum_value=Sum(_VALUE))
    )
    return {row["date"]: row["sum_value"] for row in rows}


def build_item_rows(site) -> list[dict]:
    """
    Every DPR item with the figures the grid shows: amount, share of
    the contract value (``is_major`` = 2% or more; display only), and
    executed/billed/balance quantities.
    """
    contract = contract_value(site)
    executed = executed_totals(site)
    billed = billed_qty_map(site)

    rows = []
    for item in DprItem.objects.filter(site=site):
        exec_qty, exec_value = executed.get(
            item.id, (ZERO, ZERO)
        )
        amount = item.amount
        percent = (
            amount / contract * 100
            if contract
            else None
        )
        billed_qty = billed.get(item.id, ZERO)
        rows.append(
            {
                "id": item.id,
                "item_no": item.item_no,
                "description": item.description,
                "unit": item.unit,
                "scope_qty": item.scope_qty,
                "rate": item.rate,
                "amount": amount,
                "percent_of_contract": (
                    round(percent, 2)
                    if percent is not None
                    else None
                ),
                "is_major": (
                    percent is not None
                    and percent >= MAJOR_ITEM_PERCENT
                ),
                "concrete_per_unit": item.concrete_per_unit,
                "tmt_kg_per_unit": item.tmt_kg_per_unit,
                "is_active": item.is_active,
                "executed_qty": exec_qty,
                "executed_value": exec_value,
                "billed_qty": billed_qty,
                "balance_qty": item.scope_qty - exec_qty,
            }
        )
    return rows


def create_item(
    *,
    site,
    description,
    item_no="",
    unit="",
    scope_qty=ZERO,
    rate=ZERO,
    concrete_per_unit=ZERO,
    tmt_kg_per_unit=ZERO,
    actor=None,
) -> DprItem:
    next_order = (
        DprItem.objects.filter(site=site).aggregate(
            top=Max("row_order")
        )["top"]
        or 0
    ) + 1
    return DprItem.objects.create(
        site=site,
        description=description,
        item_no=item_no,
        unit=unit,
        scope_qty=scope_qty,
        rate=rate,
        concrete_per_unit=concrete_per_unit,
        tmt_kg_per_unit=tmt_kg_per_unit,
        row_order=next_order,
        created_by=actor,
        updated_by=actor,
    )


def delete_item(item: DprItem) -> None:
    if (
        item.entries.exists()
        or item.bill_lines.exists()
    ):
        raise ValidationError(
            {
                "detail": (
                    "This item has DPR entries or bill "
                    "lines, so it cannot be deleted. "
                    "Deactivate it instead."
                )
            }
        )
    item.delete()


def _require_editable(site, day, today):
    if not is_day_editable(site, day, today=today):
        raise ValidationError(
            {
                "date": (
                    f"{day:%d-%m-%Y} is locked. Only today "
                    f"and the previous {DPR_EDIT_WINDOW_DAYS} "
                    "days can be edited unless an Admin "
                    "unlocks the day."
                )
            }
        )


def add_detailed_entry(
    *,
    site,
    item,
    day,
    qty,
    location="",
    agency="",
    remarks="",
    source=DprEntrySource.DETAILED,
    actor=None,
    today=None,
) -> DprEntry:
    if item.site_id != site.id:
        raise ValidationError(
            {"item": "Item does not belong to this site."}
        )
    if qty is None or qty <= 0:
        raise ValidationError(
            {"qty": "Quantity must be greater than zero."}
        )
    _require_editable(site, day, today)

    return DprEntry.objects.create(
        item=item,
        date=day,
        qty=qty,
        rate=item.rate,
        location=location,
        agency=agency,
        remarks=remarks,
        source=source,
        created_by=actor,
        updated_by=actor,
    )


def delete_entry(entry: DprEntry, *, today=None) -> None:
    _require_editable(entry.item.site, entry.date, today)
    entry.delete()


@transaction.atomic
def save_grid(
    *, site, edits, actor=None, today=None
) -> dict:
    """
    Apply daily-grid quantities. ``edits`` is a list of
    ``{"item": DprItem, "date": date, "qty": Decimal}`` where ``qty``
    is the day's TOTAL for that item. Only grid-typed
    (``MANUAL_GRID``) entries are replaced: detailed/Excel entries
    (which carry a location/agency/remark) are kept, and the grid
    quantity fills the remainder above them. Typing less than the
    detailed total leaves the detailed entries in place and is
    reported in ``below_detailed``.
    """
    today = today or timezone.localdate()
    unlocked = None
    if edits:
        dates = [edit["date"] for edit in edits]
        unlocked = unlocked_dates(
            site, min(dates), max(dates)
        )

    saved = 0
    skipped_locked = []
    below_detailed = []

    for edit in edits:
        item, day, qty = (
            edit["item"],
            edit["date"],
            edit["qty"],
        )
        if item.site_id != site.id:
            raise ValidationError(
                {
                    "item": (
                        "Item does not belong to this site."
                    )
                }
            )
        if qty < 0:
            raise ValidationError(
                {"qty": "Quantity cannot be negative."}
            )
        if not is_day_editable(
            site, day, today=today, unlocked=unlocked
        ):
            skipped_locked.append(
                {"item": str(item.id), "date": day}
            )
            continue

        existing = DprEntry.objects.filter(
            item=item, date=day
        )
        kept = (
            existing.exclude(
                source=DprEntrySource.MANUAL_GRID
            ).aggregate(total=Sum("qty"))["total"]
            or ZERO
        )
        existing.filter(
            source=DprEntrySource.MANUAL_GRID
        ).delete()

        rest = qty - kept
        if rest > 0:
            DprEntry.objects.create(
                item=item,
                date=day,
                qty=rest,
                rate=item.rate,
                source=DprEntrySource.MANUAL_GRID,
                created_by=actor,
                updated_by=actor,
            )
        elif qty < kept:
            below_detailed.append(
                {
                    "item": str(item.id),
                    "date": day,
                    "detailed_total": kept,
                }
            )
        saved += 1

    return {
        "saved": saved,
        "skipped_locked": skipped_locked,
        "below_detailed": below_detailed,
    }


def grid_window(to_date, days=31):
    """``[start, end]`` for a grid ending on ``to_date``."""
    return to_date - timedelta(days=days - 1), to_date


def seven_day_average(site, today) -> Decimal:
    """Average daily value over the seven days before ``today``."""
    total = ZERO
    for offset in range(1, 8):
        total += dpr_value_on(
            site, today - timedelta(days=offset)
        )
    return total / 7


def unlock_day(*, site, day, reason, actor) -> DprDayUnlock:
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError(
            {"reason": "A reason is required."}
        )
    if day > timezone.localdate():
        raise ValidationError(
            {"date": "Future days cannot be unlocked."}
        )
    unlock, _ = DprDayUnlock.objects.update_or_create(
        site=site,
        date=day,
        defaults={
            "reason": reason,
            "created_by": actor,
            "updated_by": actor,
        },
    )
    return unlock

