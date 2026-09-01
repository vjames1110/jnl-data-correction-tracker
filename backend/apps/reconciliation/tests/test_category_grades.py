from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.organization.models import Company, Site
from apps.reconciliation.api.serializers import (
    ItemCategorySerializer,
)
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemCategoryGrade,
    ItemStandard,
    ReconciliationOutputEntry,
    ReconciliationType,
    SiteItemConfig,
)
from apps.reconciliation.services.periods import (
    get_or_create_period,
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
def production_category():
    return ItemCategory.objects.create(
        category_name="Concrete Materials",
        is_production_output=True,
    )


@pytest.fixture
def plain_category():
    return ItemCategory.objects.create(
        category_name="Steel",
    )


@pytest.fixture
def cement(production_category):
    return Item.objects.create(
        item_name="Cement",
        category=production_category,
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )


@pytest.fixture
def period(site):
    return get_or_create_period(
        site=site,
        period_month=date(2026, 5, 1),
    )


# ---- Model-level validation ----


@pytest.mark.django_db
def test_grade_requires_a_label(
    production_category,
):
    with pytest.raises(ValidationError):
        ItemCategoryGrade.objects.create(
            category=production_category,
            grade_label="   ",
        )


@pytest.mark.django_db
def test_grade_normalizes_case_and_whitespace(
    production_category,
):
    grade = ItemCategoryGrade.objects.create(
        category=production_category,
        grade_label="  m20 ",
    )

    assert grade.grade_label == "M20"


@pytest.mark.django_db
def test_grade_rejected_on_non_production_category(
    plain_category,
):
    with pytest.raises(ValidationError):
        ItemCategoryGrade.objects.create(
            category=plain_category,
            grade_label="M20",
        )


@pytest.mark.django_db
def test_duplicate_grade_on_same_category_rejected(
    production_category,
):
    ItemCategoryGrade.objects.create(
        category=production_category,
        grade_label="M20",
    )

    with pytest.raises(Exception):
        ItemCategoryGrade.objects.create(
            category=production_category,
            grade_label="M20",
        )


# ---- Serializer round-trip ----


@pytest.mark.django_db
def test_serializer_creates_normalizes_and_dedupes_grades():
    serializer = ItemCategorySerializer(
        data={
            "category_name": "Concrete",
            "is_production_output": True,
            "grades": [
                "m10",
                " M20 ",
                "M20",
                "M30",
            ],
        }
    )
    serializer.is_valid(raise_exception=True)
    category = serializer.save()

    assert list(
        category.grades.values_list(
            "grade_label", flat=True
        )
    ) == ["M10", "M20", "M30"]


@pytest.mark.django_db
def test_serializer_rejects_grades_on_non_production_category():
    serializer = ItemCategorySerializer(
        data={
            "category_name": "Steel",
            "grades": ["M20"],
        }
    )

    assert serializer.is_valid() is False
    assert "grades" in serializer.errors


@pytest.mark.django_db
def test_serializer_partial_update_replaces_grade_set(
    production_category,
):
    ItemCategoryGrade.objects.create(
        category=production_category,
        grade_label="M10",
    )

    serializer = ItemCategorySerializer(
        production_category,
        data={"grades": ["M20", "M30"]},
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    updated = serializer.save()

    assert list(
        updated.grades.values_list(
            "grade_label", flat=True
        )
    ) == ["M20", "M30"]


@pytest.mark.django_db
def test_serializer_partial_update_without_grades_key_leaves_grades_untouched(
    production_category,
):
    ItemCategoryGrade.objects.create(
        category=production_category,
        grade_label="M10",
    )

    serializer = ItemCategorySerializer(
        production_category,
        data={"description": "unrelated change"},
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    updated = serializer.save()

    assert list(
        updated.grades.values_list(
            "grade_label", flat=True
        )
    ) == ["M10"]


# ---- Cross-model validation once grades are configured ----


@pytest.mark.django_db
def test_item_standard_rejects_grade_not_in_category_list(
    cement, production_category,
):
    ItemCategoryGrade.objects.create(
        category=production_category,
        grade_label="M20",
    )

    with pytest.raises(ValidationError):
        ItemStandard.objects.create(
            item=cement,
            grade_label="M45",
            rate=Decimal("6500.00"),
            mix_ratio=Decimal("0.30"),
            effective_from=date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_item_standard_accepts_configured_grade(
    cement, production_category,
):
    ItemCategoryGrade.objects.create(
        category=production_category,
        grade_label="M20",
    )

    standard = ItemStandard.objects.create(
        item=cement,
        grade_label="m20",
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.30"),
        effective_from=date(2026, 1, 1),
    )

    assert standard.grade_label == "M20"


@pytest.mark.django_db
def test_item_standard_blank_grade_always_allowed(
    cement, production_category,
):
    ItemCategoryGrade.objects.create(
        category=production_category,
        grade_label="M20",
    )

    standard = ItemStandard.objects.create(
        item=cement,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.30"),
        effective_from=date(2026, 1, 1),
    )

    assert standard.grade_label == ""


@pytest.mark.django_db
def test_item_standard_unrestricted_when_no_grades_configured_yet(
    cement,
):
    # No ItemCategoryGrade rows exist for this category yet - stays
    # lenient (backward compatible with data entered before grades
    # existed) rather than blocking every write.
    standard = ItemStandard.objects.create(
        item=cement,
        grade_label="M99",
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.30"),
        effective_from=date(2026, 1, 1),
    )

    assert standard.grade_label == "M99"


@pytest.mark.django_db
def test_site_item_config_rejects_grade_not_in_category_list(
    cement, production_category, site,
):
    ItemCategoryGrade.objects.create(
        category=production_category,
        grade_label="M20",
    )

    with pytest.raises(ValidationError):
        SiteItemConfig.objects.create(
            item=cement,
            site=site,
            grade_label="M45",
            rate=Decimal("6600.00"),
            mix_ratio=Decimal("0.32"),
            effective_from=date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_output_entry_rejects_grade_not_in_category_list(
    production_category, period,
):
    ItemCategoryGrade.objects.create(
        category=production_category,
        grade_label="M20",
    )

    with pytest.raises(ValidationError):
        ReconciliationOutputEntry.objects.create(
            period=period,
            category=production_category,
            grade_label="M45",
            output_quantity=Decimal("10.000"),
        )


@pytest.mark.django_db
def test_output_entry_rejects_blank_grade_when_grades_configured(
    production_category, period,
):
    ItemCategoryGrade.objects.create(
        category=production_category,
        grade_label="M20",
    )

    with pytest.raises(ValidationError):
        ReconciliationOutputEntry.objects.create(
            period=period,
            category=production_category,
            grade_label="",
            output_quantity=Decimal("10.000"),
        )


@pytest.mark.django_db
def test_output_entry_accepts_configured_grade(
    production_category, period,
):
    ItemCategoryGrade.objects.create(
        category=production_category,
        grade_label="M20",
    )

    entry = ReconciliationOutputEntry.objects.create(
        period=period,
        category=production_category,
        grade_label="m20",
        output_quantity=Decimal("10.000"),
    )

    assert entry.grade_label == "M20"


@pytest.mark.django_db
def test_output_entry_unrestricted_when_no_grades_configured_yet(
    production_category, period,
):
    entry = ReconciliationOutputEntry.objects.create(
        period=period,
        category=production_category,
        grade_label="M99",
        output_quantity=Decimal("10.000"),
    )

    assert entry.grade_label == "M99"
