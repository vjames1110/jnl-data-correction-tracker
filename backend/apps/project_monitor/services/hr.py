"""
Human-resource cost for one site: contract labour entered day by
day, and staff on the payroll.

Cost rules (ported from the director's prototype, Section G):
- Labour cost of an entry is ``nos x rate`` unless the entry states
  its own amount (a lump-sum gang); the amount is stored, so a later
  rate change never rewrites a past day.
- A staff member costs ``monthly salary / days in that calendar
  month`` for every day from their joining date to their last day
  (open-ended while still on the project). There is no proration for
  a mid-month joiner - they cost the full daily rate from the day
  they join.
- A day override replaces that day's staff cost (0 = absent/unpaid).
- Days in the future are never costed or entered.
"""

import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import (
    LabourEntry,
    LabourEntrySource,
    StaffDayOverride,
    StaffMember,
)

ZERO = Decimal("0")
CENT = Decimal("0.01")


def _money(value) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def month_bounds(year: int, month: int):
    last = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last)


def parse_month(raw, today=None):
    """``YYYY-MM`` -> (year, month); defaults to the current month."""
    today = today or timezone.localdate()
    if not raw:
        return today.year, today.month
    try:
        year_text, month_text = raw.split("-")
        year, month = int(year_text), int(month_text)
        date(year, month, 1)
    except (ValueError, TypeError) as exc:
        raise ValidationError(
            {"month": "Use the format YYYY-MM."}
        ) from exc
    return year, month


def daily_rate(staff: StaffMember, day: date) -> Decimal:
    days_in_month = calendar.monthrange(day.year, day.month)[1]
    return _money(staff.monthly_salary / days_in_month)


def is_on_payroll(staff: StaffMember, day: date) -> bool:
    return staff.from_date <= day and (
        staff.to_date is None or day <= staff.to_date
    )


def staff_cost_on(
    staff: StaffMember, day: date, overrides=None
) -> Decimal:
    """
    What ``staff`` cost on ``day``. ``overrides`` may be a
    ``{(staff_id, date): amount}`` map to avoid a query per day;
    without it the override is looked up directly.
    """
    if not is_on_payroll(staff, day):
        return ZERO
    if overrides is not None:
        amount = overrides.get((staff.id, day))
    else:
        row = StaffDayOverride.objects.filter(
            staff=staff, date=day
        ).first()
        amount = row.amount if row else None
    if amount is not None:
        return _money(amount)
    return daily_rate(staff, day)


def _override_map(staff_ids, start, end) -> dict:
    return {
        (row.staff_id, row.date): row.amount
        for row in StaffDayOverride.objects.filter(
            staff_id__in=staff_ids, date__range=(start, end)
        )
    }


def day_costs(site, start, end, today=None) -> list[dict]:
    """
    One row per day from ``start`` to ``end`` (never past today):
    labour head-count and cost, staff cost, and their total.
    """
    today = today or timezone.localdate()
    end = min(end, today)
    if end < start:
        return []

    labour = {
        row["date"]: row
        for row in LabourEntry.objects.filter(
            site=site, date__range=(start, end)
        )
        .values("date")
        .annotate(
            sum_nos=Sum("nos"),
            sum_amount=Sum("amount"),
        )
    }
    staff = list(
        StaffMember.objects.filter(site=site)
        .filter(from_date__lte=end)
        .filter(Q(to_date__isnull=True) | Q(to_date__gte=start))
    )
    overrides = _override_map(
        [member.id for member in staff], start, end
    )

    rows = []
    day = start
    while day <= end:
        labour_row = labour.get(day)
        labour_cost = (
            labour_row["sum_amount"] if labour_row else ZERO
        )
        labour_nos = (
            labour_row["sum_nos"] if labour_row else ZERO
        )
        staff_cost = sum(
            (
                staff_cost_on(member, day, overrides)
                for member in staff
            ),
            ZERO,
        )
        rows.append(
            {
                "date": day,
                "labour_nos": labour_nos,
                "labour_cost": labour_cost,
                "staff_cost": staff_cost,
                "total": labour_cost + staff_cost,
            }
        )
        day += timedelta(days=1)
    return rows


