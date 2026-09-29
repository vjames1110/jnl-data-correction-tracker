"""
Costing-native BOQ: a static profit/loss sheet living entirely in
Costing (see ``CostingBoqItem``'s own docstring for why - the
director's ERP now owns quantities and billing, so DPR & Bills stays
in the app but unused). No daily entries, no measurement sheets, no
bills - every figure below is derived live from each row's own
quantity and rates, recalculated on every read rather than snapshotted.

Scope decision (flagged, not silently assumed): only **level-1** rows
count toward the contract-wide totals (``summary``). A row's children
are always treated as its own cost breakdown (materials), never as
separately billable contract lines - this matches the confirmed
example ("RCC retaining wall" billed as one item, "Supply of cement" /
"Supply of sand" underneath purely explain what it costs to build).
Grouping several *billable* items under an organisational heading
(the DPR & Bills BOQ's "4 Earthwork > 4.1 Embankment > item" pattern)
is not supported here yet - everything below level 1 is cost-only.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Max
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import CostingBoqItem
from apps.project_monitor.services.boq import levels, tree_order

CENT = Decimal("0.01")
ZERO = Decimal("0")


def _cents(value) -> Decimal:
    return Decimal(value).quantize(CENT)


def _effective_gst_percent(item, site) -> Decimal:
    percent = item.gst_percent
    if percent is None:
        percent = getattr(site, "gst_percent", None)
    return Decimal(percent or 0)


def _escalated_authority_rate(item, site):
    if item.authority_rate is None:
        return None
    escalation = (
        getattr(site, "authority_escalation_percent", None) or 0
    )
    return _cents(
        item.authority_rate * (1 + Decimal(escalation) / 100)
    )


def build_rows(site) -> list[dict]:
    """
    Every active BOQ row for a site, in tree order, with every figure
    the sheet shows: the escalated authority rate, the bid rate/
    amount, our cost rate/amount (rolled up from children when it has
    any), GST, and profit/loss - both per unit and for the row's own
    quantity.
    """
    items = tree_order(
        list(
            CostingBoqItem.objects.filter(
                site=site, is_active=True
            ).select_related("site")
        )
    )
    level_of = levels(items)
    children_of: dict = {}
    for item in items:
        children_of.setdefault(item.parent_id, []).append(item.id)
    by_id = {item.id: item for item in items}

    cost_amount_cache: dict = {}

    def cost_amount(item_id):
        if item_id in cost_amount_cache:
            return cost_amount_cache[item_id]
        item = by_id[item_id]
        child_ids = children_of.get(item_id, [])
        if child_ids:
            total = sum(
                (cost_amount(child_id) for child_id in child_ids),
                ZERO,
            )
        else:
            total = (
                item.qty * item.our_cost_rate
                if item.qty is not None
                and item.our_cost_rate is not None
                else ZERO
            )
        cost_amount_cache[item_id] = total
        return total

    rows = []
    for item in items:
        has_children = bool(children_of.get(item.id))
        total_cost_amount = _cents(cost_amount(item.id))
        our_cost_rate = (
            _cents(total_cost_amount / item.qty)
            if has_children and item.qty
            else item.our_cost_rate
        )
        bid_rate = item.rate
        bid_amount = (
            _cents(item.qty * bid_rate)
            if item.qty is not None and bid_rate is not None
            else ZERO
        )
        gst_percent = _effective_gst_percent(item, site)
        gst_amount = _cents(bid_amount * gst_percent / 100)
        profit_amount = _cents(bid_amount - total_cost_amount)
        profit_per_unit = (
            _cents(bid_rate - our_cost_rate)
            if bid_rate is not None and our_cost_rate is not None
            else None
        )
        rows.append(
            {
                "id": item.id,
                "parent_id": item.parent_id,
                "level": level_of[item.id],
                "has_children": has_children,
                "item_no": item.item_no,
                "description": item.description,
                "unit": item.unit,
                "qty": item.qty,
                "authority_rate": item.authority_rate,
                "escalated_authority_rate": (
                    _escalated_authority_rate(item, site)
                ),
                "tender_percent": item.tender_percent,
                "bid_rate": bid_rate,
                "bid_amount": bid_amount,
                "our_cost_rate": our_cost_rate,
                "cost_amount": total_cost_amount,
                "gst_percent": gst_percent,
                "gst_amount": gst_amount,
                "bid_amount_incl_gst": bid_amount + gst_amount,
                "profit_per_unit": profit_per_unit,
                "profit_amount": profit_amount,
                "is_active": item.is_active,
            }
        )
    return rows


def summary(rows: list[dict]) -> dict:
    """
    Contract-wide totals over the level-1 (billable) rows only - see
    this module's own docstring for why nested rows are excluded.
    """
    top = [row for row in rows if row["level"] == 1]
    return {
        "bid_amount": sum((r["bid_amount"] for r in top), ZERO),
        "cost_amount": sum((r["cost_amount"] for r in top), ZERO),
        "gst_amount": sum((r["gst_amount"] for r in top), ZERO),
        "bid_amount_incl_gst": sum(
            (r["bid_amount_incl_gst"] for r in top), ZERO
        ),
        "profit_amount": sum((r["profit_amount"] for r in top), ZERO),
    }


def boq_sheet(site) -> dict:
    rows = build_rows(site)
    return {"rows": rows, "summary": summary(rows)}


def create_item(
    *,
    site,
    description,
    item_no="",
    unit="",
    qty=None,
    authority_rate=None,
    tender_percent=None,
    rate=None,
    our_cost_rate=None,
    gst_percent=None,
    parent=None,
    actor=None,
) -> CostingBoqItem:
    if parent is not None and parent.site_id != site.id:
        raise ValidationError(
            {"parent": ["The parent row must be on the same project."]}
        )
    next_order = (
        CostingBoqItem.objects.filter(site=site).aggregate(
            top=Max("row_order")
        )["top"]
        or 0
    ) + 1
    return CostingBoqItem.objects.create(
        site=site,
        parent=parent,
        row_order=next_order,
        item_no=item_no,
        description=description,
        unit=unit,
        qty=qty,
        authority_rate=authority_rate,
        tender_percent=tender_percent,
        rate=rate,
        our_cost_rate=our_cost_rate,
        gst_percent=gst_percent,
        created_by=actor,
        updated_by=actor,
    )


UPDATABLE_FIELDS = (
    "item_no",
    "description",
    "unit",
    "qty",
    "authority_rate",
    "tender_percent",
    "rate",
    "our_cost_rate",
    "gst_percent",
    "is_active",
)


def update_item(item: CostingBoqItem, *, actor=None, **fields) -> CostingBoqItem:
    for field, value in fields.items():
        if field not in UPDATABLE_FIELDS:
            continue
        setattr(item, field, value)
    item.updated_by = actor
    item.save()
    return item


@transaction.atomic
def recalculate_rates(site, actor=None) -> int:
    """
    Re-derive the bid rate of every row that has an authority rate,
    after the contract-wide tender % or departmental escalation
    changed - there is no recorded history to protect here (this
    sheet has no daily entries), so every affected row simply gets
    its current rate. Returns how many rows changed.
    """
    changed = 0
    for item in CostingBoqItem.objects.filter(
        site=site, authority_rate__isnull=False
    ).select_related("site"):
        bid = item.compute_bid_rate()
        if bid is None or bid == item.rate:
            continue
        item.updated_by = actor
        item.save()
        changed += 1
    return changed


def delete_item(item: CostingBoqItem) -> None:
    if item.children.exists():
        raise ValidationError(
            {
                "detail": (
                    "This row has items under it - delete those "
                    "first."
                )
            }
        )
    item.delete()
