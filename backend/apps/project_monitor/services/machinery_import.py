"""
Bulk Excel/CSV upload for machinery: usage, hire, fuel, maintenance.

Columns: ``Project | Date | Machine | Source | Days-hrs | Hire cost |
Fuel litres | Fuel cost | Maintenance | Other | Remarks``.

- ``Project`` is the site *code*; blank rows use the default site when
  the upload is made from one site's page.
- Each row is linked to a registered machine (matched by name). A
  name nobody registered creates the machine, flagged "needs review"
  until its rate and hire basis are filled in - usage is never left
  attached to a bare name.
- ``Hire cost`` blank = worked out from the machine's rate; a row's
  usage for a machine and day replaces that day (so re-uploading a
  file changes nothing); fuel rows are skipped when already recorded.
- Fuel litres need a Fuel cost.
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
    FuelEntry,
    Machine,
    MachineSource,
    MachineUsage,
    MachineUsageSource,
)
from apps.project_monitor.services import (
    machinery,
    site_access,
)
from apps.project_monitor.services.dpr_import import (
    _cell,
    _find_header,
    _money,
    _number,
    _record_error,
    _text,
    _to_date,
    read_rows,
)

# Order matters: a header takes the first key whose pattern matches
# it, so the fuel and hire columns must claim "cost" before anything
# more general does.
MACHINERY_PATTERNS = [
    ("project", r"project|site"),
    ("date", r"date"),
    ("machine", r"machine|equipment|vehicle"),
    ("fuel_l", r"fuel.*(litre|ltr|qty)|litre|ltr"),
    ("fuel_c", r"fuel"),
    ("hire", r"hire|rent"),
    ("source", r"source|ownership"),
    ("qty", r"days|hrs|hours|qty|units"),
    ("maint", r"maint"),
    ("other", r"other"),
    ("remark", r"remark|note"),
]
TEMPLATE_HEADER = [
    "Project (site code)",
    "Date (YYYY-MM-DD)",
    "Machine",
    "Source (Market/HO)",
    "Days-hrs",
    "Hire cost",
    "Fuel litres",
    "Fuel cost",
    "Maintenance",
    "Other",
    "Remarks",
]


def _has_value(cell) -> bool:
    return bool(_text(cell))


def _parse_source(cell):
    text = _text(cell).lower()
    if not text:
        return None
    if text.startswith("h") or text.startswith("in"):
        return MachineSource.HO
    return MachineSource.MARKET


@transaction.atomic
def import_machinery(
    uploaded_file, user, default_site=None, today=None
) -> dict:
    today = today or timezone.localdate()
    rows = read_rows(uploaded_file)
    header_index, columns = _find_header(
        rows, MACHINERY_PATTERNS, ("date", "machine")
    )
    if header_index is None or (
        "project" not in columns and default_site is None
    ):
        raise ValidationError(
            {
                "file": (
                    "Could not find a header row with "
                    "Project, Date and Machine columns."
                )
            }
        )

    site_cache: dict = {}
    machine_cache: dict = {}
    fuel_seen: dict = {}

    def resolve_site(code):
        key = code.lower()
        if key not in site_cache:
            site_cache[key] = Site.objects.filter(
                site_code__iexact=code
            ).first()
        return site_cache[key]

    def machines_of(site):
        if site.id not in machine_cache:
            machine_cache[site.id] = {}
            for machine in Machine.objects.filter(site=site):
                machine_cache[site.id].setdefault(
                    machine.name.lower(), machine
                )
        return machine_cache[site.id]

    def fuel_counter(site):
        if site.id not in fuel_seen:
            fuel_seen[site.id] = Counter(
                (
                    entry.machine_id,
                    entry.date,
                    entry.litres,
                    entry.amount,
                )
                for entry in FuelEntry.objects.filter(
                    site=site, source=MachineUsageSource.EXCEL
                )
            )
        return fuel_seen[site.id]

    result = {
        "usage_created": 0,
        "usage_updated": 0,
        "usage_unchanged": 0,
        "fuel_created": 0,
        "fuel_duplicate": 0,
        "machines_created": 0,
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
                "invalid",
                number,
                "the Project (site code) is blank.",
            )
            continue

        if not site_access.can_enter_machinery(user, site):
            reject(
                "not_permitted",
                number,
                "you cannot enter machinery data for "
                f"{site.site_code}.",
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

        name = _text(_cell(row, columns, "machine"))
        if not name:
            reject("invalid", number, "the Machine is blank.")
            continue

        qty = _number(_cell(row, columns, "qty")).quantize(
            Decimal("0.01")
        )
        hire_cell = _cell(row, columns, "hire")
        hire = (
            _money(hire_cell) if _has_value(hire_cell) else None
        )
        maintenance = _money(_cell(row, columns, "maint"))
        other = _money(_cell(row, columns, "other"))
        litres = _number(_cell(row, columns, "fuel_l")).quantize(
            Decimal("0.01")
        )
        fuel_cost_cell = _cell(row, columns, "fuel_c")
        remarks = _text(_cell(row, columns, "remark"))

        has_usage = bool(
            qty or (hire or 0) or maintenance or other
        )
        has_fuel = litres > 0
        if not (has_usage or has_fuel):
            reject(
                "invalid",
                number,
                "nothing to record - give days/hours, a cost or "
                "fuel.",
            )
            continue
        if has_fuel and not _has_value(fuel_cost_cell):
            reject(
                "invalid",
                number,
                "fuel litres need a Fuel cost.",
            )
            continue

        known = machines_of(site)
        machine = known.get(name.lower())
        if machine is None:
            machine = Machine.objects.create(
                site=site,
                name=name,
                source=_parse_source(
                    _cell(row, columns, "source")
                )
                or MachineSource.MARKET,
                needs_review=True,
                created_by=user,
                updated_by=user,
            )
            known[name.lower()] = machine
            result["machines_created"] += 1
        elif not machine.is_active:
            reject(
                "invalid",
                number,
                f'machine "{name}" is not active.',
            )
            continue

        if has_usage:
            expected_hire = (
                hire
                if hire is not None
                else machinery.hire_for(machine, qty)
            )
            existing = MachineUsage.objects.filter(
                machine=machine, date=day
            ).first()
            if (
                existing
                and existing.qty == qty
                and existing.hire_amount == expected_hire
                and existing.maintenance == maintenance
                and existing.other == other
                and existing.remarks == remarks
            ):
                result["usage_unchanged"] += 1
            else:
                _, created = machinery.save_usage(
                    machine=machine,
                    day=day,
                    qty=qty,
                    hire_amount=expected_hire,
                    maintenance=maintenance,
                    other=other,
                    remarks=remarks,
                    actor=user,
                    source=MachineUsageSource.EXCEL,
                    today=today,
                )
                result[
                    "usage_created" if created else "usage_updated"
                ] += 1

        if has_fuel:
            amount = _money(fuel_cost_cell)
            key = (machine.id, day, litres, amount)
            counter = fuel_counter(site)
            if counter[key] > 0:
                counter[key] -= 1
                result["fuel_duplicate"] += 1
            else:
                machinery.add_fuel(
                    site=site,
                    machine=machine,
                    day=day,
                    litres=litres,
                    amount=amount,
                    actor=user,
                    source=MachineUsageSource.EXCEL,
                    today=today,
                )
                result["fuel_created"] += 1

    return result


def build_template(site=None) -> bytes:
    code = site.site_code if site else "SITE01"
    day = timezone.localdate().isoformat()
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Machinery"
    sheet.append(TEMPLATE_HEADER)
    sheet.append(
        [
            code,
            day,
            "JCB 3DX",
            "Market",
            1,
            None,
            40,
            4000,
            0,
            0,
            "",
        ]
    )
    sheet.append(
        [
            code,
            day,
            "Transit mixer",
            "HO",
            8,
            None,
            None,
            None,
            500,
            0,
            "Hours",
        ]
    )
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
