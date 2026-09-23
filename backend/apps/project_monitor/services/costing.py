"""
Costing: expense vs value of work done, and a "Today at a glance"
summary - Section I of the director's prototype, the last of the
finance feeds. It combines the feeds already built rather than
re-deriving them:

- value of work done that day: ``dpr.day_value_map`` / ``dpr_value_on``.
- labour + staff cost that day: ``hr.cost_by_day_map``.
- machinery cost that day: ``machinery.cost_by_day_map``.
- concrete cost that day: the stores figure (``ConcreteProduction``)
  if one was recorded for the day - which REPLACES the estimate,
  never adds to it - else DPR-executed cum (``qty x
  item.concrete_per_unit``) at the material's w.e.f. rate.
- TMT cost that day: DPR-executed MT (``qty x item.tmt_kg_per_unit``
  / 1000) at the material's w.e.f. rate - always computed; the
  prototype has no stores override for TMT.

Margin before overheads = value - total expense; the expense/value
ratio is flagged once it passes 90%, per the prototype. Each day also
carries a completeness flag per feed (did DPR/HR/machinery/stores
show anything at all that day?) so a day with a missing upload can't
read as an unrealistically good margin.

Access is Director/Admin only (see
``api.permissions.HasProjectMonitorCostingAccess``) - deliberately the
one Project Monitor feed with no per-site Project Manager/Incharge
grant, since project margin is materially more sensitive than
progress or even billing figures.
"""

import bisect
from datetime import timedelta
from decimal import Decimal

from django.db.models import (
    DecimalField,
    ExpressionWrapper,
    F,
    Sum,
)
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import (
    ConcreteProduction,
    DprEntry,
    MaterialKind,
    MaterialRate,
)
from apps.project_monitor.services import dpr, hr, machinery

ZERO = Decimal("0")
KG_PER_MT = Decimal("1000")
EXPENSE_RATIO_FLAG = Decimal("0.9")
DEFAULT_RANGE_DAYS = 30

_CONCRETE_CUM = ExpressionWrapper(
    F("qty") * F("item__concrete_per_unit"),
    output_field=DecimalField(
        max_digits=20, decimal_places=6
    ),
)
_TMT_KG = ExpressionWrapper(
    F("qty") * F("item__tmt_kg_per_unit"),
    output_field=DecimalField(
        max_digits=20, decimal_places=6
    ),
)


# ---------------------------------------------------------------
# Material rates (w.e.f., latest-on-or-before-day wins)
# ---------------------------------------------------------------


def _rate_series(site, kind) -> list:
    """``[(effective_from, rate), ...]`` ascending by date."""
    return list(
        MaterialRate.objects.filter(
            site=site, kind=kind
        )
        .order_by("effective_from")
        .values_list("effective_from", "rate")
    )


def _rate_at(series, day) -> Decimal:
    if not series:
        return ZERO
    dates = [row[0] for row in series]
    index = bisect.bisect_right(dates, day) - 1
    if index < 0:
        return ZERO
    return series[index][1]


def rate_on(site, kind, day) -> Decimal:
    return _rate_at(_rate_series(site, kind), day)


def current_rates(site, today=None) -> dict:
    """The rate in force today for each material kind, and since when."""
    today = today or timezone.localdate()
    rates = {}
    for kind in MaterialKind.values:
        row = (
            MaterialRate.objects.filter(
                site=site,
                kind=kind,
                effective_from__lte=today,
            )
            .order_by("-effective_from")
            .first()
        )
        rates[kind] = {
            "rate": row.rate if row else None,
            "effective_from": (
                row.effective_from if row else None
            ),
        }
    return rates


def rate_register(site):
    return MaterialRate.objects.filter(site=site)


def create_rate(
    *, site, kind, effective_from, rate, actor=None
) -> MaterialRate:
    if rate is None or rate <= 0:
        raise ValidationError(
            {"rate": "Enter a rate greater than zero."}
        )
    if MaterialRate.objects.filter(
        site=site, kind=kind, effective_from=effective_from
    ).exists():
        raise ValidationError(
            {
                "effective_from": (
                    "A rate for this material and date "
                    "already exists - delete it first or "
                    "pick another date."
                )
            }
        )
    return MaterialRate.objects.create(
        site=site,
        kind=kind,
        effective_from=effective_from,
        rate=rate,
        created_by=actor,
        updated_by=actor,
    )


