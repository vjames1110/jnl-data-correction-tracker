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
        is_production_output=True,
    )


@pytest.fixture
def cement(category):
    item = Item.objects.create(
        item_name="OPC 43 Grade Cement",
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    item.categories.add(category)
    return item


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
def test_variance_uses_exact_grade_ratio_per_entry(
    cement, category, period,
):
    # Each grade produced this period gets its own output batch AND
    # its own material entry - no blending across grades. M20's
    # entry only ever sees the M20 output batch/ratio, M25's entry
    # only ever sees M25's.
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
        category=category,
        grade_label="M20",
        output_quantity=Decimal("100.000"),
    )
    period.output_entries.create(
        category=category,
        grade_label="M25",
        output_quantity=Decimal("50.000"),
    )

    # theoretical(M20) = 100*0.30 = 30, actual = 5+25-0 = 30
    m20_entry = period.entries.create(
        item=cement,
        category=category,
        grade_label="M20",
        opening_stock=Decimal("5.000"),
        receipts=Decimal("25.000"),
        closing_stock=Decimal("0.000"),
    )
    # theoretical(M25) = 50*0.40 = 20, actual = 5+15-0 = 20
    m25_entry = period.entries.create(
        item=cement,
        category=category,
        grade_label="M25",
        opening_stock=Decimal("5.000"),
        receipts=Decimal("15.000"),
        closing_stock=Decimal("0.000"),
    )

    assert m20_entry.actual_quantity == Decimal(
        "30.000"
    )
    assert (
        m20_entry.theoretical_or_book_quantity
        == Decimal("30.000")
    )
    assert m20_entry.variance_quantity == Decimal(
        "0.000"
    )
    assert (
        m20_entry.status
        == ReconciliationEntryStatus.WITHIN_TOLERANCE
    )

    assert m25_entry.actual_quantity == Decimal(
        "20.000"
    )
    assert (
        m25_entry.theoretical_or_book_quantity
        == Decimal("20.000")
    )
    assert m25_entry.variance_quantity == Decimal(
        "0.000"
    )
    assert (
        m25_entry.status
        == ReconciliationEntryStatus.WITHIN_TOLERANCE
    )


@pytest.mark.django_db
def test_variance_falls_back_to_blank_grade_standard_when_no_grade_match(
    cement, category, period,
):
    # No M30-specific rate/mix is configured, so an M30 entry falls
    # back to the blank-grade company standard - a different tier
    # (resolve_standard's own fallback), not blending across other
    # grades' output.
    ItemStandard.objects.create(
        item=cement,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )

    period.output_entries.create(
        category=category,
        grade_label="M30",
        output_quantity=Decimal("100.000"),
    )

    entry = period.entries.create(
        item=cement,
        category=category,
        grade_label="M30",
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
    cement, category, period,
):
    ItemStandard.objects.create(
        item=cement,
        grade_label="M20",
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.30"),
        effective_from=date(2026, 1, 1),
    )

    period.output_entries.create(
        category=category,
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
def test_variance_value_uses_this_entrys_own_grade_rate(
    cement, category, period,
):
    # Each grade's entry is priced at its OWN grade's rate - no
    # averaging across other grades produced the same period.
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
        category=category,
        grade_label="M20",
        output_quantity=Decimal("100.000"),
    )
    period.output_entries.create(
        category=category,
        grade_label="M25",
        output_quantity=Decimal("100.000"),
    )

    # theoretical(M20) = 100*0.30 = 30, actual = 5+20-0 = 25 - a
    # saving of 5, priced at M20's own rate of 6000.
    m20_entry = period.entries.create(
        item=cement,
        category=category,
        grade_label="M20",
        opening_stock=Decimal("5.000"),
        receipts=Decimal("20.000"),
        closing_stock=Decimal("0.000"),
    )
    # theoretical(M25) = 100*0.40 = 40, actual = 5+30-0 = 35 - a
    # saving of 5, priced at M25's own rate of 8000.
    m25_entry = period.entries.create(
        item=cement,
        category=category,
        grade_label="M25",
        opening_stock=Decimal("5.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("0.000"),
    )

    assert m20_entry.variance_quantity == Decimal(
        "5.000"
    )
    assert m20_entry.variance_value == Decimal(
        "30000.00"
    )

    assert m25_entry.variance_quantity == Decimal(
        "5.000"
    )
    assert m25_entry.variance_value == Decimal(
        "40000.00"
    )
