from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.utils import timezone

from apps.reconciliation.models import (
    Item,
    ItemStandard,
    SiteItemConfig,
)


class StandardSource:
    SITE_PERIOD = "SITE_PERIOD"
    SITE = "SITE"
    COMPANY_DEFAULT = "COMPANY_DEFAULT"
    NONE = "NONE"


@dataclass(frozen=True)
class ResolvedStandard:
    rate: Decimal | None
    mix_ratio: Decimal | None
    source: str


def resolve_standard(
    *,
    item: Item,
    site,
    on_date: date | None = None,
    grade_label: str = "",
    period=None,
) -> ResolvedStandard:
    """
    Resolve the effective rate/mix ratio for an item at a site,
    optionally for one specific production grade and reconciliation
    period.

    Each matching row supplies its rate and mix ratio together as a
    self-contained unit - there is no mixing of fields from two
    different rows, so "which row won" is always unambiguous.

    Resolution order (five-tier inheritance):
    1. Active month-only site override for this exact grade, scoped
       to ``period`` - the highest-priority tier, applies for one
       month only.
    2. Active month-only site override with no grade set, scoped to
       ``period``.
    3. Active standing site-level override for this exact grade.
    4. Active standing site-level override with no grade set (the
       site's blanket default, covering every grade) - the "locked
       to this site" tier.
    5. Company-wide default for this exact grade, with the latest
       ``effective_from`` on or before ``on_date``.
    6. Company-wide default with no grade set (the item's blanket
       default).
    7. Nothing configured.

    ``grade_label`` blank is equivalent to only ever considering
    tiers 2/4/6 - the existing pre-grade behaviour. ``period`` left
    unset (the default) is equivalent to skipping tiers 1-2 entirely
    - the existing pre-month-only-override behaviour, still used by
    any caller that doesn't have a concrete period on hand.
    """

    effective_date = on_date or timezone.localdate()
    grade_label = (grade_label or "").strip().upper()

    if period is not None:
        period_config = _resolve_site_config(
            item=item,
            site=site,
            grade_label=grade_label,
            period=period,
        )
        if period_config is not None:
            return ResolvedStandard(
                rate=period_config.rate,
                mix_ratio=period_config.mix_ratio,
                source=StandardSource.SITE_PERIOD,
            )

    site_config = _resolve_site_config(
        item=item,
        site=site,
        grade_label=grade_label,
        period=None,
    )
    if site_config is not None:
        return ResolvedStandard(
            rate=site_config.rate,
            mix_ratio=site_config.mix_ratio,
            source=StandardSource.SITE,
        )

    company_standard = _resolve_company_standard(
        item=item,
        grade_label=grade_label,
        effective_date=effective_date,
    )
    if company_standard is not None:
        return ResolvedStandard(
            rate=company_standard.rate,
            mix_ratio=company_standard.mix_ratio,
            source=StandardSource.COMPANY_DEFAULT,
        )

    return ResolvedStandard(
        rate=None,
        mix_ratio=None,
        source=StandardSource.NONE,
    )


def _resolve_site_config(*, item, site, grade_label, period):
    base_filter = {
        "item": item,
        "site": site,
        "period": period,
        "is_active": True,
    }

    if grade_label:
        graded = (
            SiteItemConfig.objects.filter(
                grade_label=grade_label,
                **base_filter,
            )
            .order_by("-effective_from")
            .first()
        )
        if graded is not None:
            return graded

    return (
        SiteItemConfig.objects.filter(
            grade_label="",
            **base_filter,
        )
        .order_by("-effective_from")
        .first()
    )


def _resolve_company_standard(
    *, item, grade_label, effective_date
):
    if grade_label:
        graded = (
            ItemStandard.objects.filter(
                item=item,
                grade_label=grade_label,
                is_active=True,
                effective_from__lte=effective_date,
            )
            .order_by("-effective_from")
            .first()
        )
        if graded is not None:
            return graded

    return (
        ItemStandard.objects.filter(
            item=item,
            grade_label="",
            is_active=True,
            effective_from__lte=effective_date,
        )
        .order_by("-effective_from")
        .first()
    )