def delete_rate(rate: MaterialRate) -> None:
    rate.delete()


# ---------------------------------------------------------------
# Concrete production (stores) and DPR-derived material quantities
# ---------------------------------------------------------------


def production_register(site, start, end):
    return ConcreteProduction.objects.filter(
        site=site, date__range=(start, end)
    )


def create_production(
    *,
    site,
    day,
    cum,
    grade="",
    cement_cost=ZERO,
    aggregate_cost=ZERO,
    sand_cost=ZERO,
    other_cost=ZERO,
    remarks="",
    actor=None,
    today=None,
) -> ConcreteProduction:
    today = today or timezone.localdate()
    if day > today:
        raise ValidationError(
            {"date": "Future dates cannot be entered."}
        )
    if cum is None or cum <= 0:
        raise ValidationError(
            {"cum": "Enter the cum poured/produced."}
        )
    return ConcreteProduction.objects.create(
        site=site,
        date=day,
        grade=(grade or "").strip(),
        cum=cum,
        cement_cost=cement_cost or ZERO,
        aggregate_cost=aggregate_cost or ZERO,
        sand_cost=sand_cost or ZERO,
        other_cost=other_cost or ZERO,
        remarks=(remarks or "").strip(),
        created_by=actor,
        updated_by=actor,
    )


def delete_production(row: ConcreteProduction) -> None:
    row.delete()


def _dpr_material_map(site, start, end) -> dict:
    """``{date: (concrete cum, TMT kg)}`` from DPR execution."""
    rows = (
        DprEntry.objects.filter(
            item__site=site, date__range=(start, end)
        )
        .values("date")
        .annotate(cum=Sum(_CONCRETE_CUM), kg=Sum(_TMT_KG))
    )
    return {
        row["date"]: (
            row["cum"] or ZERO,
            row["kg"] or ZERO,
        )
        for row in rows
    }


def _stores_map(site, start, end) -> dict:
    rows = (
        ConcreteProduction.objects.filter(
            site=site, date__range=(start, end)
        )
        .values("date")
        .annotate(
            cum=Sum("cum"),
            cement=Sum("cement_cost"),
            aggregate=Sum("aggregate_cost"),
            sand=Sum("sand_cost"),
            other=Sum("other_cost"),
        )
    )
    return {row["date"]: row for row in rows}


# ---------------------------------------------------------------
# Day-wise cost, the cost table, and "Today at a glance"
# ---------------------------------------------------------------


def cost_range(site, start, end, today=None) -> list:
    """One row per day, ``start`` to ``end`` (never past ``today``)."""
    today = today or timezone.localdate()
    end = min(end, today)
    if end < start:
        return []

    value_map = dpr.day_value_map(site, start, end)
    hr_map = hr.cost_by_day_map(
        site, start, end, today=today
    )
    machinery_map = machinery.cost_by_day_map(
        site, start, end, today=today
    )
    dpr_material_map = _dpr_material_map(
        site, start, end
    )
    stores_map = _stores_map(site, start, end)
    dpr_days = set(
        DprEntry.objects.filter(
            item__site=site, date__range=(start, end)
        ).values_list("date", flat=True)
    )
    concrete_series = _rate_series(
        site, MaterialKind.CONCRETE
    )
    tmt_series = _rate_series(site, MaterialKind.TMT)

    rows = []
    day = start
    while day <= end:
        value = value_map.get(day, ZERO)
        hr_cost = hr_map.get(day, ZERO)
        machinery_cost = machinery_map.get(day, ZERO)
        cum, kg = dpr_material_map.get(
            day, (ZERO, ZERO)
        )

        stores_row = stores_map.get(day)
        if stores_row and stores_row["cum"]:
            concrete_cum = stores_row["cum"]
            concrete_cost = (
                (stores_row["cement"] or ZERO)
                + (stores_row["aggregate"] or ZERO)
                + (stores_row["sand"] or ZERO)
                + (stores_row["other"] or ZERO)
            )
            concrete_source = "STORES"
        elif cum:
            concrete_cum = cum
            concrete_cost = cum * _rate_at(
                concrete_series, day
            )
            concrete_source = "ESTIMATED"
        else:
            concrete_cum = ZERO
            concrete_cost = ZERO
            concrete_source = "NONE"

        tmt_mt = kg / KG_PER_MT
        tmt_cost = (
            tmt_mt * _rate_at(tmt_series, day)
            if tmt_mt
            else ZERO
        )

        total_expense = (
            hr_cost + machinery_cost + concrete_cost + tmt_cost
        )
        margin = value - total_expense
        ratio = (
            (total_expense / value) if value else None
        )

        rows.append(
            {
                "date": day,
                "value": value,
                "labour_staff_cost": hr_cost,
                "machinery_cost": machinery_cost,
                "concrete_cum": concrete_cum,
                "concrete_cost": concrete_cost,
                "concrete_source": concrete_source,
                "tmt_mt": tmt_mt,
                "tmt_cost": tmt_cost,
                "total_expense": total_expense,
                "margin": margin,
                "expense_ratio": (
                    round(ratio, 4)
                    if ratio is not None
                    else None
                ),
                "flagged": (
                    ratio is not None
                    and ratio > EXPENSE_RATIO_FLAG
                ),
                "complete": {
                    "dpr": day in dpr_days,
                    "hr": bool(hr_cost),
                    "machinery": bool(machinery_cost),
                    "stores": bool(stores_row),
                },
            }
        )
        day += timedelta(days=1)
    return rows


