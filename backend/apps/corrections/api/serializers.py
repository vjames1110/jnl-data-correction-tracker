from rest_framework import serializers

from django.contrib.auth import get_user_model

from apps.corrections.models import (
    CorrectionApprovalStep,
    CorrectionRequest,
    CorrectionRequestAttachment,
    CorrectionRequestTimeline,
)


class CorrectionRequestDraftSerializer(
    serializers.ModelSerializer
):
    requester_employee_id = serializers.CharField(
        source="requester.employee_id",
        read_only=True,
    )
    requester_name = serializers.CharField(
        source="requester.full_name",
        read_only=True,
    )
    current_owner_employee_id = serializers.CharField(
        source="current_owner.employee_id",
        read_only=True,
    )
    current_owner_name = serializers.CharField(
        source="current_owner.full_name",
        read_only=True,
    )
    site_code = serializers.CharField(
        source="site.site_code",
        read_only=True,
    )
    site_name = serializers.CharField(
        source="site.site_name",
        read_only=True,
    )
    department_code = serializers.CharField(
        source="department.department_code",
        read_only=True,
    )
    department_name = serializers.CharField(
        source="department.department_name",
        read_only=True,
    )
    erp_module_code = serializers.CharField(
        source="erp_module.module_code",
        read_only=True,
    )
    erp_module_name = serializers.CharField(
        source="erp_module.module_name",
        read_only=True,
    )
    voucher_code = serializers.CharField(
        source="voucher_type.voucher_code",
        read_only=True,
    )
    voucher_name = serializers.CharField(
        source="voucher_type.voucher_name",
        read_only=True,
    )
    work_type_code = serializers.CharField(
        source="work_type.work_type_code",
        read_only=True,
    )
    work_type_name = serializers.CharField(
        source="work_type.work_type_name",
        read_only=True,
    )
    reason_code = serializers.CharField(
        source="reason_category.reason_code",
        read_only=True,
    )
    reason_name = serializers.CharField(
        source="reason_category.reason_name",
        read_only=True,
    )
    priority_code = serializers.CharField(
        source="priority.priority_code",
        read_only=True,
    )
    priority_name = serializers.CharField(
        source="priority.priority_name",
        read_only=True,
    )

    class Meta:
        model = CorrectionRequest
        fields = [
            "id",
            "reference",
            "requester",
            "requester_employee_id",
            "requester_name",
            "site",
            "site_code",
            "site_name",
            "department",
            "department_code",
            "department_name",
            "voucher_type",
            "voucher_code",
            "voucher_name",
            "erp_module",
            "erp_module_code",
            "erp_module_name",
            "work_type",
            "work_type_code",
            "work_type_name",
            "voucher_number",
            "voucher_date",
            "erp_email_date",
            "description",
            "reason_category",
            "reason_code",
            "reason_name",
            "priority",
            "priority_code",
            "priority_name",
            "requested_window_start",
            "requested_window_end",
            "amount",
            "quantity",
            "current_status",
            "current_owner",
            "current_owner_employee_id",
            "current_owner_name",
            "sla_deadline",
            "submitted_at",
            "duplicate_override_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "reference",
            "requester",
            "requester_employee_id",
            "requester_name",
            "site_code",
            "site_name",
            "department_code",
            "department_name",
            "voucher_code",
            "voucher_name",
            "erp_module_code",
            "erp_module_name",
            "work_type_code",
            "work_type_name",
            "reason_code",
            "reason_name",
            "priority_code",
            "priority_name",
            "current_status",
            "current_owner",
            "current_owner_employee_id",
            "current_owner_name",
            "sla_deadline",
            "submitted_at",
            "duplicate_override_reason",
            "created_at",
            "updated_at",
        ]


class CorrectionRequestSubmitSerializer(
    serializers.Serializer
):
    override_duplicates = serializers.BooleanField(
        default=False,
        required=False,
    )
    duplicate_override_reason = serializers.CharField(
        allow_blank=True,
        required=False,
        trim_whitespace=True,
    )


class CorrectionRequestCancelSerializer(
    serializers.Serializer
):
    reason = serializers.CharField(
        allow_blank=True,
        required=False,
        trim_whitespace=True,
    )


class CorrectionRequestCommentSerializer(
    serializers.Serializer
):
    comment = serializers.CharField(
        allow_blank=True,
        required=False,
        trim_whitespace=True,
    )


