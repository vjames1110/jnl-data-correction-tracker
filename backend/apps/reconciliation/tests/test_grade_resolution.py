from datetime import date
from decimal import Decimal

import pytest

from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationEntryStatus,
    ReconciliationFlagType,
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
def category():
    return ItemCategory.objects.create(
        category_name="Cement",
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
def period(site):
    return get_or_create_period(
        site=site,
        period_month=date(2026, 4, 1),
    )


@pytest.mark.django_db
def test_grade_specific_company_standard_wins_over_blank(
    cement, site,
):
    ItemStandard.objects.create(
        item=cement,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )
    ItemStandard.objects.create(
        item=cement,
        grade_label="M25",
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.38"),
        effective_from=date(2026, 1, 1),
    )

    m25 = resolve_standard(
        item=cement,
        site=site,
        on_date=date(2026, 4, 15),
        grade_label="M25",
    )
    assert m25.mix_ratio == Decimal("0.38")
    assert m25.source == (
        StandardSource.COMPANY_DEFAULT
    )

    m20 = resolve_standard(
        item=cement,
        site=site,
        on_date=date(2026, 4, 15),
        grade_label="M20",
    )
    assert m20.mix_ratio == Decimal("0.32")


@pytest.mark.django_db
def test_grade_matching_is_case_insensitive(
    cement, site,
):
    ItemStandard.objects.create(
        item=cement,
        grade_label="M25",
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.38"),
        effective_from=date(2026, 1, 1),
    )

    resolved = resolve_standard(
        item=cement,
        site=site,
        on_date=date(2026, 4, 15),
        grade_label="m25",
    )
    assert resolved.mix_ratio == Decimal("0.38")


@pytest.mark.django_db
def test_site_blank_grade_beats_company_grade_specific(
    cement, site,
):
    ItemStandard.objects.create(
        item=cement,
        grade_label="M25",
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.38"),
        effective_from=date(2026, 1, 1),
    )
    SiteItemConfig.objects.create(
        item=cement,
        site=site,
        rate=Decimal("6600.00"),
        mix_ratio=Decimal("0.30"),
        effective_from=date(2026, 1, 1),
    )

    resolved = resolve_standard(
        item=cement,
        site=site,
        on_date=date(2026, 4, 15),
        grade_label="M25",
    )
    assert resolved.source == StandardSource.SITE
    assert resolved.mix_ratio == Decimal("0.30")


@pytest.mark.django_db
def test_site_grade_specific_beats_site_blank(
    cement, site,
):
    SiteItemConfig.objects.create(
        item=cement,
        site=site,
        rate=Decimal("6600.00"),
        mix_ratio=Decimal("0.30"),
        effective_from=date(2026, 1, 1),
    )
    SiteItemConfig.objects.create(
        item=cement,
        site=site,
        grade_label="M25",
        rate=Decimal("6600.00"),
        mix_ratio=Decimal("0.39"),
        effective_from=date(2026, 1, 1),
    )

    resolved = resolve_standard(
        item=cement,
        site=site,
        on_date=date(2026, 4, 15),
        grade_label="M25",
    )
    assert resolved.mix_ratio == Decimal("0.39")


@pytest.mark.django_db
def test_variance_uses_grade_specific_ratios_per_output_batch(
    cement, period,
):
    ItemStandard.objects.create(
        item=cement,
        grade_label="M20",
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.30"),
        effective_from=date(2026, 1, 1),
    )
    ItemStandard.objects.create(
        item=cement,
        grade_label="M25",
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.40"),
        effective_from=date(2026, 1, 1),
    )

    period.output_entries.create(
        item=cement,
        grade_label="M20",
        output_quantity=Decimal("100.000"),
    )
    period.output_entries.create(
        item=cement,
        grade_label="M25",
        output_quantity=Decimal("50.000"),
    )

    # theoretical = 100*0.30 + 50*0.40 = 30 + 20 = 50
    entry = period.entries.create(
        item=cement,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("40.000"),
        closing_stock=Decimal("0.000"),
    )

    assert entry.actual_quantity == Decimal(
        "50.000"
    )
    assert (
        entry.theoretical_or_book_quantity
        == Decimal("50.000")
    )
    assert entry.variance_quantity == Decimal(
        "0.000"
    )
    assert (
        entry.status
        == ReconciliationEntryStatus.WITHIN_TOLERANCE
    )


@pytest.mark.django_db
def test_variance_falls_back_to_blank_grade_when_no_grade_match(
    cement, period,
):
    ItemStandard.objects.create(
        item=cement,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )

    period.output_entries.create(
        item=cement,
        grade_label="M30",
        output_quantity=Decimal("100.000"),
    )

    entry = period.entries.create(
        item=cement,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("8.000"),
    )

    assert (
        entry.theoretical_or_book_quantity
        == Decimal("32.000")
    )


@pytest.mark.django_db
def test_variance_not_calculated_when_grade_unconfigured(
    cement, period,
):
    ItemStandard.objects.create(
        item=cement,
        grade_label="M20",
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.30"),
        effective_from=date(2026, 1, 1),
    )

    period.output_entries.create(
        item=cement,
        grade_label="M45",
        output_quantity=Decimal("100.000"),
    )

    entry = period.entries.create(
        item=cement,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("8.000"),
    )

    assert (
        entry.status
        == ReconciliationEntryStatus.NOT_CALCULATED
    )
    flag = entry.flags.get()
    assert (
        flag.flag_type
        == ReconciliationFlagType.MISSING_MIX_OR_RATE
    )


@pytest.mark.django_db
def test_variance_value_uses_weighted_average_rate_across_grades(
    cement, period,
):
    ItemStandard.objects.create(
        item=cement,
        grade_label="M20",
        rate=Decimal("6000.00"),
        mix_ratio=Decimal("0.30"),
        effective_from=date(2026, 1, 1),
    )
    ItemStandard.objects.create(
        item=cement,
        grade_label="M25",
        rate=Decimal("8000.00"),
        mix_ratio=Decimal("0.40"),
        effective_from=date(2026, 1, 1),
    )

    period.output_entries.create(
        item=cement,
        grade_label="M20",
        output_quantity=Decimal("100.000"),
    )
    period.output_entries.create(
        item=cement,
        grade_label="M25",
        output_quantity=Decimal("100.000"),
    )

    # theoretical = 100*0.30 + 100*0.40 = 70
    # weighted rate = (100*6000 + 100*8000) / 200 = 7000
    # actual = 10+30-0 = 40 - the site used less than the recipe
    # called for, so variance (theoretical - actual) is a positive
    # "profit": 70-40 = 30
    # variance_value = 30 * 7000 = 210000.00
    entry = period.entries.create(
        item=cement,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("0.000"),
    )

    assert entry.variance_quantity == Decimal(
        "30.000"
    )
    assert entry.variance_value == Decimal(
        "210000.00"
    )
