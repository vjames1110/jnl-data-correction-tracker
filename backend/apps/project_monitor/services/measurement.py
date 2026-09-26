"""
The measurement sheet behind a day's DPR quantity.

Lines belong to one item on one day and are supporting detail: they are
checked against the quantity typed in the grid, never enforced. Saving
a sheet replaces that item-day's lines in one go, is locked with the
same edit window as the DPR itself, and only leaf items have one (a
group takes no quantity, so it has nothing to measure).
"""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import DprMeasurement
from apps.project_monitor.services import dpr

ZERO = Decimal("0.000")
MAX_LINES = 200
DIMENSIONS = ("nos", "length", "breadth", "depth")


def _clean_line(index, raw) -> dict:
    """One submitted line as model fields; blank dimensions stay None."""
    values = {}
    for name in DIMENSIONS:
        value = raw.get(name)
        if value in (None, ""):
            values[name] = None
            continue
        if value < 0:
            raise ValidationError(
                {
                    "lines": (
                        f"Line {index}: {name} cannot be "
                        "negative - tick Deduct for a deduction."
                    )
                }
            )
        values[name] = value
    if all(values[name] is None for name in DIMENSIONS):
        raise ValidationError(
            {
                "lines": (
                    f"Line {index}: give the Nos or at least "
                    "one of length, breadth or depth."
                )
            }
        )
    values["description"] = (raw.get("description") or "").strip()
    values["remarks"] = (raw.get("remarks") or "").strip()
    values["is_deduction"] = bool(raw.get("is_deduction"))
    return values


def line_total(lines) -> Decimal:
    return sum((line.quantity for line in lines), ZERO)


def sheet_rows(site, *, item=None, day=None, start=None, end=None):
    """
    ``[{item, date, total, lines}]`` for the site, newest day first,
    filtered by item and / or a day or date range.
    """
    rows = DprMeasurement.objects.filter(item__site=site)
    if item is not None:
        rows = rows.filter(item=item)
    if day is not None:
        rows = rows.filter(date=day)
    if start is not None:
        rows = rows.filter(date__gte=start)
    if end is not None:
        rows = rows.filter(date__lte=end)

    sheets = {}
    for line in rows.order_by("-date", "item_id", "row_order"):
        key = (line.item_id, line.date)
        sheet = sheets.setdefault(
            key,
            {"item": line.item_id, "date": line.date, "lines": []},
        )
        sheet["lines"].append(line)
    result = []
    for sheet in sheets.values():
        sheet["total"] = line_total(sheet["lines"])
        result.append(sheet)
    return result


def measured_map(site, start, end) -> dict:
    """``{(item id, date): signed total}`` for the grid window."""
    totals = {}
    for line in DprMeasurement.objects.filter(
        item__site=site, date__gte=start, date__lte=end
    ):
        key = (line.item_id, line.date)
        totals[key] = totals.get(key, ZERO) + line.quantity
    return totals


@transaction.atomic
def replace_sheet(
    *, site, item, day, lines, actor=None, today=None
) -> dict:
    """
    Replace the measurement lines of ``item`` on ``day``. An empty
    list clears the sheet. Returns the new sheet.
    """
    if item.site_id != site.id:
        raise ValidationError(
            {"item": "Item does not belong to this site."}
        )
    if item.is_heading:
        raise ValidationError(
            {
                "item": (
                    "This is a group - measurements are "
                    "recorded against the items under it."
                )
            }
        )
    if len(lines) > MAX_LINES:
        raise ValidationError(
            {"lines": f"At most {MAX_LINES} lines a day."}
        )
    today = today or timezone.localdate()
    dpr._require_editable(site, day, today)

    cleaned = [
        _clean_line(index, raw)
        for index, raw in enumerate(lines, start=1)
    ]
    DprMeasurement.objects.filter(item=item, date=day).delete()
    DprMeasurement.objects.bulk_create(
        [
            DprMeasurement(
                item=item,
                date=day,
                row_order=order,
                created_by=actor,
                updated_by=actor,
                **values,
            )
            for order, values in enumerate(cleaned)
        ]
    )
    sheets = sheet_rows(site, item=item, day=day)
    return (
        sheets[0]
        if sheets
        else {"item": item.id, "date": day, "lines": [], "total": ZERO}
    )
