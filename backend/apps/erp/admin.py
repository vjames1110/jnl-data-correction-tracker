from django.contrib import admin

from apps.erp.models import (
    ErpModule,
    Priority,
    ReasonCategory,
    ResponsiblePersonMapping,
    RequestFieldConfiguration,
    VoucherType,
    WorkType,
)


@admin.register(ErpModule)
class ErpModuleAdmin(admin.ModelAdmin):
    list_display = [
        "module_code",
        "module_name",
        "display_order",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "is_active",
        "departments",
    ]
    search_fields = [
        "module_code",
        "module_name",
        "description",
    ]
    filter_horizontal = [
        "departments",
    ]
    ordering = [
        "display_order",
        "module_name",
    ]


@admin.register(VoucherType)
class VoucherTypeAdmin(admin.ModelAdmin):
    list_display = [
        "voucher_code",
        "voucher_name",
        "erp_module",
        "department",
        "requires_voucher_number",
        "requires_voucher_date",
        "requires_amount",
        "requires_quantity",
        "is_active",
    ]
    list_filter = [
        "erp_module",
        "department",
        "requires_voucher_number",
        "requires_voucher_date",
        "requires_amount",
        "requires_quantity",
        "is_active",
    ]
    search_fields = [
        "voucher_code",
        "voucher_name",
        "erp_module__module_code",
        "erp_module__module_name",
        "department__department_code",
        "department__department_name",
    ]
    ordering = [
        "erp_module__module_name",
        "voucher_name",
    ]


@admin.register(WorkType)
class WorkTypeAdmin(admin.ModelAdmin):
    list_display = [
        "work_type_code",
        "work_type_name",
        "requires_approval",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "requires_approval",
        "is_active",
    ]
    search_fields = [
        "work_type_code",
        "work_type_name",
        "description",
    ]
    ordering = [
        "work_type_name",
    ]


@admin.register(ReasonCategory)
class ReasonCategoryAdmin(admin.ModelAdmin):
    list_display = [
        "reason_code",
        "reason_name",
        "display_order",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "is_active",
    ]
    search_fields = [
        "reason_code",
        "reason_name",
        "description",
    ]
    ordering = [
        "display_order",
        "reason_name",
    ]


@admin.register(Priority)
class PriorityAdmin(admin.ModelAdmin):
    list_display = [
        "priority_code",
        "priority_name",
        "sla_duration_hours",
        "escalation_duration_hours",
        "display_order",
        "is_active",
    ]
    list_filter = [
        "is_active",
    ]
    search_fields = [
        "priority_code",
        "priority_name",
    ]
    ordering = [
        "display_order",
        "priority_name",
    ]


@admin.register(ResponsiblePersonMapping)
class ResponsiblePersonMappingAdmin(admin.ModelAdmin):
    list_display = [
        "erp_module",
        "voucher_type",
        "department",
        "site",
        "work_type",
        "priority",
        "responsible_person",
        "display_order",
        "is_active",
    ]
    list_filter = [
        "erp_module",
        "voucher_type",
        "department",
        "site",
        "work_type",
        "priority",
        "responsible_person",
        "is_active",
    ]
    search_fields = [
        "erp_module__module_code",
        "erp_module__module_name",
        "voucher_type__voucher_code",
        "voucher_type__voucher_name",
        "department__department_code",
        "department__department_name",
        "site__site_code",
        "site__site_name",
        "work_type__work_type_code",
        "work_type__work_type_name",
        "priority__priority_code",
        "priority__priority_name",
        "responsible_person__employee_id",
        "responsible_person__first_name",
        "responsible_person__last_name",
    ]
    ordering = [
        "display_order",
        "erp_module__module_name",
        "responsible_person__employee_id",
    ]


@admin.register(RequestFieldConfiguration)
class RequestFieldConfigurationAdmin(admin.ModelAdmin):
    list_display = [
        "field_key",
        "field_label",
        "field_state",
        "erp_module",
        "voucher_type",
        "work_type",
        "priority",
        "display_order",
        "is_active",
    ]
    list_filter = [
        "field_state",
        "erp_module",
        "voucher_type",
        "work_type",
        "priority",
        "is_active",
    ]
    search_fields = [
        "field_key",
        "field_label",
        "help_text",
        "erp_module__module_code",
        "erp_module__module_name",
        "voucher_type__voucher_code",
        "voucher_type__voucher_name",
        "work_type__work_type_code",
        "work_type__work_type_name",
        "priority__priority_code",
        "priority__priority_name",
    ]
    ordering = [
        "display_order",
        "field_label",
    ]
