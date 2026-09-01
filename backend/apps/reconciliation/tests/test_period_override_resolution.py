from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationType,
    SiteItemConfig,
)
from apps.reconciliation.services.periods import (
    get_or_create_period,
)
from apps.reconciliation.services.resolution import (
    StandardSource,
    resolve_standard,
)


@pytest.fixture
def company():
    return Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )


@pytest.fixture
def site(company):
    return Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )


@pytest.fixture
def other_site(company):
    return Site.objects.create(
        company=company,
        site_code="JPR",
        site_name="Jaipur Site",
    )


@pytest.fixture
def category():
    return ItemCategory.objects.create(
        category_name="Cement",
        is_production_output=True,
    )


@pytest.fixture
def cement(category):
    return Item.objects.create(
        item_name="OPC 43 Grade Cement",
        category=category,
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )



@pytest.fixture
def april_period(site):
    return get_or_create_period(
        site=site,
        period_month=date(2026, 4, 1),
    )


@pytest.fixture
def may_period(site):
    return get_or_create_period(
        site=site,
        period_month=date(2026, 5, 1),
    )


@pytest.fixture
def standing_override(cement, site):
    return SiteItemConfig.objects.create(
        item=cement,
        site=site,
        rate=Decimal("6600.00"),
        mix_ratio=Decimal("0.30"),
        effective_from=date(2026, 1, 1),
    )


@pytest.mark.django_db
def test_period_override_beats_standing_site_override(
    cement, site, april_period, standing_override,
):
    SiteItemConfig.objects.create(
        item=cement,
        site=site,
        period=april_period,
        rate=Decimal("7000.00"),
        mix_ratio=Decimal("0.35"),
        effective_from=date(2026, 4, 1),
    )

    resolved = resolve_standard(
        item=cement,
        site=site,
        on_date=april_period.period_month,
        period=april_period,
    )
    assert resolved.source == StandardSource.SITE_PERIOD
    assert resolved.rate == Decimal("7000.00")
    assert resolved.mix_ratio == Decimal("0.35")


@pytest.mark.django_db
def test_period_override_grade_specific_beats_period_blank_grade(
    cement, site, april_period,
):
    SiteItemConfig.objects.create(
        item=cement,
        site=site,
        period=april_period,
        rate=Decimal("7000.00"),
        mix_ratio=Decimal("0.35"),
        effective_from=date(2026, 4, 1),
    )
    SiteItemConfig.objects.create(
        item=cement,
        site=site,
        period=april_period,
        grade_label="M25",
        rate=Decimal("7200.00"),
        mix_ratio=Decimal("0.42"),
        effective_from=date(2026, 4, 1),
    )

    resolved = resolve_standard(
        item=cement,
        site=site,
        on_date=april_period.period_month,
        period=april_period,
        grade_label="M25",
    )
    assert resolved.mix_ratio == Decimal("0.42")

    blank_grade = resolve_standard(
        item=cement,
        site=site,
        on_date=april_period.period_month,
        period=april_period,
        grade_label="M20",
    )
    assert blank_grade.mix_ratio == Decimal("0.35")


@pytest.mark.django_db
def test_period_override_does_not_leak_into_a_different_period(
    cement, site, april_period, may_period, standing_override,
):
    SiteItemConfig.objects.create(
        item=cement,
        site=site,
        period=april_period,
        rate=Decimal("7000.00"),
        mix_ratio=Decimal("0.35"),
        effective_from=date(2026, 4, 1),
    )

    resolved = resolve_standard(
        item=cement,
        site=site,
        on_date=may_period.period_month,
        period=may_period,
    )
    # May has no month-only override of its own - falls back to the
    # standing site override, not April's month-only figures.
    assert resolved.source == StandardSource.SITE
    assert resolved.rate == Decimal("6600.00")


@pytest.mark.django_db
def test_resolve_standard_without_period_ignores_month_only_overrides(
    cement, site, april_period, standing_override,
):
    SiteItemConfig.objects.create(
        item=cement,
        site=site,
        period=april_period,
        rate=Decimal("7000.00"),
        mix_ratio=Decimal("0.35"),
        effective_from=date(2026, 4, 1),
    )

    # A caller with no concrete period on hand (period=None, the
    # default) should behave exactly as before this tier existed.
    resolved = resolve_standard(
        item=cement,
        site=site,
        on_date=april_period.period_month,
    )
    assert resolved.source == StandardSource.SITE
    assert resolved.rate == Decimal("6600.00")


@pytest.mark.django_db
def test_standing_and_period_override_can_both_be_active(
    cement, site, april_period, standing_override,
):
    period_override = SiteItemConfig.objects.create(
        item=cement,
        site=site,
        period=april_period,
        rate=Decimal("7000.00"),
        mix_ratio=Decimal("0.35"),
        effective_from=date(2026, 4, 1),
    )

    standing_override.refresh_from_db()
    period_override.refresh_from_db()
    assert standing_override.is_active
    assert period_override.is_active


@pytest.mark.django_db
def test_only_one_active_override_per_exact_period(
    cement, site, april_period,
):
    SiteItemConfig.objects.create(
        item=cement,
        site=site,
        period=april_period,
        rate=Decimal("7000.00"),
        mix_ratio=Decimal("0.35"),
        effective_from=date(2026, 4, 1),
    )

    with pytest.raises(ValidationError):
        SiteItemConfig.objects.create(
            item=cement,
            site=site,
            period=april_period,
            rate=Decimal("7100.00"),
            mix_ratio=Decimal("0.36"),
            effective_from=date(2026, 4, 5),
        )


@pytest.mark.django_db
def test_period_must_belong_to_the_selected_site(
    cement, site, other_site, april_period,
):
    with pytest.raises(ValidationError):
        SiteItemConfig.objects.create(
            item=cement,
            site=other_site,
            period=april_period,
            rate=Decimal("7000.00"),
            mix_ratio=Decimal("0.35"),
            effective_from=date(2026, 4, 1),
        )


@pytest.mark.django_db
def test_variance_computation_uses_period_override(
    cement, category, april_period, standing_override,
):
    SiteItemConfig.objects.create(
        item=cement,
        site=april_period.site,
        period=april_period,
        rate=Decimal("7000.00"),
        mix_ratio=Decimal("0.40"),
        effective_from=date(2026, 4, 1),
    )
    april_period.output_entries.create(
        category=category,
        output_quantity=Decimal("100.000"),
    )

    # theoretical = 100 * 0.40 (period override) = 40, not
    # 100 * 0.30 (standing override).
    entry = april_period.entries.create(
        item=cement,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("0.000"),
    )

    assert entry.theoretical_or_book_quantity == (
        Decimal("40.000")
    )


@pytest.mark.django_db
def test_company_default_still_wins_when_neither_tier_configured(
    cement, site, april_period,
):
    ItemStandard.objects.create(
        item=cement,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )

    resolved = resolve_standard(
        item=cement,
        site=site,
        on_date=april_period.period_month,
        period=april_period,
    )
    assert resolved.source == (
        StandardSource.COMPANY_DEFAULT
    )
    assert resolved.rate == Decimal("6500.00")