def _totals(rows) -> dict:
    totals = {
        "value": sum((r["value"] for r in rows), ZERO),
        "labour_staff_cost": sum(
            (r["labour_staff_cost"] for r in rows), ZERO
        ),
        "machinery_cost": sum(
            (r["machinery_cost"] for r in rows), ZERO
        ),
        "concrete_cost": sum(
            (r["concrete_cost"] for r in rows), ZERO
        ),
        "tmt_cost": sum(
            (r["tmt_cost"] for r in rows), ZERO
        ),
    }
    totals["total_expense"] = (
        totals["labour_staff_cost"]
        + totals["machinery_cost"]
        + totals["concrete_cost"]
        + totals["tmt_cost"]
    )
    totals["margin"] = (
        totals["value"] - totals["total_expense"]
    )
    totals["expense_ratio"] = (
        round(totals["total_expense"] / totals["value"], 4)
        if totals["value"]
        else None
    )
    return totals


def cost_table(site, start, end, today=None) -> dict:
    rows = cost_range(site, start, end, today=today)
    return {
        "start": start,
        "end": end,
        "days": rows,
        "totals": _totals(rows),
    }


def cost_on(site, day, today=None) -> dict:
    rows = cost_range(site, day, day, today=today)
    if rows:
        return rows[0]
    return {
        "date": day,
        "value": ZERO,
        "labour_staff_cost": ZERO,
        "machinery_cost": ZERO,
        "concrete_cum": ZERO,
        "concrete_cost": ZERO,
        "concrete_source": "NONE",
        "tmt_mt": ZERO,
        "tmt_cost": ZERO,
        "total_expense": ZERO,
        "margin": ZERO,
        "expense_ratio": None,
        "flagged": False,
        "complete": {
            "dpr": False,
            "hr": False,
            "machinery": False,
            "stores": False,
        },
    }


def today_at_a_glance(site, today=None) -> dict:
    today = today or timezone.localdate()
    yesterday = today - timedelta(days=1)

    month_start = today.replace(day=1)
    month_to_date = _totals(
        cost_range(site, month_start, today, today=today)
    )

    first_entry = (
        DprEntry.objects.filter(item__site=site)
        .order_by("date")
        .values_list("date", flat=True)
        .first()
    )
    cumulative = (
        _totals(
            cost_range(
                site, first_entry, today, today=today
            )
        )
        if first_entry
        else None
    )

    today_labour = hr.day_costs(
        site, today, today, today=today
    )
    labour_on_site_today = (
        today_labour[0]["labour_nos"]
        if today_labour
        else ZERO
    )

    return {
        "as_on": today,
        "today": cost_on(site, today, today=today),
        "yesterday": cost_on(
            site, yesterday, today=today
        ),
        "month_to_date": month_to_date,
        "cumulative": cumulative,
        "labour_on_site_today": labour_on_site_today,
    }
