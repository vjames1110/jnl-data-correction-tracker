"""
Machinery cost for one site: what each machine or vehicle worked and
cost per day, plus fuel.

Cost rules (ported from the director's prototype, Section H):
- Hire of a machine-day is ``rate x qty`` when hired per day or per
  hour, and ``rate / 30 x qty`` when hired per month. The monthly
  figure deliberately uses a flat 30 days (as the prototype does),
  NOT the actual days in the month that HR staff cost uses - this is
  a known difference, flagged for the director's confirmation.
- The hire amount is stored on each usage row when it is entered, so
  a later rate edit never rewrites a past day. An entry may state its
  own hire amount instead (a negotiated figure).
- Market hire and in-house (HO) machines are reported separately.
- A day's cost = market hire + HO hire + fuel + maintenance + other.
- Days in the future are never entered or costed.
"""

from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import (
    FuelEntry,
    HireBasis,
    Machine,
    MachineSource,
    MachineUsage,
    MachineUsageSource,
)
from apps.project_monitor.services.hr import (
    month_bounds,
    parse_month,
)

ZERO = Decimal("0")
CENT = Decimal("0.01")
DAYS_PER_MONTH_FOR_HIRE = Decimal("30")

__all__ = ["month_bounds", "parse_month"]


def _money(value) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def hire_for(machine: Machine, qty) -> Decimal:
    """Hire cost of ``qty`` units of ``machine`` at its current rate."""
    qty = Decimal(qty or 0)
    if machine.hire_basis == HireBasis.MONTH:
        return _money(
            machine.rate / DAYS_PER_MONTH_FOR_HIRE * qty
        )
    return _money(machine.rate * qty)


def _require_not_future(day, today=None):
    today = today or timezone.localdate()
    if day > today:
        raise ValidationError(
            {"date": "Future dates cannot be entered."}
        )


def _non_negative(value, field) -> Decimal:
    amount = _money(value or ZERO)
    if amount < 0:
        raise ValidationError(
            {field: "The amount cannot be negative."}
        )
    return amount


def save_usage(
    *,
    machine,
    day,
    qty=ZERO,
    hire_amount=None,
    maintenance=ZERO,
    other=ZERO,
    remarks="",
    actor=None,
    source=MachineUsageSource.MANUAL,
    today=None,
) -> tuple[MachineUsage, bool]:
    """Record (or replace) a machine's day; returns (row, created)."""
    _require_not_future(day, today)
    if not machine.is_active:
        raise ValidationError(
            {"machine": "This machine is not active."}
        )
    qty = Decimal(qty or 0).quantize(CENT)
    if qty < 0:
        raise ValidationError(
            {"qty": "Days/hours cannot be negative."}
        )
    hire = (
        hire_for(machine, qty)
        if hire_amount is None
        else _non_negative(hire_amount, "hire_amount")
    )
    maintenance = _non_negative(maintenance, "maintenance")
    other = _non_negative(other, "other")
    if not (qty or hire or maintenance or other):
        raise ValidationError(
            {
                "qty": (
                    "Enter the days/hours worked, or a hire, "
                    "maintenance or other cost."
                )
            }
        )

    row, created = MachineUsage.objects.update_or_create(
        machine=machine,
        date=day,
        defaults={
            "qty": qty,
            "hire_amount": hire,
            "maintenance": maintenance,
            "other": other,
            "remarks": (remarks or "").strip(),
            "source": source,
            "updated_by": actor,
        },
    )
    if created:
        row.created_by = actor
        row.save(update_fields=["created_by"])
    return row, created


def add_fuel(
    *,
    site,
    day,
    litres,
    machine=None,
    rate=None,
    amount=None,
    remarks="",
    actor=None,
    source=MachineUsageSource.MANUAL,
    today=None,
) -> FuelEntry:
    """
    Record fuel. Give the price per litre (``rate``) or the total
    (``amount``); the other is worked out. ``machine`` blank = site
    fuel not tied to one machine.
    """
    _require_not_future(day, today)
    litres = Decimal(litres or 0).quantize(CENT)
    if litres <= 0:
        raise ValidationError(
            {"litres": "Enter how many litres."}
        )
    if machine is not None and machine.site_id != site.id:
        raise ValidationError(
            {"machine": "That machine belongs to another site."}
        )
    if amount is None and rate is None:
        raise ValidationError(
            {"rate": "Enter the price per litre or the total cost."}
        )
    if amount is None:
        rate = _non_negative(rate, "rate")
        amount = _money(litres * rate)
    else:
        amount = _non_negative(amount, "amount")
        rate = _money(amount / litres)
    return FuelEntry.objects.create(
        site=site,
        machine=machine,
        date=day,
        litres=litres,
        rate=rate,
        amount=amount,
        remarks=(remarks or "").strip(),
        source=source,
        created_by=actor,
        updated_by=actor,
    )


