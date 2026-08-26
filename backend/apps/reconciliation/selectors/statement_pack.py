from collections import defaultdict

from apps.reconciliation.models import (
    ReconciliationEntry,
    ReconciliationOutputEntry,
    ReconciliationPeriod,
)


def build_statement_pack(
    *, period_month, site_id=None
) -> list[dict]:
    """
    Full entry-level statements for every site that recorded at
    least one entry this month, ordered by site name - the "combined
    multi-site pack" companion to the single-site print statement on
    Monthly Entry. Sites with no entries this month are left out,
    same as the leaderboards on the Variance Reports page.

    ``site_id`` narrows the pack to a single site (still returned in
    the same list-of-one-dict shape as the unfiltered pack) - the
    "pack" concept still applies with one site, since it's the same
    statement layout either way.
    """
    periods_query = ReconciliationPeriod.objects.filter(
        period_month=period_month,
        is_deleted=False,
    )
    if site_id:
        periods_query = periods_query.filter(
            site_id=site_id,
        )

    periods = list(
        periods_query.select_related(
            "site", "submitted_by"
        )
        .prefetch_related("approval_steps")
        .order_by("site__site_name")
    )
    period_ids = [period.id for period in periods]

    entries_by_period = defaultdict(list)
    for entry in (
        ReconciliationEntry.objects.filter(
            period_id__in=period_ids,
        )
        .select_related("item")
        .prefetch_related("flags")
        .order_by("item__item_name")
    ):
        entries_by_period[entry.period_id].append(
            entry
        )

    outputs_by_period = defaultdict(list)
    for output in (
        ReconciliationOutputEntry.objects.filter(
            period_id__in=period_ids,
        )
        .select_related("item")
        .order_by("item__item_name")
    ):
        outputs_by_period[
            output.period_id
        ].append(output)

    return [
        {
            "period": period,
            "entries": entries_by_period[
                period.id
            ],
            "output_entries": outputs_by_period[
                period.id
            ],
        }
        for period in periods
        if entries_by_period[period.id]
    ]
