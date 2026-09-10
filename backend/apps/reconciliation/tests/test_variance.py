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
    # Flagged as a production type so output entries can be logged
    # against it directly - every item created under it (below) is
    # then one of its recipe materials.
    return ItemCategory.objects.create(
        category_name="Cement",
        is_production_output=True,
    )


@pytest.fixture
def norm_based_item(category):
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
def direct_count_item(category):
    item = Item.objects.create(
        item_name="TMT Steel Bars",
        reconciliation_type=(
            ReconciliationType.DIRECT_COUNT
        ),
        uom="MT",
    )
    item.categories.add(category)
    return item


@pytest.fixture
def period(site):
    return ReconciliationPeriod.objects.create(
        site=site,
        period_month=date(2026, 4, 1),
    )


@pytest.mark.django_db
def test_norm_based_entry_computes_variance_against_output(
    norm_based_item,
    category,
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
        category=category,
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
def test_norm_based_saving_is_a_positive_profit_variance(
    norm_based_item,
    category,
    period,
):
    # Recipe calls for 32 MT (100 * 0.32); the site only used 22 MT
    # - a saving against the recipe, which should read as a
    # positive "profit" figure, not a negative one.
    ItemStandard.objects.create(
        item=norm_based_item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )
    ReconciliationOutputEntry.objects.create(
        period=period,
        category=category,
        output_quantity=Decimal("100.000"),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=norm_based_item,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("20.000"),
        closing_stock=Decimal("8.000"),
    )

    assert entry.actual_quantity == Decimal(
        "22.000"
    )
    assert entry.variance_quantity == Decimal(
        "10.000"
    )
    assert entry.variance_value == Decimal(
        "65000.00"
    )


@pytest.mark.django_db
def test_norm_based_overuse_is_a_negative_loss_variance(
    norm_based_item,
    category,
    period,
):
    # Recipe calls for 32 MT; the site used 42 MT - overuse against
    # the recipe, which should read as a negative "loss" figure.
    ItemStandard.objects.create(
        item=norm_based_item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )
    ReconciliationOutputEntry.objects.create(
        period=period,
        category=category,
        output_quantity=Decimal("100.000"),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=norm_based_item,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("40.000"),
        closing_stock=Decimal("8.000"),
    )

    assert entry.actual_quantity == Decimal(
        "42.000"
    )
    assert entry.variance_quantity == Decimal(
        "-10.000"
    )
    assert entry.variance_value == Decimal(
        "-65000.00"
    )


@pytest.mark.django_db
def test_direct_count_shortage_is_a_negative_loss_variance(
    direct_count_item,
    period,
):
    # Physically counting LESS than book stock is a shortage - a
    # loss - unlike the norm-based case, this direction is NOT
    # flipped: book stock is a recorded quantity, not a target to
    # beat.
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

    assert entry.variance_quantity == Decimal(
        "-2.000"
    )
    assert entry.variance_value == Decimal(
        "-110000.00"
    )


@pytest.mark.django_db
def test_direct_count_surplus_is_a_positive_variance(
    direct_count_item,
    period,
):
    # Physically counting MORE than book stock records - a surplus.
    ItemStandard.objects.create(
        item=direct_count_item,
        rate=Decimal("55000.00"),
        effective_from=date(2026, 1, 1),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=direct_count_item,
        book_stock=Decimal("50.000"),
        physical_count=Decimal("53.000"),
    )

    assert entry.variance_quantity == Decimal(
        "3.000"
    )
    assert entry.variance_value == Decimal(
        "165000.00"
    )


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
    category,
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
        category=category,
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
def test_entry_serializer_exposes_mix_ratio_by_grade(
    norm_based_item,
    category,
    period,
    site,
):
    # Production output is no longer logged per material, so the
    # per-grade mix ratio a material used is exposed on the
    # material's own reconciliation entry instead of on the output
    # entry - this is what the statement/multi-site pack now rebuild
    # the Design Mix table from.
    from apps.reconciliation.api.serializers import (
        ReconciliationEntrySerializer,
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
    ReconciliationOutputEntry.objects.create(
        period=period,
        category=category,
        grade_label="M20",
        output_quantity=Decimal("100.000"),
    )
    entry = ReconciliationEntry.objects.create(
        period=period,
        item=norm_based_item,
        opening_stock=Decimal("0.000"),
        receipts=Decimal("35.000"),
        closing_stock=Decimal("0.000"),
    )

    data = ReconciliationEntrySerializer(
        entry
    ).data

    assert data["mix_ratio_by_grade"] == {
        "M20": Decimal("0.350000"),
    }


@pytest.mark.django_db
def test_material_in_many_grade_categories_resolves_every_configured_ratio(
    period, site,
):
    # Regression: a material used across several grade-scoped
    # categories (each producing its own grade this month) used to
    # show "Not configured" for every grade but the one its single
    # arbitrarily-picked entry knew about. With one entry per
    # material, and mix_ratio_by_grade covering every grade the
    # material actually participates in, all configured ratios show.
    from apps.reconciliation.api.serializers import (
        ReconciliationEntrySerializer,
    )

    cat_m10 = ItemCategory.objects.create(
        category_name="Concrete M10",
        is_production_output=True,
    )
    cat_m20 = ItemCategory.objects.create(
        category_name="Concrete M20",
        is_production_output=True,
    )
    aggregate = Item.objects.create(
        item_name="10mm Aggregate",
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    aggregate.categories.set([cat_m10, cat_m20])

    for grade, ratio in (
        ("M10", Decimal("0.50")),
        ("M20", Decimal("0.849")),
    ):
        SiteItemConfig.objects.create(
            item=aggregate,
            site=site,
            grade_label=grade,
            rate=Decimal("639.00"),
            mix_ratio=ratio,
            effective_from=date(2026, 1, 1),
        )

    ReconciliationOutputEntry.objects.create(
        period=period,
        category=cat_m10,
        grade_label="M10",
        output_quantity=Decimal("6.120"),
    )
    ReconciliationOutputEntry.objects.create(
        period=period,
        category=cat_m20,
        grade_label="M20",
        output_quantity=Decimal("1439.100"),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=aggregate,
        opening_stock=Decimal("560.000"),
        receipts=Decimal("1504.330"),
        closing_stock=Decimal("652.700"),
    )

    # theoretical = 6.120*0.50 + 1439.100*0.849
    #            = 3.060 + 1221.7959 = 1224.856 (quantized)
    assert (
        entry.theoretical_or_book_quantity
        == Decimal("1224.856")
    )

    data = ReconciliationEntrySerializer(entry).data
    assert data["mix_ratio_by_grade"] == {
        "M10": Decimal("0.500000"),
        "M20": Decimal("0.849000"),
    }
    assert not any(
        v is None
        for v in data[
            "mix_ratio_by_grade"
        ].values()
    )


@pytest.mark.django_db
def test_missing_ratio_for_one_produced_grade_is_flagged_but_still_computes(
    period, site,
):
    from apps.reconciliation.models import (
        ReconciliationFlagType,
    )

    cat_m10 = ItemCategory.objects.create(
        category_name="Concrete M10",
        is_production_output=True,
    )
    cat_m30 = ItemCategory.objects.create(
        category_name="Concrete M30",
        is_production_output=True,
    )
    aggregate = Item.objects.create(
        item_name="10mm Aggregate",
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    aggregate.categories.set([cat_m10, cat_m30])

    # Only M10 has a mix ratio; M30 does not.
    SiteItemConfig.objects.create(
        item=aggregate,
        site=site,
        grade_label="M10",
        rate=Decimal("639.00"),
        mix_ratio=Decimal("0.50"),
        effective_from=date(2026, 1, 1),
    )

    ReconciliationOutputEntry.objects.create(
        period=period,
        category=cat_m10,
        grade_label="M10",
        output_quantity=Decimal("100.000"),
    )
    ReconciliationOutputEntry.objects.create(
        period=period,
        category=cat_m30,
        grade_label="M30",
        output_quantity=Decimal("50.000"),
    )

    entry = ReconciliationEntry.objects.create(
        period=period,
        item=aggregate,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("40.000"),
        closing_stock=Decimal("0.000"),
    )

    # Only M10 contributes: 100 * 0.50 = 50 (M30 skipped, flagged).
    assert (
        entry.theoretical_or_book_quantity
        == Decimal("50.000")
    )
    flag = entry.flags.get(
        flag_type=(
            ReconciliationFlagType.MISSING_MIX_OR_RATE
        )
    )
    assert "M30" in flag.message


@pytest.mark.django_db
def test_output_entry_change_recomputes_existing_entry(
    norm_based_item,
    category,
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
            category=category,
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


@pytest.mark.django_db
def test_output_entry_rejects_a_non_production_category(
    period,
):
    from django.core.exceptions import (
        ValidationError,
    )

    plain_category = ItemCategory.objects.create(
        category_name="Plain Materials",
    )

    with pytest.raises(ValidationError):
        ReconciliationOutputEntry.objects.create(
            period=period,
            category=plain_category,
            output_quantity=Decimal("100.000"),
        )


@pytest.mark.django_db
def test_one_output_entry_drives_theoretical_for_multiple_materials(
    category,
    period,
):
    # The core of this change: ONE production-output batch (e.g. 100
    # cum of Concrete) should drive the theoretical consumption of
    # every raw material that goes into it, without the material
    # having to be entered as its own "output".
    cement = Item.objects.create(
        item_name="Cement",
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    cement.categories.add(category)
    aggregate = Item.objects.create(
        item_name="10mm Aggregate",
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    aggregate.categories.add(category)
    ItemStandard.objects.create(
        item=cement,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.30"),
        effective_from=date(2026, 1, 1),
    )
    ItemStandard.objects.create(
        item=aggregate,
        rate=Decimal("650.00"),
        mix_ratio=Decimal("1.10"),
        effective_from=date(2026, 1, 1),
    )

    ReconciliationOutputEntry.objects.create(
        period=period,
        category=category,
        output_quantity=Decimal("100.000"),
    )

    cement_entry = ReconciliationEntry.objects.create(
        period=period,
        item=cement,
        opening_stock=Decimal("0.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("0.000"),
    )
    aggregate_entry = (
        ReconciliationEntry.objects.create(
            period=period,
            item=aggregate,
            opening_stock=Decimal("0.000"),
            receipts=Decimal("110.000"),
            closing_stock=Decimal("0.000"),
        )
    )

    assert (
        cement_entry.theoretical_or_book_quantity
        == Decimal("30.000")
    )
    assert (
        aggregate_entry.theoretical_or_book_quantity
        == Decimal("110.000")
    )