# ---------------------------------------------------------------
# Day-wise cost
# ---------------------------------------------------------------


def day_costs(site, start, end, today=None) -> list[dict]:
    """One row per day up to today: hire (market/HO), fuel, other."""
    today = today or timezone.localdate()
    end = min(end, today)
    if end < start:
        return []

    usage = {}
    for row in (
        MachineUsage.objects.filter(
            machine__site=site, date__range=(start, end)
        )
        .values("date", "machine__source")
        .annotate(
            sum_hire=Sum("hire_amount"),
            sum_maintenance=Sum("maintenance"),
            sum_other=Sum("other"),
        )
    ):
        usage.setdefault(row["date"], []).append(row)
    fuel = {
        row["date"]: row["sum_amount"]
        for row in FuelEntry.objects.filter(
            site=site, date__range=(start, end)
        )
        .values("date")
        .annotate(sum_amount=Sum("amount"))
    }

    rows = []
    day = start
    while day <= end:
        market = ho = maintenance = other = ZERO
        for part in usage.get(day, []):
            if part["machine__source"] == MachineSource.HO:
                ho += part["sum_hire"]
            else:
                market += part["sum_hire"]
            maintenance += part["sum_maintenance"]
            other += part["sum_other"]
        fuel_cost = fuel.get(day, ZERO)
        rows.append(
            {
                "date": day,
                "market_hire": market,
                "ho_hire": ho,
                "fuel": fuel_cost,
                "maintenance": maintenance,
                "other": other,
                "total": market
                + ho
                + fuel_cost
                + maintenance
                + other,
            }
        )
        day += timedelta(days=1)
    return rows


def month_summary(site, year, month, today=None) -> dict:
    today = today or timezone.localdate()
    start, end = month_bounds(year, month)
    end = min(end, today)
    rows = day_costs(site, start, end, today=today)

    machines = {
        machine.id: {
            "machine": machine.id,
            "name": machine.name,
            "reg_no": machine.reg_no,
            "source": machine.source,
            "qty": ZERO,
            "hire": ZERO,
            "fuel": ZERO,
            "maintenance": ZERO,
            "other": ZERO,
        }
        for machine in Machine.objects.filter(site=site)
    }
    for row in MachineUsage.objects.filter(
        machine__site=site, date__range=(start, end)
    ).values(
        "machine_id",
        "qty",
        "hire_amount",
        "maintenance",
        "other",
    ):
        entry = machines[row["machine_id"]]
        entry["qty"] += row["qty"]
        entry["hire"] += row["hire_amount"]
        entry["maintenance"] += row["maintenance"]
        entry["other"] += row["other"]
    site_fuel = ZERO
    for row in FuelEntry.objects.filter(
        site=site, date__range=(start, end)
    ).values("machine_id", "amount"):
        if row["machine_id"] is None:
            site_fuel += row["amount"]
        else:
            machines[row["machine_id"]]["fuel"] += row["amount"]

    by_machine = []
    for entry in machines.values():
        entry["total"] = (
            entry["hire"]
            + entry["fuel"]
            + entry["maintenance"]
            + entry["other"]
        )
        if entry["total"] or entry["qty"]:
            by_machine.append(entry)
    by_machine.sort(key=lambda entry: -entry["total"])

    def total_of(key):
        return sum((row[key] for row in rows), ZERO)

    return {
        "month": f"{year:04d}-{month:02d}",
        "days": rows,
        "totals": {
            "market_hire": total_of("market_hire"),
            "ho_hire": total_of("ho_hire"),
            "fuel": total_of("fuel"),
            "maintenance": total_of("maintenance"),
            "other": total_of("other"),
            "total": total_of("total"),
        },
        "by_machine": by_machine,
        "site_fuel": site_fuel,
    }


def cost_by_day_map(site, start, end, today=None) -> dict:
    """``{date: total machinery cost}`` - the feed Phase 12 reads."""
    return {
        row["date"]: row["total"]
        for row in day_costs(site, start, end, today=today)
    }
