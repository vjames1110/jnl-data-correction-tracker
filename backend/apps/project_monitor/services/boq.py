"""
Railway BOQ rules for DPR items: the bid rate, escalation and the
group (heading) tree.

- An item with an **authority rate** is paid at the bid rate =
  authority rate x (1 + tender % / 100). The percentage is the
  item's own, else the contract-wide ``Site.tender_percent``. The
  arithmetic lives on ``DprItem.compute_bid_rate`` and runs on every
  save, so ``item.rate`` (what all billing and costing code reads)
  is always the bid rate. An item with no authority rate keeps a
  hand-typed rate exactly as before.
- **Escalation** is a list of dated steps for the contract; each
  step's percent is the TOTAL over the bid rate from that date. New
  entries and bills are priced at ``effective_rate`` (bid rate x
  escalation on that day) and snapshot it, so work already recorded
  never changes when a step is added.
- Items form a tree up to ``DprItem.MAX_LEVEL`` deep. Headings roll
  their children up; only leaf items take DPR entries and bill lines.
"""

import bisect
from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import (
    DprEntry,
    DprItem,
    RateEscalation,
)

CENT = Decimal("0.01")
ZERO = Decimal("0")
MAX_ESCALATION_PERCENT = Decimal("500")


# --------------------------------------------------------- escalation


def escalation_series(site) -> list:
    """``[(effective_from, percent), ...]`` ascending by date."""
    return list(
        RateEscalation.objects.filter(site=site)
        .order_by("effective_from")
        .values_list("effective_from", "percent")
    )


def escalation_percent(series, day) -> Decimal:
    """The total escalation in force on ``day`` (0 before the first)."""
    if not series:
        return ZERO
    dates = [row[0] for row in series]
    index = bisect.bisect_right(dates, day) - 1
    return series[index][1] if index >= 0 else ZERO


def effective_rate(item, day, series=None) -> Decimal:
    """The rate new work on ``day`` is priced at."""
    if series is None:
        series = escalation_series(item.site)
    percent = escalation_percent(series, day)
    if not percent:
        return item.rate
    return (item.rate * (1 + percent / 100)).quantize(CENT)


def create_escalation(
    *, site, effective_from, percent, note="", actor=None
) -> RateEscalation:
    if percent is None or not (
        -MAX_ESCALATION_PERCENT <= percent <= MAX_ESCALATION_PERCENT
    ):
        raise ValidationError(
            {
                "percent": (
                    "Enter the total escalation over the bid "
                    f"rate, between -{MAX_ESCALATION_PERCENT}% "
                    f"and {MAX_ESCALATION_PERCENT}%."
                )
            }
        )
    if RateEscalation.objects.filter(
        site=site, effective_from=effective_from
    ).exists():
        raise ValidationError(
            {
                "effective_from": (
                    "An escalation from this date already "
                    "exists - delete it first or pick another "
                    "date."
                )
            }
        )
    return RateEscalation.objects.create(
        site=site,
        effective_from=effective_from,
        percent=percent,
        note=(note or "").strip(),
        created_by=actor,
        updated_by=actor,
    )


def delete_escalation(escalation: RateEscalation) -> None:
    escalation.delete()


# ---------------------------------------------------------- bid rates


@transaction.atomic
def recalculate_rates(site, actor=None) -> dict:
    """
    Re-derive the bid rate of every item that has an authority rate
    (after the contract-wide percentage changed). Entries and bill
    lines already recorded keep the rate they were saved at.
    """
    changed = 0
    recorded = 0
    for item in DprItem.objects.filter(
        site=site, authority_rate__isnull=False
    ).select_related("site"):
        bid = item.compute_bid_rate()
        if bid is None or bid == item.rate:
            continue
        item.updated_by = actor
        item.save()
        changed += 1
        recorded += DprEntry.objects.filter(item=item).count()
    return {
        "items_changed": changed,
        "entries_on_old_rate": recorded,
    }


# --------------------------------------------------------------- tree


def tree_order(items) -> list:
    """Items in tree order: each group followed by its children."""
    by_parent: dict = {}
    for item in items:
        by_parent.setdefault(item.parent_id, []).append(item)
    for children in by_parent.values():
        children.sort(
            key=lambda item: (
                item.row_order,
                item.item_no,
                item.description,
            )
        )

    ordered = []
    seen = set()

    def walk(parent_id):
        for child in by_parent.get(parent_id, []):
            if child.pk in seen:
                continue
            seen.add(child.pk)
            ordered.append(child)
            walk(child.pk)

    walk(None)
    # Anything left over (a parent outside the list) still shows.
    ordered.extend(item for item in items if item.pk not in seen)
    return ordered


def levels(items) -> dict:
    """``{item id: level}`` computed in memory (no query per item)."""
    parent_of = {item.pk: item.parent_id for item in items}
    result = {}
    for item in items:
        depth, node, guard = 1, item.parent_id, 0
        while node and guard < 10:
            depth += 1
            node = parent_of.get(node)
            guard += 1
        result[item.pk] = depth
    return result


def boq_total(site) -> Decimal:
    """Sum of every leaf item's scope amount at the bid rate."""
    return sum(
        (
            item.scope_qty * item.rate
            for item in DprItem.objects.filter(
                site=site, is_heading=False, is_active=True
            )
        ),
        ZERO,
    )
