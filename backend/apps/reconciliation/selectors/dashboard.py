from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, F, Q, Sum, Value
from django.db.models.functions import Abs, Coalesce

from apps.organization.models import Site
from apps.reconciliation.models import (
    ReconciliationEntry,
    ReconciliationEntryStatus,
    ReconciliationFlag,
    ReconciliationPeriod,
)

ZERO = Decimal("0.00")
_VALUE_FIELD = DecimalField(max_digits=16, decimal_places=2)


def _entries_for_month(period_month):
    return ReconciliationEntry.objects.filter(
        period__period_month=period_month,
        period__is_deleted=False,
    )


def _status_counts(*, prefix: str = "") -> dict:
    return {
        f"{prefix}within_tolerance_count": Count(
            "id",
            filter=Q(
                status=(
                    ReconciliationEntryStatus.WITHIN_TOLERANCE
                ),
            ),
        ),
        f"{prefix}watch_count": Count(
            "id",
            filter=Q(
                status=ReconciliationEntryStatus.WATCH,
            ),
        ),
        f"{prefix}over_tolerance_count": Count(
            "id",
            filter=Q(
                status=(
                    ReconciliationEntryStatus.OVER_TOLERANCE
                ),
            ),
        ),
        f"{prefix}not_calculated_count": Count(
            "id",
            filter=Q(
                status=(
                    ReconciliationEntryStatus.NOT_CALCULATED
                ),
            ),
        ),
    }


def latest_reported_month():
    """
    Most recent month with at least one recorded entry, or ``None``
    if nothing has been entered yet anywhere.
    """
    return (
        ReconciliationEntry.objects.filter(
            period__is_deleted=False,
        )
        .order_by("-period__period_month")
        .values_list(
            "period__period_month",
            flat=True,
        )
        .first()
    )


def site_variance_summary(*, period_month) -> list[dict]:
    """
    One row per site that has at least one entry this month, ranked
    worst-first (most Over Tolerance, then most Watch, then largest
    total variance magnitude) so the executive view surfaces the
    sites with the biggest discrepancies at the top.

    ``total_variance_value`` is a magnitude (absolute value summed) -
    it drives the worst-first ranking and doesn't care whether a
    site's deviations were savings or overuse. ``net_variance_value``
    is the signed sum instead - the site's actual profit(+)/loss(-)
    for the month, used for the site-wise variance chart rather than
    for ranking.
    """
    rows = (
        _entries_for_month(period_month)
        .values(
            "period_id",
            site_id=F("period__site_id"),
            site_code=F("period__site__site_code"),
            site_name=F("period__site__site_name"),
            period_status=F("period__status"),
        )
        .annotate(
            total_entries=Count("id"),
            **_status_counts(),
            total_variance_value=Coalesce(
                Sum(Abs(F("variance_value"))),
                Value(
                    ZERO,
                    output_field=_VALUE_FIELD,
                ),
            ),
            net_variance_value=Coalesce(
                Sum(F("variance_value")),
                Value(
                    ZERO,
                    output_field=_VALUE_FIELD,
                ),
            ),
        )
        .order_by(
            "-over_tolerance_count",
            "-watch_count",
            "-total_variance_value",
        )
    )
    return list(rows)


def item_variance_summary(*, period_month) -> list[dict]:
    """
    One row per item that has at least one entry this month, ranked
    worst-first, plus how many distinct sites are currently showing
    a Watch/Over Tolerance reading for that item.
    """
    rows = (
        _entries_for_month(period_month)
        .values(
            "item_id",
            item_code=F("item__item_code"),
            item_name=F("item__item_name"),
            uom=F("item__uom"),
        )
        .annotate(
            total_entries=Count("id"),
            **_status_counts(),
            total_variance_value=Coalesce(
                Sum(Abs(F("variance_value"))),
                Value(
                    ZERO,
                    output_field=_VALUE_FIELD,
                ),
            ),
            sites_affected=Count(
                "period__site_id",
                distinct=True,
                filter=Q(
                    status__in=[
                        ReconciliationEntryStatus.WATCH,
                        ReconciliationEntryStatus.OVER_TOLERANCE,
                    ],
                ),
            ),
        )
        .order_by(
            "-over_tolerance_count",
            "-watch_count",
            "-total_variance_value",
        )
    )
    return list(rows)


def company_summary(*, period_month) -> dict:
    entries = _entries_for_month(period_month)
    totals = entries.aggregate(
        total_entries=Count("id"),
        **_status_counts(),
        total_variance_value=Coalesce(
            Sum(Abs(F("variance_value"))),
            Value(ZERO, output_field=_VALUE_FIELD),
        ),
    )

    flag_totals = dict(
        ReconciliationFlag.objects.filter(
            period__period_month=period_month,
            period__is_deleted=False,
        )
        .values_list("flag_type")
        .annotate(count=Count("id"))
    )

    total_sites = Site.objects.filter(
        is_active=True,
    ).count()
    sites_reporting = (
        entries.values("period__site_id")
        .distinct()
        .count()
    )

    return {
        **totals,
        "flag_totals": flag_totals,
        "total_sites": total_sites,
        "sites_reporting": sites_reporting,
        "sites_not_reporting": max(
            total_sites - sites_reporting,
            0,
        ),
    }


