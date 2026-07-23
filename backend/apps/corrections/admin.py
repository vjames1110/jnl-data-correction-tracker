from django.contrib import admin

from apps.corrections.models import (
    CorrectionRequest,
    CorrectionRequestAttachment,
    CorrectionRequestReferenceSequence,
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
