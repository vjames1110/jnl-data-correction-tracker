from django.contrib import admin

from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemCategoryGrade,
    ItemStandard,
    ReconciliationApprovalStep,
    ReconciliationEntry,
    ReconciliationFlag,
    ReconciliationOutputEntry,
    ReconciliationPeriod,
    ReconciliationToleranceSettings,
    SiteItemConfig,
)


class ItemCategoryGradeInline(admin.TabularInline):
    model = ItemCategoryGrade
    extra = 0
    fields = ["grade_label", "display_order"]


@admin.register(ItemCategory)
class ItemCategoryAdmin(admin.ModelAdmin):
    list_display = [
        "category_code",
        "category_name",
        "is_production_output",
        "display_order",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "is_active",
        "is_production_output",
    ]
    search_fields = [
        "category_code",
        "category_name",
        "description",
    ]
    ordering = [
        "display_order",
        "category_name",
    ]
    inlines = [ItemCategoryGradeInline]


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = [
        "item_code",
        "item_name",
        "category",
        "reconciliation_type",
        "uom",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "category",
        "reconciliation_type",
        "is_active",
    ]
    search_fields = [
        "item_code",
        "item_name",
        "erp_item_code",
    ]
    ordering = [
        "item_name",
    ]


@admin.register(ItemStandard)
class ItemStandardAdmin(admin.ModelAdmin):
    list_display = [
        "item",
        "grade_label",
        "rate",
        "mix_ratio",
        "effective_from",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "is_active",
        "grade_label",
    ]
    search_fields = [
        "item__item_code",
        "item__item_name",
        "grade_label",
    ]
    ordering = [
        "item__item_name",
        "-effective_from",
    ]


@admin.register(SiteItemConfig)
class SiteItemConfigAdmin(admin.ModelAdmin):
    list_display = [
        "site",
        "item",
        "grade_label",
        "rate",
        "mix_ratio",
        "effective_from",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "is_active",
        "grade_label",
    ]
    search_fields = [
        "item__item_code",
        "item__item_name",
        "site__site_code",
        "site__site_name",
        "grade_label",
    ]
    ordering = [
        "site__site_name",
        "item__item_name",
        "-effective_from",
    ]


@admin.register(ReconciliationToleranceSettings)
class ReconciliationToleranceSettingsAdmin(
    admin.ModelAdmin
):
    list_display = [
        "default_tolerance_percentage",
        "watch_multiplier",
        "updated_at",
    ]


@admin.register(ReconciliationPeriod)
class ReconciliationPeriodAdmin(admin.ModelAdmin):
    list_display = [
        "site",
        "period_month",
        "status",
        "submitted_by",
        "submitted_at",
    ]
    list_filter = [
        "status",
        "site",
    ]
    search_fields = [
        "site__site_code",
        "site__site_name",
    ]
    ordering = [
        "-period_month",
        "site__site_name",
    ]


@admin.register(ReconciliationEntry)
class ReconciliationEntryAdmin(admin.ModelAdmin):
    list_display = [
        "period",
        "item",
        "actual_quantity",
        "theoretical_or_book_quantity",
        "variance_quantity",
        "status",
    ]
    list_filter = [
        "status",
    ]
    search_fields = [
        "item__item_code",
        "item__item_name",
    ]


@admin.register(ReconciliationOutputEntry)
class ReconciliationOutputEntryAdmin(
    admin.ModelAdmin
):
    list_display = [
        "period",
        "category",
        "grade_label",
        "output_quantity",
    ]
    search_fields = [
        "category__category_code",
        "category__category_name",
    ]


@admin.register(ReconciliationFlag)
class ReconciliationFlagAdmin(admin.ModelAdmin):
    list_display = [
        "period",
        "entry",
        "flag_type",
        "message",
        "created_at",
    ]
    list_filter = [
        "flag_type",
    ]


@admin.register(ReconciliationApprovalStep)
class ReconciliationApprovalStepAdmin(
    admin.ModelAdmin
):
    list_display = [
        "period",
        "round_number",
        "sequence",
        "approver_type",
        "approver",
        "status",
        "is_current",
        "decided_at",
    ]
    list_filter = [
        "status",
        "approver_type",
        "is_current",
    ]
    search_fields = [
        "period__site__site_code",
        "approver_employee_id_snapshot",
        "approver_name_snapshot",
    ]
    ordering = [
        "period",
        "round_number",
        "sequence",
    ]
