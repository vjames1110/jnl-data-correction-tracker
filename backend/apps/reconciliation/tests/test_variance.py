from datetime import date
from decimal import Decimal

import pytest

from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationEntry,
    ReconciliationEntryStatus,
    ReconciliationFlagType,
    ReconciliationOutputEntry,
    ReconciliationPeriod,
    ReconciliationType,
    SiteItemConfig,
)


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
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
def norm_based_item(category):
    return Item.objects.create(
        item_name="OPC 43 Grade Cement",
        category=category,
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )


@pytest.fixture
def direct_count_item(category):
    return Item.objects.create(
        item_name="TMT Steel Bars",
        category=category,
        reconciliation_type=(
            ReconciliationType.DIRECT_COUNT
        ),
        uom="MT",
    )


@pytest.fixture
def period(site):
    return ReconciliationPeriod.objects.create(
        site=site,
        period_month=date(2026, 4, 1),
    )


@pytest.mark.django_db
def test_norm_based_entry_computes_variance_against_output(
    norm_based_item,
    period,
):
    ItemStandard.objects.create(
        item=norm_based_item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )
    ReconciliationOutputEntry.objects.create(
        period=period,
        item=norm_based_item,
        output_quantity=Decimal("100.000"),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=norm_based_item,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("8.000"),
    )

    assert entry.actual_quantity == Decimal(
        "32.000"
    )
    assert (
        entry.theoretical_or_book_quantity
        == Decimal("32.000")
    )
    assert entry.variance_quantity == Decimal(
        "0.000"
    )
    assert (
        entry.status
        == ReconciliationEntryStatus.WITHIN_TOLERANCE
    )
    assert not entry.flags.exists()


@pytest.mark.django_db
def test_direct_count_entry_computes_variance(
    direct_count_item,
    period,
):
    ItemStandard.objects.create(
        item=direct_count_item,
        rate=Decimal("55000.00"),
        effective_from=date(2026, 1, 1),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=direct_count_item,
        book_stock=Decimal("50.000"),
        physical_count=Decimal("48.000"),
    )

    assert entry.actual_quantity == Decimal(
        "48.000"
    )
    assert (
        entry.theoretical_or_book_quantity
        == Decimal("50.000")
    )
    assert entry.variance_quantity == Decimal(
        "-2.000"
    )
    assert entry.variance_value == Decimal(
        "-2.000"
    ) * Decimal("55000.00")


@pytest.mark.django_db
def test_missing_standard_flags_entry_not_calculated(
    direct_count_item,
    period,
):
    entry = ReconciliationEntry.objects.create(
        period=period,
        item=direct_count_item,
        book_stock=Decimal("50.000"),
        physical_count=Decimal("48.000"),
    )

    assert (
        entry.status
        == ReconciliationEntryStatus.NOT_CALCULATED
    )
    flag_types = set(
        entry.flags.values_list(
            "flag_type",
            flat=True,
        )
    )
    assert flag_types == {
        ReconciliationFlagType.MISSING_MIX_OR_RATE
    }


@pytest.mark.django_db
def test_negative_actual_consumption_is_flagged(
    norm_based_item,
    period,
):
    ItemStandard.objects.create(
        item=norm_based_item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=norm_based_item,
        opening_stock=Decimal("5.000"),
        receipts=Decimal("0.000"),
        closing_stock=Decimal("20.000"),
    )

    assert entry.actual_quantity == Decimal(
        "-15.000"
    )
    flag_types = set(
        entry.flags.values_list(
            "flag_type",
            flat=True,
        )
    )
    assert (
        ReconciliationFlagType.NEGATIVE_CONSUMPTION
        in flag_types
    )


@pytest.mark.django_db
def test_consumption_without_output_is_flagged(
    norm_based_item,
    period,
):
    ItemStandard.objects.create(
        item=norm_based_item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=norm_based_item,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("8.000"),
    )

    assert entry.actual_quantity == Decimal(
        "32.000"
    )
    flag_types = set(
        entry.flags.values_list(
            "flag_type",
            flat=True,
        )
    )
    assert (
        ReconciliationFlagType.NO_MATCHING_PRODUCTION
        in flag_types
    )


@pytest.mark.django_db
def test_over_tolerance_status_and_flag(
    direct_count_item,
    period,
):
    ItemStandard.objects.create(
        item=direct_count_item,
        rate=Decimal("55000.00"),
        effective_from=date(2026, 1, 1),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=direct_count_item,
        book_stock=Decimal("100.000"),
        physical_count=Decimal("50.000"),
    )

    assert (
        entry.status
        == ReconciliationEntryStatus.OVER_TOLERANCE
    )
    flag_types = set(
        entry.flags.values_list(
            "flag_type",
            flat=True,
        )
    )
    assert (
        ReconciliationFlagType.OVER_TOLERANCE
        in flag_types
    )


