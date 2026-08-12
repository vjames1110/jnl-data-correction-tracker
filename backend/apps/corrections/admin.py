from django.contrib import admin

from apps.corrections.models import (
    ApprovalWorkflowLevel,
    ApprovalWorkflowPolicy,
    CorrectionApprovalStep,
    CorrectionRequest,
    CorrectionRequestAttachment,
    CorrectionRequestReferenceSequence,
    CorrectionRequestResolution,
    CorrectionRequestTimeline,
)


@admin.register(CorrectionRequestReferenceSequence)
class CorrectionRequestReferenceSequenceAdmin(
    admin.ModelAdmin
):
    list_display = [
        "year",
        "last_number",
        "updated_at",
    ]
    readonly_fields = [
        "created_at",
        "updated_at",
    ]


@admin.register(CorrectionRequest)
class CorrectionRequestAdmin(admin.ModelAdmin):
    list_display = [
        "reference",
        "requester",
        "current_status",
        "current_owner",
        "site",
        "department",
        "erp_module",
        "voucher_type",
        "voucher_number",
        "is_deleted",
        "updated_at",
    ]
    list_filter = [
        "current_status",
        "is_deleted",
        "site",
        "department",
        "erp_module",
        "voucher_type",
        "work_type",
        "priority",
    ]
    search_fields = [
        "reference",
        "requester__employee_id",
        "requester__first_name",
        "requester__last_name",
        "voucher_number",
        "description",
    ]
    readonly_fields = [
        "reference",
        "created_at",
        "updated_at",
        "deleted_at",
        "deleted_by",
    ]


class ApprovalWorkflowLevelInline(admin.TabularInline):
    model = ApprovalWorkflowLevel
    extra = 0
    fields = [
        "sequence",
        "level_name",
        "approver_type",
        "custom_approver",
        "is_required",
        "sla_hours",
        "escalation_hours",
        "is_deleted",
    ]


@admin.register(ApprovalWorkflowPolicy)
class ApprovalWorkflowPolicyAdmin(admin.ModelAdmin):
    list_display = [
        "policy_name",
        "site",
        "department",
        "erp_module",
        "voucher_type",
        "work_type",
        "priority",
        "amount_min",
        "amount_max",
        "display_order",
        "is_active",
    ]
    list_filter = [
        "is_active",
        "site",
        "department",
        "erp_module",
        "voucher_type",
        "work_type",
        "priority",
    ]
    search_fields = [
        "policy_name",
        "site__site_code",
        "site__site_name",
        "department__department_code",
        "department__department_name",
        "erp_module__module_code",
        "erp_module__module_name",
        "voucher_type__voucher_code",
        "voucher_type__voucher_name",
    ]
    readonly_fields = [
        "created_at",
        "updated_at",
        "deleted_at",
        "deleted_by",
    ]
    inlines = [ApprovalWorkflowLevelInline]


@admin.register(ApprovalWorkflowLevel)
class ApprovalWorkflowLevelAdmin(admin.ModelAdmin):
    list_display = [
        "workflow_policy",
        "sequence",
        "level_name",
        "approver_type",
        "custom_approver",
        "is_required",
        "is_deleted",
    ]
    list_filter = [
        "approver_type",
        "is_required",
        "is_deleted",
        "workflow_policy",
    ]
    search_fields = [
        "workflow_policy__policy_name",
        "level_name",
        "custom_approver__employee_id",
        "custom_approver__first_name",
        "custom_approver__last_name",
    ]
    readonly_fields = [
        "created_at",
        "updated_at",
        "deleted_at",
        "deleted_by",
    ]


@admin.register(CorrectionApprovalStep)
class CorrectionApprovalStepAdmin(admin.ModelAdmin):
    list_display = [
        "request",
        "sequence",
        "level_name",
        "approver_type",
        "approver",
        "status",
        "is_current",
        "due_at",
        "escalates_at",
    ]
    list_filter = [
        "status",
        "is_current",
        "approver_type",
        "workflow_policy",
    ]
    search_fields = [
        "request__reference",
        "policy_name_snapshot",
        "approver_employee_id_snapshot",
        "approver_name_snapshot",
    ]
    readonly_fields = [
        "created_at",
        "updated_at",
        "policy_name_snapshot",
        "approver_employee_id_snapshot",
        "approver_name_snapshot",
        "snapshot",
    ]


@admin.register(CorrectionRequestAttachment)
class CorrectionRequestAttachmentAdmin(admin.ModelAdmin):
    list_display = [
        "request",
        "original_name",
        "attachment_type",
        "uploaded_by",
        "size_bytes",
        "is_deleted",
        "created_at",
    ]
    list_filter = [
        "attachment_type",
        "is_deleted",
        "content_type",
    ]
    search_fields = [
        "request__reference",
        "original_name",
        "uploaded_by__employee_id",
    ]
    readonly_fields = [
        "created_at",
        "updated_at",
        "deleted_at",
        "deleted_by",
    ]


@admin.register(CorrectionRequestTimeline)
class CorrectionRequestTimelineAdmin(admin.ModelAdmin):
    list_display = [
        "request",
        "event_type",
        "actor",
        "from_status",
        "to_status",
        "created_at",
    ]
    list_filter = [
        "event_type",
        "from_status",
        "to_status",
    ]
    search_fields = [
        "request__reference",
        "actor__employee_id",
        "comment",
    ]
    readonly_fields = [
        "created_at",
        "updated_at",
    ]


@admin.register(CorrectionRequestResolution)
class CorrectionRequestResolutionAdmin(
    admin.ModelAdmin
):
    list_display = [
        "request",
        "resolved_by",
        "completion_date",
        "erp_reference",
        "created_at",
    ]
    list_filter = [
        "completion_date",
    ]
    search_fields = [
        "request__reference",
        "resolved_by__employee_id",
        "erp_reference",
    ]
    readonly_fields = [
        "created_at",
        "updated_at",
    ]
