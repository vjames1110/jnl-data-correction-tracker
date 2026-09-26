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
from apps.project_monitor.services import boq

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


def build_item_rows(site, today=None) -> list[dict]:
    """
    Every DPR item, in tree order, with the figures the grid shows:
    amount, share of the contract value (``is_major`` = 2% or more;
    display only), executed/billed/balance quantities and the BOQ
    columns (authority rate, tender %, bid rate, escalation and the
    rate new entries use today). A group (heading) row carries the
    roll-up of the items under it.
    """
    today = today or timezone.localdate()
    contract = contract_value(site)
    executed = executed_totals(site)
    billed = billed_qty_map(site)
    series = boq.escalation_series(site)
    escalation_today = boq.escalation_percent(series, today)

    items = boq.tree_order(list(DprItem.objects.filter(site=site)))
    level_of = boq.levels(items)
    children_of: dict = {}
    for item in items:
        children_of.setdefault(item.parent_id, []).append(item.id)

    rows = []
    by_id = {}
    for item in items:
        exec_qty, exec_value = (
            (ZERO, ZERO)
            if item.is_heading
            else executed.get(item.id, (ZERO, ZERO))
        )
        amount = item.amount
        contract_pct = site.tender_percent
        applied_pct = (
            (
                item.tender_percent
                if item.tender_percent is not None
                else contract_pct
            )
            if item.authority_rate is not None
            else None
        )
        row = {
            "id": item.id,
            "parent_id": item.parent_id,
            "level": level_of[item.id],
            "is_heading": item.is_heading,
            "has_children": item.id in children_of,
            "item_no": item.item_no,
            "description": item.description,
            "unit": item.unit,
            "scope_qty": item.scope_qty,
            "rate": item.rate,
            "bid_rate": item.rate,
            "authority_rate": item.authority_rate,
            "authority_amount": (
                item.scope_qty * item.authority_rate
                if item.authority_rate is not None
                else None
            ),
            "tender_percent": item.tender_percent,
            "applied_tender_percent": applied_pct,
            "escalation_percent": escalation_today,
            "effective_rate": (
                boq.effective_rate(item, today, series)
                if not item.is_heading
                else ZERO
            ),
            "amount": amount,
            "concrete_per_unit": item.concrete_per_unit,
            "tmt_kg_per_unit": item.tmt_kg_per_unit,
            "is_active": item.is_active,
            "executed_qty": exec_qty,
            "executed_value": exec_value,
            "billed_qty": (
                ZERO
                if item.is_heading
                else billed.get(item.id, ZERO)
            ),
            "balance_qty": (
                ZERO
                if item.is_heading
                else item.scope_qty - exec_qty
            ),
        }
        by_id[item.id] = row
        rows.append(row)

    def roll_up(item_id):
        row = by_id[item_id]
        if not row["is_heading"]:
            return row["amount"], row["executed_value"]
        amount = executed_value = ZERO
        for child_id in children_of.get(item_id, []):
            child_amount, child_value = roll_up(child_id)
            amount += child_amount
            executed_value += child_value
        row["amount"] = amount
        row["executed_value"] = executed_value
        return amount, executed_value

    for row in rows:
        if row["parent_id"] is None:
            roll_up(row["id"])

    for row in rows:
        percent = (
            row["amount"] / contract * 100 if contract else None
        )
        row["percent_of_contract"] = (
            round(percent, 2) if percent is not None else None
        )
        row["is_major"] = (
            not row["is_heading"]
            and percent is not None
            and percent >= MAJOR_ITEM_PERCENT
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
    parent=None,
    is_heading=False,
    authority_rate=None,
    tender_percent=None,
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
        parent=parent,
        is_heading=is_heading,
        authority_rate=authority_rate,
        tender_percent=tender_percent,
        row_order=next_order,
        created_by=actor,
        updated_by=actor,
    )


@transaction.atomic
def create_item_with_children(
    *, site, children=(), actor=None, **fields
) -> DprItem:
    """
    Create an item and, for a group (heading), its sub-items in one
    go. All or nothing: a bad sub-item rolls the group back too.
    """
    if children and not fields.get("is_heading"):
        raise ValidationError(
            {
                "children": (
                    "Sub-items can only be added to a group - "
                    "mark this row as a group first."
                )
            }
        )
    item = create_item(site=site, actor=actor, **fields)
    for child in children:
        create_item(
            site=site, parent=item, actor=actor, **child
        )
    return item


def delete_item(item: DprItem) -> None:
    if item.children.exists():
        raise ValidationError(
            {
                "detail": (
                    "This group has items under it. Delete or "
                    "move them first."
                )
            }
        )
    if (
        item.entries.exists()
        or item.bill_lines.exists()
        or item.measurements.exists()
    ):
        raise ValidationError(
            {
                "detail": (
                    "This item has DPR entries, measurements "
                    "or bill lines, so it cannot be deleted. "
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
    if item.is_heading:
        raise ValidationError(
            {
                "item": (
                    "This is a group - enter quantities against "
                    "the items under it."
                )
            }
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
        rate=boq.effective_rate(item, day),
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
    series = boq.escalation_series(site)
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
        if item.is_heading:
            raise ValidationError(
                {
                    "item": (
                        "This is a group - enter quantities "
                        "against the items under it."
                    )
                }
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
                rate=boq.effective_rate(item, day, series),
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