@pytest.mark.django_db
def test_site_override_used_over_company_default(
    norm_based_item,
    period,
    site,
):
    ItemStandard.objects.create(
        item=norm_based_item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )
    SiteItemConfig.objects.create(
        item=norm_based_item,
        site=site,
        rate=Decimal("7000.00"),
        mix_ratio=Decimal("0.30"),
        effective_from=date(2026, 3, 1),
    )
    ReconciliationOutputEntry.objects.create(
        period=period,
        item=norm_based_item,
        output_quantity=Decimal("100.000"),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=norm_based_item,
        opening_stock=Decimal("0.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("0.000"),
    )

    assert (
        entry.theoretical_or_book_quantity
        == Decimal("30.000")
    )
    assert entry.variance_value == (
        Decimal("30.000") - Decimal("30.000")
    ) * Decimal("7000.00")


@pytest.mark.django_db
def test_partial_direct_count_entry_stays_not_calculated_without_flag(
    direct_count_item,
    period,
):
    ItemStandard.objects.create(
        item=direct_count_item,
        rate=Decimal("55000.00"),
        effective_from=date(2026, 1, 1),
    )

    # Book stock arrives via CSV import before the
    # store person records a physical count.
    entry = ReconciliationEntry.objects.create(
        period=period,
        item=direct_count_item,
        book_stock=Decimal("50.000"),
    )

    assert (
        entry.status
        == ReconciliationEntryStatus.NOT_CALCULATED
    )
    assert entry.actual_quantity is None
    assert not entry.flags.exists()

    entry.physical_count = Decimal("48.000")
    entry.save()

    assert (
        entry.status
        != ReconciliationEntryStatus.NOT_CALCULATED
    )
    assert entry.actual_quantity == Decimal(
        "48.000"
    )
    assert entry.variance_quantity == Decimal(
        "-2.000"
    )


@pytest.mark.django_db
def test_resolved_rate_snapshotted_on_entry(
    direct_count_item,
    period,
):
    ItemStandard.objects.create(
        item=direct_count_item,
        rate=Decimal("55000.00"),
        effective_from=date(2026, 1, 1),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=direct_count_item,
        book_stock=Decimal("50.000"),
        physical_count=Decimal("48.000"),
    )

    assert entry.resolved_rate == Decimal(
        "55000.00"
    )


@pytest.mark.django_db
def test_resolved_rate_none_when_not_calculated(
    direct_count_item,
    period,
):
    entry = ReconciliationEntry.objects.create(
        period=period,
        item=direct_count_item,
        book_stock=Decimal("50.000"),
        physical_count=Decimal("48.000"),
    )

    assert entry.resolved_rate is None
    assert (
        entry.status
        == ReconciliationEntryStatus.NOT_CALCULATED
    )


@pytest.mark.django_db
def test_section_and_rack_are_optional_and_normalized(
    direct_count_item,
    norm_based_item,
    period,
):
    ItemStandard.objects.create(
        item=direct_count_item,
        rate=Decimal("55000.00"),
        effective_from=date(2026, 1, 1),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=direct_count_item,
        book_stock=Decimal("50.000"),
        physical_count=Decimal("48.000"),
        section="  Section  A  ",
        rack="  Rack 3 ",
    )

    assert entry.section == "Section A"
    assert entry.rack == "Rack 3"

    entry_no_location = (
        ReconciliationEntry.objects.create(
            period=period,
            item=norm_based_item,
        )
    )
    assert entry_no_location.section == ""
    assert entry_no_location.rack == ""


@pytest.mark.django_db
def test_output_entry_serializer_exposes_resolved_mix_ratio(
    norm_based_item,
    period,
    site,
):
    from apps.reconciliation.api.serializers import (
        ReconciliationOutputEntrySerializer,
    )

    ItemStandard.objects.create(
        item=norm_based_item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )
    SiteItemConfig.objects.create(
        item=norm_based_item,
        site=site,
        grade_label="M20",
        rate=Decimal("7000.00"),
        mix_ratio=Decimal("0.35"),
        effective_from=date(2026, 3, 1),
    )
    output = ReconciliationOutputEntry.objects.create(
        period=period,
        item=norm_based_item,
        grade_label="M20",
        output_quantity=Decimal("100.000"),
    )

    data = ReconciliationOutputEntrySerializer(
        output
    ).data

    assert data["resolved_mix_ratio"] == Decimal(
        "0.350000"
    )


@pytest.mark.django_db
def test_output_entry_change_recomputes_existing_entry(
    norm_based_item,
    period,
):
    ItemStandard.objects.create(
        item=norm_based_item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.50"),
        effective_from=date(2026, 1, 1),
    )
    entry = ReconciliationEntry.objects.create(
        period=period,
        item=norm_based_item,
        opening_stock=Decimal("0.000"),
        receipts=Decimal("50.000"),
        closing_stock=Decimal("0.000"),
    )
    assert (
        entry.theoretical_or_book_quantity
        == Decimal("0.000")
    )

    output = (
        ReconciliationOutputEntry.objects.create(
            period=period,
            item=norm_based_item,
            output_quantity=Decimal("100.000"),
        )
    )

    entry.refresh_from_db()
    assert (
        entry.theoretical_or_book_quantity
        == Decimal("50.000")
    )

    output.delete()

    entry.refresh_from_db()
    assert (
        entry.theoretical_or_book_quantity
        == Decimal("0.000")
    )