class CorrectionRequestAttachmentSerializer(
    serializers.ModelSerializer
):
    file = serializers.FileField(
        write_only=True,
        required=True,
    )
    uploaded_by_employee_id = serializers.CharField(
        source="uploaded_by.employee_id",
        read_only=True,
    )
    uploaded_by_name = serializers.CharField(
        source="uploaded_by.full_name",
        read_only=True,
    )
    request_reference = serializers.CharField(
        source="request.reference",
        read_only=True,
    )
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = CorrectionRequestAttachment
        fields = [
            "id",
            "request",
            "request_reference",
            "uploaded_by",
            "uploaded_by_employee_id",
            "uploaded_by_name",
            "file",
            "original_name",
            "content_type",
            "size_bytes",
            "attachment_type",
            "download_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "request_reference",
            "uploaded_by",
            "uploaded_by_employee_id",
            "uploaded_by_name",
            "original_name",
            "content_type",
            "size_bytes",
            "download_url",
            "created_at",
            "updated_at",
        ]

    def get_download_url(self, obj):
        request = self.context.get("request")
        if request is None:
            return ""

        return request.build_absolute_uri(
            f"/api/v1/corrections/attachments/{obj.id}/download/"
        )


class CorrectionRequestTimelineSerializer(
    serializers.ModelSerializer
):
    actor_employee_id = serializers.CharField(
        source="actor.employee_id",
        read_only=True,
    )
    actor_name = serializers.CharField(
        source="actor.full_name",
        read_only=True,
    )
    request_reference = serializers.CharField(
        source="request.reference",
        read_only=True,
    )

    class Meta:
        model = CorrectionRequestTimeline
        fields = [
            "id",
            "request",
            "request_reference",
            "actor",
            "actor_employee_id",
            "actor_name",
            "event_type",
            "from_status",
            "to_status",
            "comment",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields


class CorrectionApprovalStepSerializer(
    serializers.ModelSerializer
):
    request_reference = serializers.CharField(
        source="request.reference",
        read_only=True,
    )
    request_status = serializers.CharField(
        source="request.current_status",
        read_only=True,
    )
    requester_employee_id = serializers.CharField(
        source="request.requester.employee_id",
        read_only=True,
    )
    requester_name = serializers.CharField(
        source="request.requester.full_name",
        read_only=True,
    )
    request_submitted_at = serializers.DateTimeField(
        source="request.submitted_at",
        read_only=True,
    )
    request_sla_deadline = serializers.DateTimeField(
        source="request.sla_deadline",
        read_only=True,
    )
    site_code = serializers.CharField(
        source="request.site.site_code",
        read_only=True,
    )
    site_name = serializers.CharField(
        source="request.site.site_name",
        read_only=True,
    )
    department_code = serializers.CharField(
        source="request.department.department_code",
        read_only=True,
    )
    department_name = serializers.CharField(
        source="request.department.department_name",
        read_only=True,
    )
    voucher_code = serializers.CharField(
        source="request.voucher_type.voucher_code",
        read_only=True,
    )
    voucher_name = serializers.CharField(
        source="request.voucher_type.voucher_name",
        read_only=True,
    )
    voucher_number = serializers.CharField(
        source="request.voucher_number",
        read_only=True,
    )
    work_type_name = serializers.CharField(
        source="request.work_type.work_type_name",
        read_only=True,
    )
    reason_name = serializers.CharField(
        source="request.reason_category.reason_name",
        read_only=True,
    )
    priority_name = serializers.CharField(
        source="request.priority.priority_name",
        read_only=True,
    )
    amount = serializers.DecimalField(
        source="request.amount",
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )
    approver_employee_id = serializers.CharField(
        source="approver.employee_id",
        read_only=True,
    )
    approver_name = serializers.CharField(
        source="approver.full_name",
        read_only=True,
    )

    class Meta:
        model = CorrectionApprovalStep
        fields = [
            "id",
            "request",
            "request_reference",
            "request_status",
            "requester_employee_id",
            "requester_name",
            "request_submitted_at",
            "request_sla_deadline",
            "site_code",
            "site_name",
            "department_code",
            "department_name",
            "voucher_code",
            "voucher_name",
            "voucher_number",
            "work_type_name",
            "reason_name",
            "priority_name",
            "amount",
            "workflow_policy",
            "sequence",
            "level_name",
            "approver_type",
            "approver",
            "approver_employee_id",
            "approver_name",
            "status",
            "is_current",
            "due_at",
            "escalates_at",
            "decided_at",
            "policy_name_snapshot",
            "approver_employee_id_snapshot",
            "approver_name_snapshot",
            "snapshot",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ApprovalActionSerializer(serializers.Serializer):
    comment = serializers.CharField(
        allow_blank=True,
        required=False,
        trim_whitespace=True,
    )


class ApprovalDelegateSerializer(
    ApprovalActionSerializer
):
    delegate_to = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.all(),
        required=True,
    )


class ApprovalEscalationSerializer(
    ApprovalActionSerializer
):
    backup_approver = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.all(),
        required=False,
        allow_null=True,
    )


class ApprovalAdminInterventionSerializer(
    ApprovalEscalationSerializer
):
    action = serializers.ChoiceField(
        choices=[
            "APPROVE",
            "REJECT",
            "RETURN",
            "DELEGATE",
            "REMINDER",
            "ESCALATE",
        ]
    )
    delegate_to = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.all(),
        required=False,
        allow_null=True,
    )
