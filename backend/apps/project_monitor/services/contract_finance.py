"""
Money-aware contract status and the "as on" financial report, both
computed server-side (same "backend owns the number" principle as the
completion countdown) so every screen agrees.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone

from apps.project_monitor.models import DprItem
from apps.project_monitor.services import billing, dpr, timeline

ZERO = Decimal("0")

PACE_ON = "ON_PACE"
PACE_SHORT = "SHORT_BY"


def financial_summary(site, today=None) -> dict:
    today = today or timezone.localdate()

    valued = dpr.contract_value(site)
    billed = billing.cumulative_billed(site)
    bill_no, bill_date = billing.last_bill(site)

    # With no bill date yet, every DPR entry to date is "after the
    # last bill" (the prototype ignored DPR value until a bill
    # existed).
    after_bill = dpr.dpr_value_between(
        site, bill_date or date.min, today
    )
    done_total = billed + after_bill
    balance = max(ZERO, valued - done_total)
    percent_done = (
        min(Decimal("100"), done_total / valued * 100)
        if valued
        else None
    )

    days_left = timeline.days_remaining(site, today)
    per_day_required = (
        balance / days_left
        if days_left is not None and days_left > 0
        else None
    )
    yesterday = dpr.dpr_value_on(
        site, today - timedelta(days=1)
    )
    average_7 = dpr.seven_day_average(site, today)

    pace = None
    shortfall = None
    if per_day_required is not None:
        if yesterday >= per_day_required:
            pace = PACE_ON
        else:
            pace = PACE_SHORT
            shortfall = per_day_required - yesterday

    return {
        "as_on": today,
        "contract_no": site.contract_no,
        "original_value": site.project_value,
        "varied_value": site.varied_value,
        "valued": valued,
        "last_bill_no": bill_no,
        "last_bill_date": bill_date,
        "work_done_to_last_bill": billed,
        "dpr_value_after_last_bill": after_bill,
        "work_done_total": done_total,
        "balance_value": balance,
        "percent_done": (
            round(percent_done, 1)
            if percent_done is not None
            else None
        ),
        "days_remaining": days_left,
        "per_day_required": per_day_required,
        "executed_yesterday": yesterday,
        "seven_day_average": average_7,
        "pace": pace,
        "shortfall": shortfall,
        "unbilled_value": billing.unbilled_value(site),
        **billing.payment_totals(site),
    }


def financial_report(site, as_on=None) -> dict:
    """
    Per-item position as on a date: what was executed up to it and on
    the day itself, what has been billed up to it, and what is still
    unbilled - only items with something executed by then.
    """
    as_on = as_on or timezone.localdate()
    previous = as_on - timedelta(days=1)

    executed = dpr.executed_totals(site, as_on)
    executed_before = dpr.executed_totals(site, previous)
    billed = dpr.billed_qty_map(site, as_on)

    rows = []
    totals = {
        "executed_value": ZERO,
        "today_value": ZERO,
        "unbilled_value": ZERO,
    }
    for item in DprItem.objects.filter(site=site):
        qty, value = executed.get(item.id, (ZERO, ZERO))
        if qty <= 0:
            continue
        before_qty, before_value = executed_before.get(
            item.id, (ZERO, ZERO)
        )
        today_qty = qty - before_qty
        today_value = value - before_value
        billed_qty = billed.get(item.id, ZERO)
        unbilled = (qty - billed_qty) * item.rate
        rows.append(
            {
                "id": item.id,
                "item_no": item.item_no,
                "description": item.description,
                "unit": item.unit,
                "rate": item.rate,
                "scope_qty": item.scope_qty,
                "executed_qty": qty,
                "executed_value": value,
                "percent_of_item": (
                    round(qty / item.scope_qty * 100, 1)
                    if item.scope_qty
                    else None
                ),
                "today_qty": today_qty,
                "today_value": today_value,
                "billed_qty": billed_qty,
                "unbilled_value": unbilled,
            }
        )
        totals["executed_value"] += value
        totals["today_value"] += today_value
        totals["unbilled_value"] += unbilled

    return {
        "as_on": as_on,
        "summary": financial_summary(site, as_on),
        "rows": rows,
        "totals": totals,
    }
