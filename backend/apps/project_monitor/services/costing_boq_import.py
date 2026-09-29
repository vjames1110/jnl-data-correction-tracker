"""
Excel/CSV bulk import for the costing-native BOQ (see
``services.costing_boq``). Reuses the file-reading and cell-parsing
helpers already proven on the DPR & Bills BOQ import
(``services.dpr_import``) rather than duplicating them - only the
column set and the row-to-item mapping are specific to this sheet.

Idempotent: a row matching an existing item (same item no, else same
description) is skipped, not duplicated, on re-upload.
"""

import io
from decimal import Decimal

import openpyxl
from django.core.exceptions import (
    ValidationError as DjangoValidationError,
)
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import CostingBoqItem
from apps.project_monitor.services import costing_boq
from apps.project_monitor.services.dpr_import import (
    _cell,
    _find_header,
    _item_key,
    _money,
    _number,
    _parent_keys,
    _percent,
    _qty,
    _record_error,
    _text,
    read_rows,
)

ZERO = Decimal("0")

_NOT_AMOUNT = r"(?!.*(amount|value|total|incl))"
BOQ_PATTERNS = [
    (
        "authority",
        rf"^{_NOT_AMOUNT}(?=.*rate)"
        r".*(authority|estimat|schedule|sor\b|railway|"
        r"tender\s*basic|departmental)",
    ),
    ("cost", r"actual|our\s*cost|costing\s*at\s*site"),
    ("gst", r"gst"),
    ("percent", r"%|percent|(above|below)\b|premium|awarded"),
    ("desc", r"desc|particular|item of work|name of work"),
    ("unit", r"^unit|uom"),
    ("qty", r"qty|quantity|tender\s*qty"),
    ("rate", rf"^{_NOT_AMOUNT}.*rate"),
    ("no", r"^(item|s\.?\s*no|sl|sr|item\s*no)"),
]


def _find_parent(by_no, key):
    """The nearest existing row above ``key`` a new row can nest
    under - any row will do here (there is no group/leaf split on this
    tree), as long as there is depth left for one more level."""
    for parent_key in _parent_keys(key):
        candidate = by_no.get(parent_key)
        if (
            candidate is not None
            and candidate.level() < CostingBoqItem.MAX_LEVEL
        ):
            return candidate
    return None


@transaction.atomic
def import_items(site, uploaded_file, actor=None) -> dict:
    """
    Import a BOQ: Item no, Description, Unit, Qty, and any of
    Authority rate, Tender/Awarded % (+/-), Quoted/Bid rate, Our cost
    (Actual costing at site) and GST %. Rows nest by item number
    (1 -> 1.1 -> 1.1.1), the same convention as the DPR & Bills BOQ
    import.
    """
    rows = read_rows(uploaded_file)
    header_index, columns = _find_header(
        rows, BOQ_PATTERNS, ("desc",)
    )
    if header_index is None:
        raise ValidationError(
            {
                "file": (
                    "Could not find a header row with a "
                    "Description column."
                )
            }
        )

    body = [
        (offset, row)
        for offset, row in enumerate(
            rows[header_index + 1 :], start=header_index + 2
        )
        if any(_text(cell) for cell in row)
    ]

    existing = list(CostingBoqItem.objects.filter(site=site))
    by_no = {
        _item_key(item.item_no): item
        for item in existing
        if item.item_no
    }
    by_desc = {
        item.description.lower(): item for item in existing
    }

    created = 0
    skipped_existing = 0
    skipped_invalid = 0
    errors = []
    for offset, row in body:
        description = _text(_cell(row, columns, "desc"))
        if not description:
            skipped_invalid += 1
            _record_error(errors, offset, "needs a description.")
            continue

        item_no = _text(_cell(row, columns, "no"))
        key = _item_key(item_no)
        if (item_no and key in by_no) or (
            not item_no and description.lower() in by_desc
        ):
            skipped_existing += 1
            continue

        qty = _qty(_cell(row, columns, "qty")) or None
        rate = _money(_cell(row, columns, "rate")) or None
        authority = _money(_cell(row, columns, "authority")) or None
        our_cost = _money(_cell(row, columns, "cost")) or None
        gst = _number(_cell(row, columns, "gst")) or None
        percent = _percent(_cell(row, columns, "percent"))

        try:
            item = costing_boq.create_item(
                site=site,
                description=description,
                item_no=item_no,
                unit=_text(_cell(row, columns, "unit")),
                qty=qty,
                authority_rate=authority,
                tender_percent=percent,
                rate=rate,
                our_cost_rate=our_cost,
                gst_percent=gst,
                parent=(
                    _find_parent(by_no, key) if key else None
                ),
                actor=actor,
            )
        except (DjangoValidationError, ValidationError) as exc:
            skipped_invalid += 1
            detail = (
                "; ".join(exc.messages)
                if hasattr(exc, "messages")
                else str(exc.detail)
            )
            _record_error(errors, offset, detail)
            continue

        if item_no:
            by_no[key] = item
        by_desc[item.description.lower()] = item
        created += 1

    return {
        "created": created,
        "skipped_existing": skipped_existing,
        "skipped_invalid": skipped_invalid,
        "errors": errors,
    }


def build_template() -> bytes:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Costing BOQ"
    sheet.append(
        [
            "Item no",
            "Description",
            "Unit",
            "Qty",
            "Authority rate",
            "Tender/Awarded % (+ above / - below)",
            "Quoted/Bid rate",
            "Our cost (Actual costing at site)",
            "GST %",
        ]
    )
    sheet.append(
        [
            "1",
            "RCC retaining wall",
            "cum",
            100,
            10000,
            -10,
            None,
            None,
            18,
        ]
    )
    sheet.append(
        [
            "1.1",
            "Supply of cement",
            "bag",
            640,
            None,
            None,
            380,
            360,
            None,
        ]
    )
    sheet.append(
        [
            "1.2",
            "Supply of sand",
            "cum",
            48,
            None,
            None,
            1500,
            1450,
            None,
        ]
    )
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
