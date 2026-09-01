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


@pytest.mark.django_db
def test_item_category_normalizes_and_generates_code():
    category = ItemCategory.objects.create(
        category_name=" Fuel  And  Lubricants ",
    )

    assert category.category_code == "FAL"
    assert (
        category.category_name
        == "Fuel And Lubricants"
    )


@pytest.mark.django_db
def test_item_code_is_globally_unique(
    category,
):
    # An item can now belong to more than one category, so
    # item_code can no longer be scoped per category the way it used
    # to be - it's a single, company-wide code.
    first = Item.objects.create(
        item_name="Cement",
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    first.categories.add(category)
    second_category = ItemCategory.objects.create(
        category_name="Steel",
    )
    second = Item.objects.create(
        item_name="Cement",
        reconciliation_type=(
            ReconciliationType.DIRECT_COUNT
        ),
        uom="MT",
    )
    second.categories.add(second_category)

    assert first.item_code == "CEM"
    assert second.item_code != first.item_code
    assert second.item_code.startswith("CEM")


@pytest.mark.django_db
def test_item_can_belong_to_multiple_categories(
    category,
):
    steel_category = ItemCategory.objects.create(
        category_name="Steel",
    )
    water = Item.objects.create(
        item_name="Water",
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="LTR",
    )
    water.categories.add(category, steel_category)

    assert (
        set(
            water.categories.values_list(
                "id", flat=True
            )
        )
        == {category.id, steel_category.id}
    )
    assert category.items.filter(
        id=water.id
    ).exists()
    assert steel_category.items.filter(
        id=water.id
    ).exists()


@pytest.mark.django_db
def test_norm_based_item_standard_requires_mix_ratio(
    norm_based_item,
):
    with pytest.raises(ValidationError):
        ItemStandard.objects.create(
            item=norm_based_item,
            rate=6500,
            effective_from=date(2026, 4, 1),
        )

    standard = ItemStandard.objects.create(
        item=norm_based_item,
        rate=6500,
        mix_ratio="0.32",
        effective_from=date(2026, 4, 1),
    )
    assert standard.mix_ratio == Decimal("0.32")


@pytest.mark.django_db
def test_direct_count_item_standard_rejects_mix_ratio(
    direct_count_item,
):
    with pytest.raises(ValidationError):
        ItemStandard.objects.create(
            item=direct_count_item,
            rate=55000,
            mix_ratio="1.0",
            effective_from=date(2026, 4, 1),
        )

    standard = ItemStandard.objects.create(
        item=direct_count_item,
        rate=55000,
        effective_from=date(2026, 4, 1),
    )
    assert standard.mix_ratio is None


@pytest.mark.django_db
def test_only_one_active_site_item_config_per_site_item(
    norm_based_item,
    site,
):
    SiteItemConfig.objects.create(
        item=norm_based_item,
        site=site,
        rate=6600,
        mix_ratio="0.33",
        effective_from=date(2026, 4, 1),
    )

    with pytest.raises(ValidationError):
        SiteItemConfig.objects.create(
            item=norm_based_item,
            site=site,
            rate=6700,
            mix_ratio="0.34",
            effective_from=date(2026, 5, 1),
        )


@pytest.mark.django_db
def test_resolution_prefers_site_override_over_company_default(
    norm_based_item,
    site,
):
    ItemStandard.objects.create(
        item=norm_based_item,
        rate=6500,
        mix_ratio="0.32",
        effective_from=date(2026, 1, 1),
    )

    resolved = resolve_standard(
        item=norm_based_item,
        site=site,
        on_date=date(2026, 4, 15),
    )
    assert resolved.source == (
        StandardSource.COMPANY_DEFAULT
    )
    assert resolved.rate == 6500

    site_config = SiteItemConfig.objects.create(
        item=norm_based_item,
        site=site,
        rate=6600,
        mix_ratio="0.33",
        effective_from=date(2026, 4, 1),
    )

    resolved = resolve_standard(
        item=norm_based_item,
        site=site,
        on_date=date(2026, 4, 15),
    )
    assert resolved.source == StandardSource.SITE
    assert resolved.rate == 6600

    site_config.is_active = False
    site_config.save(
        update_fields=["is_active", "updated_at"]
    )

    resolved = resolve_standard(
        item=norm_based_item,
        site=site,
        on_date=date(2026, 4, 15),
    )
    assert resolved.source == (
        StandardSource.COMPANY_DEFAULT
    )
    assert resolved.rate == 6500


@pytest.mark.django_db
def test_resolution_returns_none_when_unconfigured(
    direct_count_item,
    site,
):
    resolved = resolve_standard(
        item=direct_count_item,
        site=site,
    )
    assert resolved.source == StandardSource.NONE
    assert resolved.rate is None