def month_summary(site, year, month, today=None) -> dict:
    """The day-wise cost table for a month plus its totals."""
    today = today or timezone.localdate()
    start, end = month_bounds(year, month)
    rows = day_costs(site, start, end, today=today)

    by_category = (
        LabourEntry.objects.filter(
            site=site,
            date__range=(start, min(end, today)),
        )
        .values("category")
        .annotate(
            sum_nos=Sum("nos"),
            sum_amount=Sum("amount"),
            entries=Count("id"),
        )
        .order_by("-sum_amount", "category")
    )

    return {
        "month": f"{year:04d}-{month:02d}",
        "days": rows,
        "totals": {
            "labour_man_days": sum(
                (row["labour_nos"] for row in rows), ZERO
            ),
            "labour_cost": sum(
                (row["labour_cost"] for row in rows), ZERO
            ),
            "staff_cost": sum(
                (row["staff_cost"] for row in rows), ZERO
            ),
            "total": sum(
                (row["total"] for row in rows), ZERO
            ),
        },
        "labour_by_category": [
            {
                "category": row["category"],
                "man_days": row["sum_nos"],
                "cost": row["sum_amount"],
                "entries": row["entries"],
            }
            for row in by_category
        ],
    }


def cost_by_day_map(site, start, end, today=None) -> dict:
    """``{date: total HR cost}`` - the feed Phase 12 costing reads."""
    return {
        row["date"]: row["total"]
        for row in day_costs(site, start, end, today=today)
    }


# ---------------------------------------------------------------
# Labour entries
# ---------------------------------------------------------------


def _require_not_future(day, field="date", today=None):
    today = today or timezone.localdate()
    if day > today:
        raise ValidationError(
            {field: "Future dates cannot be entered."}
        )


def create_labour(
    *,
    site,
    day,
    category,
    nos,
    rate=ZERO,
    amount=None,
    agency="",
    remarks="",
    actor=None,
    source=LabourEntrySource.MANUAL,
    today=None,
) -> LabourEntry:
    category = (category or "").strip()
    if not category:
        raise ValidationError(
            {"category": "Enter the labour category."}
        )
    if nos is None or Decimal(nos) <= 0:
        raise ValidationError(
            {"nos": "Enter how many were on site."}
        )
    _require_not_future(day, today=today)

    nos = Decimal(nos).quantize(CENT)
    rate = _money(rate or ZERO)
    amount = (
        _money(amount)
        if amount is not None
        else _money(nos * rate)
    )
    return LabourEntry.objects.create(
        site=site,
        date=day,
        category=category,
        nos=nos,
        rate=rate,
        amount=amount,
        agency=(agency or "").strip(),
        remarks=(remarks or "").strip(),
        source=source,
        created_by=actor,
        updated_by=actor,
    )


def labour_register(site, start, end):
    return LabourEntry.objects.filter(
        site=site, date__range=(start, end)
    )


# ---------------------------------------------------------------
# Staff and day overrides
# ---------------------------------------------------------------


def set_override(
    *, staff, day, amount, note="", actor=None, today=None
) -> tuple[StaffDayOverride, bool]:
    """Create or replace the override; returns (row, created)."""
    _require_not_future(day, today=today)
    if not is_on_payroll(staff, day):
        raise ValidationError(
            {
                "date": (
                    "That day is outside this person's "
                    "period on the project."
                )
            }
        )
    amount = _money(amount)
    if amount < 0:
        raise ValidationError(
            {"amount": "The amount cannot be negative."}
        )
    row, created = StaffDayOverride.objects.update_or_create(
        staff=staff,
        date=day,
        defaults={
            "amount": amount,
            "note": (note or "").strip(),
            "updated_by": actor,
        },
    )
    if created:
        row.created_by = actor
        row.save(update_fields=["created_by"])
    return row, created
