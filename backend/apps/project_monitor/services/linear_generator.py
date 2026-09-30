"""
Creation helpers for Linear works - deliberately thin, since there's
no Activity engine involved here (see ``models.LinearItem``'s own
docstring for why). ``qty`` is always optional and always whatever
the client actually sent when given; the one piece of real logic is
that an ``M``-unit scope patch/progress entry left blank auto-derives
``qty`` from its own chainage span instead (display/audit only, never
re-applied later - same convention ``GirderSpan`` uses for RDSO
library values copied in at pick-time) - a real physical quantity
(e.g. an actual drain length that isn't quite the raw chainage
difference) can still be typed in directly. Non-``M`` units have no
such auto-derivation at all - a blank ``qty`` there just stays blank.
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
    if qty is not None:
        return qty
    if unit == LinearUnit.M:
        return (
            to_chainage_km - from_chainage_km
        ) * METRES_PER_KM
    return None


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