def company_trend(
    *,
    as_of_month,
    months: int = 6,
) -> list[dict]:
    """
    Company-wide status counts for the trailing ``months`` months
    ending at (and including) ``as_of_month``, oldest first - the
    shape a recharts line/bar chart expects.
    """
    month_list = []
    cursor = as_of_month
    for _ in range(months):
        month_list.append(cursor)
        cursor = (cursor - timedelta(days=1)).replace(
            day=1,
        )
    month_list.reverse()

    rows = []
    for month in month_list:
        totals = _entries_for_month(month).aggregate(
            **_status_counts(),
        )
        rows.append(
            {
                "month": month.isoformat()[:7],
                **totals,
            }
        )
    return rows


# --------------------------------------------------------------------
# Detail behind each summary card on the Reports page: click a card,
# see the sites or entries it counts (and open a site's statement).
# --------------------------------------------------------------------

ENTRY_LIMIT = 500

SITE_CARDS = (
    "sites_reporting",
    "total_entries",
    "total_variance",
    "largest_variance",
)
ENTRY_CARDS = {
    "over_tolerance": (
        ReconciliationEntryStatus.OVER_TOLERANCE
    ),
    "watch": ReconciliationEntryStatus.WATCH,
    "within_tolerance": (
        ReconciliationEntryStatus.WITHIN_TOLERANCE
    ),
}
CARD_KINDS = SITE_CARDS + tuple(ENTRY_CARDS)


def _site_rows(period_month, *, include_unreported):
    reported = site_variance_summary(period_month=period_month)
    rows = [
        {
            "site_id": row["site_id"],
            "site_code": row["site_code"],
            "site_name": row["site_name"],
            "reported": True,
            "period_status": row["period_status"],
            "total_entries": row["total_entries"],
            "over_tolerance_count": row["over_tolerance_count"],
            "watch_count": row["watch_count"],
            "within_tolerance_count": row[
                "within_tolerance_count"
            ],
            "total_variance_value": row["total_variance_value"],
            "net_variance_value": row["net_variance_value"],
        }
        for row in reported
    ]
    if not include_unreported:
        return rows

    reported_ids = {row["site_id"] for row in rows}
    period_status = dict(
        ReconciliationPeriod.objects.filter(
            period_month=period_month,
            is_deleted=False,
        ).values_list("site_id", "status")
    )
    rows.extend(
        {
            "site_id": site.id,
            "site_code": site.site_code,
            "site_name": site.site_name,
            "reported": False,
            "period_status": period_status.get(site.id, ""),
            "total_entries": 0,
            "over_tolerance_count": 0,
            "watch_count": 0,
            "within_tolerance_count": 0,
            "total_variance_value": ZERO,
            "net_variance_value": ZERO,
        }
        for site in Site.objects.filter(is_active=True).order_by(
            "site_code"
        )
        if site.id not in reported_ids
    )
    return rows


def _entry_rows(period_month, entry_status):
    entries = (
        _entries_for_month(period_month)
        .filter(status=entry_status)
        .select_related("period__site", "item")
        .order_by(Abs(F("variance_value")).desc(), "id")
    )
    total = entries.count()
    return [
        {
            "entry_id": entry.id,
            "site_id": entry.period.site_id,
            "site_code": entry.period.site.site_code,
            "site_name": entry.period.site.site_name,
            "item_code": entry.item.item_code,
            "item_name": entry.item.item_name,
            "uom": entry.item.uom,
            "actual_quantity": entry.actual_quantity,
            "theoretical_or_book_quantity": (
                entry.theoretical_or_book_quantity
            ),
            "variance_quantity": entry.variance_quantity,
            "variance_value": entry.variance_value,
            "status": entry.status,
        }
        for entry in entries[:ENTRY_LIMIT]
    ], total


def card_detail(*, kind, period_month) -> dict:
    """What one summary card counts, for the click-through panel."""
    if kind in ENTRY_CARDS:
        rows, total = _entry_rows(period_month, ENTRY_CARDS[kind])
        return {
            "kind": kind,
            "shape": "entries",
            "rows": rows,
            "total": total,
            "truncated": total > len(rows),
        }

    rows = _site_rows(
        period_month, include_unreported=kind == "sites_reporting"
    )
    if kind == "total_entries":
        rows.sort(key=lambda row: -row["total_entries"])
    return {
        "kind": kind,
        "shape": "sites",
        "rows": rows,
        "total": len(rows),
        "truncated": False,
    }
