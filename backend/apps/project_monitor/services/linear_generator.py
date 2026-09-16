"""
Creation helpers for Linear works - deliberately thin, since there's
no Activity engine involved here (see ``models.LinearItem``'s own
docstring for why). The one piece of real logic is auto-deriving
``qty`` for ``M``-unit scope patches/progress entries from their
chainage span (display/audit only, never re-applied later - same
convention ``GirderSpan`` uses for RDSO library values copied in at
pick-time); non-``M`` units keep whatever quantity was entered.
"""

from decimal import Decimal

from apps.project_monitor.models import (
    LinearItem,
    LinearUnit,
    ProgressEntry,
    ScopePatch,
)

METRES_PER_KM = Decimal("1000")


def _resolved_qty(
    unit, from_chainage_km, to_chainage_km, qty
):
    if unit == LinearUnit.M:
        return (
            to_chainage_km - from_chainage_km
        ) * METRES_PER_KM
    return qty


def create_linear_item(
    *, site, name, unit, actor
):
    return LinearItem.objects.create(
        site=site,
        name=name,
        unit=unit,
        created_by=actor,
        updated_by=actor,
    )


def create_scope_patch(
    *,
    linear_item,
    from_chainage_km,
    to_chainage_km,
    side,
    qty=None,
    remarks="",
    actor,
):
    return ScopePatch.objects.create(
        linear_item=linear_item,
        from_chainage_km=from_chainage_km,
        to_chainage_km=to_chainage_km,
        side=side,
        qty=_resolved_qty(
            linear_item.unit,
            from_chainage_km,
            to_chainage_km,
            qty,
        ),
        remarks=remarks or "",
        created_by=actor,
        updated_by=actor,
    )


def create_progress_entry(
    *,
    linear_item,
    date,
    from_chainage_km,
    to_chainage_km,
    side,
    status,
    meeting_date,
    qty=None,
    contractor="",
    remarks="",
    actor,
):
    return ProgressEntry.objects.create(
        linear_item=linear_item,
        date=date,
        from_chainage_km=from_chainage_km,
        to_chainage_km=to_chainage_km,
        qty=_resolved_qty(
            linear_item.unit,
            from_chainage_km,
            to_chainage_km,
            qty,
        ),
        side=side,
        contractor=contractor or "",
        status=status,
        remarks=remarks or "",
        meeting_date=meeting_date,
        created_by=actor,
        updated_by=actor,
    )
