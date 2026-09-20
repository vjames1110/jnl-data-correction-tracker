"""
Bulk Excel/CSV upload for HR: labour head-counts and staff day
overrides in one file.

Columns: ``Project | Date | Type (Labour/Staff) | Category or Staff
name | Nos | Rate | Amount | Agency | Note``.

- ``Project`` is the site *code* (not free text), so a row can never
  land on the wrong project by a spelling slip. When the upload is
  made from one site's page that site is the default for blank rows.
- ``Labour`` rows add a head-count (amount = nos x rate when blank).
- ``Staff`` rows set that person's cost for the day (amount 0 =
  absent); the person must already be in the site's staff register.
- Idempotent: re-uploading a file changes nothing.
- Only sites the uploader may enter HR data for are accepted.
"""

import io
from collections import Counter
from decimal import Decimal

import openpyxl
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.organization.models import Site
from apps.project_monitor.models import (
    LabourEntry,
    LabourEntrySource,
    StaffDayOverride,
    StaffMember,
)
from apps.project_monitor.services import hr, site_access
from apps.project_monitor.services.dpr_import import (
    _cell,
    _detect_columns,
    _find_header,
    _money,
    _record_error,
    _text,
    _to_date,
    _number,
    read_rows,
)

HR_PATTERNS = [
    ("project", r"project|site"),
    ("date", r"date"),
    ("type", r"type"),
    ("name", r"categ|staff|name"),
    ("nos", r"^nos|no\.?\s*of|number|count"),
    ("rate", r"rate"),
    ("amount", r"amount|cost"),
    ("agency", r"agency|contractor"),
    ("note", r"note|remark"),
]
TEMPLATE_HEADER = [
    "Project (site code)",
    "Date (YYYY-MM-DD)",
    "Type (Labour/Staff)",
    "Category or Staff name",
    "Nos",
    "Rate",
    "Amount",
    "Agency",
    "Note",
]


def _has_value(cell) -> bool:
    return bool(_text(cell))


@transaction.atomic
def import_hr(
    uploaded_file, user, default_site=None, today=None
) -> dict:
    today = today or timezone.localdate()
    rows = read_rows(uploaded_file)
    header_index, columns = _find_header(
        rows, HR_PATTERNS, ("date", "type", "name")
    )
    if header_index is None or (
        "project" not in columns and default_site is None
    ):
        raise ValidationError(
            {
                "file": (
                    "Could not find a header row with "
                    "Project, Date, Type and Category/Staff "
                    "name columns."
                )
            }
        )

    site_cache: dict = {}

    def resolve_site(code):
        key = code.lower()
        if key not in site_cache:
            site_cache[key] = Site.objects.filter(
                site_code__iexact=code
            ).first()
        return site_cache[key]

    labour_seen: dict = {}

    def labour_counter(site):
        if site.id not in labour_seen:
            labour_seen[site.id] = Counter(
                (
                    entry.date,
                    entry.category.lower(),
                    entry.nos,
                    entry.rate,
                    entry.amount,
                    entry.agency,
                    entry.remarks,
                )
                for entry in LabourEntry.objects.filter(
                    site=site, source=LabourEntrySource.EXCEL
                )
            )
        return labour_seen[site.id]

    staff_cache: dict = {}

    def staff_for(site):
        if site.id not in staff_cache:
            staff_cache[site.id] = list(
                StaffMember.objects.filter(site=site)
            )
        return staff_cache[site.id]

    result = {
        "labour_created": 0,
        "labour_duplicate": 0,
        "overrides_saved": 0,
        "overrides_unchanged": 0,
        "staff_not_found": 0,
        "site_not_found": 0,
        "not_permitted": 0,
        "invalid": 0,
        "errors": [],
    }
    errors = result["errors"]

    def reject(counter, number, message):
        result[counter] += 1
        _record_error(errors, number, message)

    for number, row in enumerate(
        rows[header_index + 1 :], start=header_index + 2
    ):
        if not any(_text(cell) for cell in row):
            continue

        code = _text(_cell(row, columns, "project"))
        if code:
            site = resolve_site(code)
            if site is None:
                reject(
                    "site_not_found",
                    number,
                    f'no site has the code "{code}".',
                )
                continue
        elif default_site is not None:
            site = default_site
        else:
            reject(
                "invalid", number, "the Project (site code) is blank."
            )
            continue

        if not site_access.can_enter_hr(user, site):
            reject(
                "not_permitted",
                number,
                f"you cannot enter HR data for {site.site_code}.",
            )
            continue

        day = _to_date(_cell(row, columns, "date"))
        if day is None or day > today:
            reject(
                "invalid",
                number,
                "needs a valid date that is not in the future.",
            )
            continue

        kind = _text(_cell(row, columns, "type")).lower()
        name = _text(_cell(row, columns, "name"))
        if not name:
            reject(
                "invalid",
                number,
                "the Category / Staff name is blank.",
            )
            continue

        amount_cell = _cell(row, columns, "amount")
        note = _text(_cell(row, columns, "note"))

        if kind.startswith("l"):
            nos = _number(_cell(row, columns, "nos")).quantize(
                Decimal("0.01")
            )
            if nos <= 0:
                reject(
                    "invalid",
                    number,
                    "labour rows need Nos above zero.",
                )
                continue
            rate = _money(_cell(row, columns, "rate"))
            amount = (
                _money(amount_cell)
                if _has_value(amount_cell)
                else _money(nos * rate)
            )
            agency = _text(_cell(row, columns, "agency"))
            key = (
                day,
                name.lower(),
                nos,
                rate,
                amount,
                agency,
                note,
            )
            counter = labour_counter(site)
            if counter[key] > 0:
                counter[key] -= 1
                result["labour_duplicate"] += 1
                continue
            hr.create_labour(
                site=site,
                day=day,
                category=name,
                nos=nos,
                rate=rate,
                amount=amount,
                agency=agency,
                remarks=note,
                actor=user,
                source=LabourEntrySource.EXCEL,
                today=today,
            )
            result["labour_created"] += 1

        elif kind.startswith("s"):
            if not _has_value(amount_cell):
                reject(
                    "invalid",
                    number,
                    "staff rows need the day's Amount "
                    "(0 for absent).",
                )
                continue
            amount = _money(amount_cell)
            member = next(
                (
                    person
                    for person in staff_for(site)
                    if person.name.lower() == name.lower()
                    and hr.is_on_payroll(person, day)
                ),
                None,
            )
            if member is None:
                reject(
                    "staff_not_found",
                    number,
                    f'"{name}" is not on this site\'s staff '
                    "register for that date.",
                )
                continue
            existing = StaffDayOverride.objects.filter(
                staff=member, date=day
            ).first()
            if existing and existing.amount == amount:
                result["overrides_unchanged"] += 1
                continue
            hr.set_override(
                staff=member,
                day=day,
                amount=amount,
                note=note,
                actor=user,
                today=today,
            )
            result["overrides_saved"] += 1

        else:
            reject(
                "invalid",
                number,
                'Type must be "Labour" or "Staff".',
            )

    return result


def build_template(site=None) -> bytes:
    code = site.site_code if site else "SITE01"
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "HR"
    sheet.append(TEMPLATE_HEADER)
    sheet.append(
        [
            code,
            timezone.localdate().isoformat(),
            "Labour",
            "Mason",
            12,
            900,
            None,
            "ABC Contractors",
            "",
        ]
    )
    sheet.append(
        [
            code,
            timezone.localdate().isoformat(),
            "Staff",
            "Site Engineer name",
            None,
            None,
            0,
            "",
            "Absent",
        ]
    )
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
