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
) -> ResolvedStandard:
    """
    Resolve the effective rate/mix ratio for an item at a site,
    optionally for one specific production grade.

    Each matching row supplies its rate and mix ratio together as a
    self-contained unit - there is no mixing of fields from two
    different rows, so "which row won" is always unambiguous.

    Resolution order (four-tier inheritance):
    1. Active site-level override for this exact grade.
    2. Active site-level override with no grade set (the site's
       blanket default, covering every grade) - the "locked to this
       site" tier.
    3. Company-wide default for this exact grade, with the latest
       ``effective_from`` on or before ``on_date``.
    4. Company-wide default with no grade set (the item's blanket
       default).
    5. Nothing configured.

    ``grade_label`` blank is equivalent to only ever considering
    tiers 2 and 4 - the existing pre-grade behaviour.
    """

    effective_date = on_date or timezone.localdate()
    grade_label = (grade_label or "").strip().upper()

    site_config = _resolve_site_config(
        item=item,
        site=site,
        grade_label=grade_label,
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


def _resolve_site_config(*, item, site, grade_label):
    if grade_label:
        graded = (
            SiteItemConfig.objects.filter(
                item=item,
                site=site,
                grade_label=grade_label,
                is_active=True,
            )
            .order_by("-effective_from")
            .first()
        )
        if graded is not None:
            return graded

    return (
        SiteItemConfig.objects.filter(
            item=item,
            site=site,
            grade_label="",
            is_active=True,
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
