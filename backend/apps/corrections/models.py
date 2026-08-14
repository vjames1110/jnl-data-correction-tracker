import os
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import (
    SoftDeleteModel,
    TimeStampedModel,
    UUIDPrimaryKeyModel,
)
from apps.employees.models import EmployeeProfile
from apps.erp.models import (
    ErpModule,
    Priority,
    ReasonCategory,
    VoucherType,
    WorkType,
)
from apps.organization.models import (
    Department,
    Site,
)


class CorrectionRequestStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    SUBMITTED = "SUBMITTED", "Submitted"
    PENDING_APPROVAL = (
        "PENDING_APPROVAL",
        "Pending Approval",
    )
    APPROVED = "APPROVED", "Approved"
    ASSIGNED = "ASSIGNED", "Assigned"
    ACCEPTED = "ACCEPTED", "Accepted"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    ON_HOLD = "ON_HOLD", "On Hold"
    RESOLVED = "RESOLVED", "Resolved"
    REOPENED = "REOPENED", "Reopened"
    CLOSED = "CLOSED", "Closed"
    REJECTED = "REJECTED", "Rejected"
    CANCELLED = "CANCELLED", "Cancelled"


class ClosureType(models.TextChoices):
    CONFIRMED = "CONFIRMED", "Confirmed By Requester"
    AUTO_CLOSED = "AUTO_CLOSED", "Auto-Closed"


class SlaResult(models.TextChoices):
    MET = "MET", "Met"
    BREACHED = "BREACHED", "Breached"
    NOT_APPLICABLE = (
        "NOT_APPLICABLE",
        "Not Applicable",
    )


class CorrectionAttachmentType(models.TextChoices):
    SUPPORTING_DOCUMENT = (
        "SUPPORTING_DOCUMENT",
        "Supporting Document",
    )
    EMAIL_SCREENSHOT = (
        "EMAIL_SCREENSHOT",
        "Email Screenshot",
    )


class CorrectionTimelineEventType(models.TextChoices):
    DRAFT_CREATED = "DRAFT_CREATED", "Draft Created"
    SUBMITTED = "SUBMITTED", "Submitted"
    APPROVAL_ACTION = (
        "APPROVAL_ACTION",
        "Approval Action",
    )
    ASSIGNED = "ASSIGNED", "Assigned"
    STATUS_CHANGED = (
        "STATUS_CHANGED",
        "Status Changed",
    )
    COMMENT = "COMMENT", "Comment"
    ATTACHMENT_ADDED = (
        "ATTACHMENT_ADDED",
        "Attachment Added",
    )
    ATTACHMENT_DELETED = (
        "ATTACHMENT_DELETED",
        "Attachment Deleted",
    )
    RESOLVED = "RESOLVED", "Resolved"
    REOPENED = "REOPENED", "Reopened"
    CLOSED = "CLOSED", "Closed"


class ApprovalApproverType(models.TextChoices):
    DEPARTMENT_HOD = (
        "DEPARTMENT_HOD",
        "Department HOD",
    )
    SITE_HOD = "SITE_HOD", "Site HOD"
    DIRECTOR = "DIRECTOR", "Director"
    ADMIN_FINAL = (
        "ADMIN_FINAL",
        "Admin Final Approval",
    )
    CUSTOM = "CUSTOM", "Custom Approver"


class ApprovalStepStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"
    RETURNED = (
        "RETURNED",
        "Returned For Clarification",
    )
    DELEGATED = "DELEGATED", "Delegated"
    SKIPPED = "SKIPPED", "Skipped"


ALLOWED_ATTACHMENT_EXTENSIONS = {
    ".pdf",
    ".xlsx",
    ".xlsm",
    ".xls",
    ".csv",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
}
ALLOWED_ATTACHMENT_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024


def correction_attachment_upload_to(
    instance,
    filename,
) -> str:
    request_reference = (
        instance.request.reference
        if instance.request_id
        else "unassigned"
    )
    return (
        "corrections/attachments/"
        f"{request_reference}/{filename}"
    )


class CorrectionRequestReferenceSequence(
    TimeStampedModel
):
    """
    Yearly counter used to generate public request references.
    """

    year = models.PositiveIntegerField(
        unique=True,
        db_index=True,
    )
    last_number = models.PositiveIntegerField(
        default=0,
    )

    class Meta:
        db_table = "correction_request_reference_sequence"
        ordering = ["-year"]
        verbose_name = "Correction Request Reference Sequence"
        verbose_name_plural = (
            "Correction Request Reference Sequences"
        )

    def __str__(self) -> str:
        return f"{self.year}: {self.last_number}"


class CorrectionRequest(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    SoftDeleteModel,
):
    """
    Primary correction request record.

    Draft records are intentionally permissive; submission-specific
    required-field validation is added in later phases.
    """

    reference = models.CharField(
        max_length=30,
        unique=True,
        db_index=True,
        blank=True,
    )
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="correction_requests",
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        related_name="correction_requests",
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="correction_requests",
        null=True,
        blank=True,
    )
    voucher_type = models.ForeignKey(
        VoucherType,
        on_delete=models.PROTECT,
        related_name="correction_requests",
        null=True,
        blank=True,
    )
    erp_module = models.ForeignKey(
        ErpModule,
        on_delete=models.PROTECT,
        related_name="correction_requests",
        null=True,
        blank=True,
    )
    work_type = models.ForeignKey(
        WorkType,
        on_delete=models.PROTECT,
        related_name="correction_requests",
        null=True,
        blank=True,
    )
    voucher_number = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
    )
    voucher_date = models.DateField(
        null=True,
        blank=True,
    )
    erp_email_date = models.DateField(
        null=True,
        blank=True,
    )
    description = models.TextField(
        blank=True,
    )
    reason_category = models.ForeignKey(
        ReasonCategory,
        on_delete=models.PROTECT,
        related_name="correction_requests",
        null=True,
        blank=True,
    )
    priority = models.ForeignKey(
        Priority,
        on_delete=models.PROTECT,
        related_name="correction_requests",
        null=True,
        blank=True,
    )
    requested_window_start = models.DateTimeField(
        null=True,
        blank=True,
    )
    requested_window_end = models.DateTimeField(
        null=True,
        blank=True,
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        null=True,
        blank=True,
    )
    ho_work_authority = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.SET_NULL,
        related_name="ho_work_authority_requests",
        null=True,
        blank=True,
        help_text=(
            "HO person whose action caused this issue."
        ),
    )
    site_work_authority = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.SET_NULL,
        related_name="site_work_authority_requests",
        null=True,
        blank=True,
        help_text=(
            "Site person whose action caused this issue."
        ),
    )
    root_cause_person = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.SET_NULL,
        related_name="root_cause_correction_requests",
        null=True,
        blank=True,
        help_text=(
            "Main person responsible for the issue."
        ),
    )
    current_status = models.CharField(
        max_length=30,
        choices=CorrectionRequestStatus.choices,
        default=CorrectionRequestStatus.DRAFT,
        db_index=True,
    )
    current_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_correction_requests",
        null=True,
        blank=True,
    )
    sla_deadline = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )
    submitted_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )
    duplicate_override_reason = models.TextField(
        blank=True,
    )
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="closed_correction_requests",
        null=True,
        blank=True,
    )
    closure_type = models.CharField(
        max_length=20,
        choices=ClosureType.choices,
        blank=True,
    )
    final_sla_result = models.CharField(
        max_length=20,
        choices=SlaResult.choices,
        blank=True,
    )
    resolution_duration_hours = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "correction_request"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["requester", "current_status"],
                name="corr_requester_status_idx",
            ),
            models.Index(
                fields=["current_owner", "current_status"],
                name="corr_owner_status_idx",
            ),
            models.Index(
                fields=[
                    "voucher_type",
                    "voucher_number",
                ],
                name="corr_voucher_lookup_idx",
            ),
            models.Index(
                fields=["is_deleted", "current_status"],
                name="corr_deleted_status_idx",
            ),
        ]
        verbose_name = "Correction Request"
        verbose_name_plural = "Correction Requests"

    def __str__(self) -> str:
        return self.reference

    @property
    def is_draft(self) -> bool:
        return (
            self.current_status
            == CorrectionRequestStatus.DRAFT
        )

    def clean(self):
        super().clean()

        errors = {}

        if (
            self.voucher_type_id
            and self.erp_module_id
            and self.voucher_type.erp_module_id
            != self.erp_module_id
        ):
            errors["voucher_type"] = (
                "Voucher type must belong to the selected ERP module."
            )

        if (
            self.voucher_type_id
            and self.department_id
            and self.voucher_type.department_id
            and self.voucher_type.department_id
            != self.department_id
        ):
            errors["department"] = (
                "Department must match the selected voucher type."
            )

        if (
            self.requested_window_start
            and self.requested_window_end
            and self.requested_window_end
            < self.requested_window_start
        ):
            errors["requested_window_end"] = (
                "Requested window end cannot be before the start."
            )

        if (
            self.amount is not None
            and self.amount < Decimal("0")
        ):
            errors["amount"] = (
                "Amount cannot be negative."
            )

        if (
            self.quantity is not None
            and self.quantity < Decimal("0")
        ):
            errors["quantity"] = (
                "Quantity cannot be negative."
            )

        if self.ho_work_authority_id:
            ho_profile = (
                EmployeeProfile.objects.filter(
                    id=self.ho_work_authority_id,
                )
                .select_related("site")
                .first()
            )
            if not (
                ho_profile
                and ho_profile.site_id
                and ho_profile.site.site_code
                == "HO"
            ):
                errors["ho_work_authority"] = (
                    "Selected employee's site is "
                    "not Head Office (HO)."
                )

        if self.site_work_authority_id:
            site_profile = (
                EmployeeProfile.objects.filter(
                    id=(
                        self.site_work_authority_id
                    ),
                ).first()
            )
            if not (
                site_profile
                and self.site_id
                and site_profile.site_id
                == self.site_id
                and self.department_id
                and site_profile.department_id
                == self.department_id
            ):
                errors["site_work_authority"] = (
                    "Selected employee must belong "
                    "to this request's site and "
                    "department."
                )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self.reference:
            from apps.corrections.services.references import (
                generate_request_reference,
            )

            self.reference = generate_request_reference()

        if self.current_owner_id is None:
            self.current_owner = self.requester

        self.full_clean()
        return super().save(*args, **kwargs)


class CorrectionAutoCloseSettings(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
):
    """
    Singleton policy controlling automatic closure of resolved
    requests the requester never confirms or reopens.
    """

    is_enabled = models.BooleanField(
        default=False,
    )
    auto_close_after_days = models.PositiveIntegerField(
        default=7,
    )
    reminder_before_days = models.PositiveIntegerField(
        default=2,
    )
    exclude_critical_priority = models.BooleanField(
        default=True,
    )

    class Meta:
        db_table = "correction_auto_close_settings"
        verbose_name = "Auto-Close Settings"
        verbose_name_plural = "Auto-Close Settings"

    def __str__(self) -> str:
        return (
            "Auto-close settings "
            f"({'enabled' if self.is_enabled else 'disabled'})"
        )

    @classmethod
    def get_solo(cls) -> "CorrectionAutoCloseSettings":
        instance = cls.objects.order_by(
            "created_at"
        ).first()
        if instance is not None:
            return instance

        return cls.objects.create()

    def clean(self):
        super().clean()

        errors = {}

        if self.auto_close_after_days < 1:
            errors["auto_close_after_days"] = (
                "Auto-close must occur at least 1 day "
                "after resolution."
            )

        if (
            self.reminder_before_days
            >= self.auto_close_after_days
        ):
            errors["reminder_before_days"] = (
                "The reminder must be sent before the "
                "auto-close day is reached."
            )

        if CorrectionAutoCloseSettings.objects.exclude(
            pk=self.pk
        ).exists():
            errors["__all__"] = (
                "Auto-close settings already exist; "
                "edit the existing record instead of "
                "creating a new one."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ApprovalWorkflowPolicy(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    SoftDeleteModel,
):
    """
    Configurable approval route selector for submitted requests.
    Empty scope fields act as wildcards; the most specific active
    policy is used when a request is submitted.
    """

    policy_name = models.CharField(
        max_length=150,
        db_index=True,
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        related_name="approval_workflow_policies",
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="approval_workflow_policies",
        null=True,
        blank=True,
    )
    erp_module = models.ForeignKey(
        ErpModule,
        on_delete=models.PROTECT,
        related_name="approval_workflow_policies",
        null=True,
        blank=True,
    )
    voucher_type = models.ForeignKey(
        VoucherType,
        on_delete=models.PROTECT,
        related_name="approval_workflow_policies",
        null=True,
        blank=True,
    )
    work_type = models.ForeignKey(
        WorkType,
        on_delete=models.PROTECT,
        related_name="approval_workflow_policies",
        null=True,
        blank=True,
    )
    priority = models.ForeignKey(
        Priority,
        on_delete=models.PROTECT,
        related_name="approval_workflow_policies",
        null=True,
        blank=True,
    )
    amount_min = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    amount_max = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    display_order = models.PositiveIntegerField(
        default=0,
        db_index=True,
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    class Meta:
        db_table = "correction_approval_workflow_policy"
        ordering = [
            "display_order",
            "policy_name",
        ]
        indexes = [
            models.Index(
                fields=["is_active", "display_order"],
                name="corr_awp_active_order_idx",
            ),
            models.Index(
                fields=["site", "department", "is_active"],
                name="corr_awp_org_active_idx",
            ),
            models.Index(
                fields=[
                    "erp_module",
                    "voucher_type",
                    "is_active",
                ],
                name="corr_awp_erp_active_idx",
            ),
            models.Index(
                fields=[
                    "work_type",
                    "priority",
                    "is_active",
                ],
                name="corr_awp_work_active_idx",
            ),
        ]
        verbose_name = "Approval Workflow Policy"
        verbose_name_plural = (
            "Approval Workflow Policies"
        )

    def __str__(self) -> str:
        return self.policy_name

    def clean(self):
        super().clean()

        errors = {}

        if (
            self.amount_min is not None
            and self.amount_min < Decimal("0")
        ):
            errors["amount_min"] = (
                "Minimum amount cannot be negative."
            )

        if (
            self.amount_max is not None
            and self.amount_max < Decimal("0")
        ):
            errors["amount_max"] = (
                "Maximum amount cannot be negative."
            )

        if (
            self.amount_min is not None
            and self.amount_max is not None
            and self.amount_max < self.amount_min
        ):
            errors["amount_max"] = (
                "Maximum amount cannot be below minimum amount."
            )

        if (
            self.voucher_type_id
            and self.erp_module_id
            and self.voucher_type.erp_module_id
            != self.erp_module_id
        ):
            errors["voucher_type"] = (
                "Voucher type must belong to the selected ERP module."
            )

        if (
            self.voucher_type_id
            and self.department_id
            and self.voucher_type.department_id
            and self.voucher_type.department_id
            != self.department_id
        ):
            errors["department"] = (
                "Department must match the selected voucher type."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ApprovalWorkflowLevel(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    SoftDeleteModel,
):
    """
    Ordered approval levels for a workflow policy.
    """

    workflow_policy = models.ForeignKey(
        ApprovalWorkflowPolicy,
        on_delete=models.CASCADE,
        related_name="approval_levels",
    )
    level_name = models.CharField(
        max_length=120,
        blank=True,
    )
    sequence = models.PositiveSmallIntegerField(
        db_index=True,
    )
    approver_type = models.CharField(
        max_length=30,
        choices=ApprovalApproverType.choices,
        db_index=True,
    )
    custom_approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="custom_approval_levels",
        null=True,
        blank=True,
    )
    is_required = models.BooleanField(
        default=True,
    )
    sla_hours = models.PositiveIntegerField(
        null=True,
        blank=True,
    )
    escalation_hours = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "correction_approval_workflow_level"
        ordering = [
            "workflow_policy",
            "sequence",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "workflow_policy",
                    "sequence",
                ],
                condition=models.Q(is_deleted=False),
                name="corr_awl_policy_sequence_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=[
                    "workflow_policy",
                    "is_deleted",
                    "sequence",
                ],
                name="corr_awl_policy_order_idx",
            ),
            models.Index(
                fields=["approver_type", "is_deleted"],
                name="corr_awl_type_deleted_idx",
            ),
        ]
        verbose_name = "Approval Workflow Level"
        verbose_name_plural = (
            "Approval Workflow Levels"
        )

    def __str__(self) -> str:
        return (
            f"{self.workflow_policy.policy_name} - "
            f"{self.sequence}"
        )

    def clean(self):
        super().clean()

        errors = {}

        if self.sequence < 1:
            errors["sequence"] = (
                "Approval sequence must be at least 1."
            )

        if (
            self.approver_type
            == ApprovalApproverType.CUSTOM
            and not self.custom_approver_id
        ):
            errors["custom_approver"] = (
                "Custom approver is required for custom approval levels."
            )

        if (
            self.approver_type
            != ApprovalApproverType.CUSTOM
            and self.custom_approver_id
        ):
            errors["custom_approver"] = (
                "Custom approver can only be used with custom approval levels."
            )

        if (
            self.sla_hours is not None
            and self.sla_hours < 1
        ):
            errors["sla_hours"] = (
                "SLA hours must be at least 1."
            )

        if (
            self.escalation_hours is not None
            and self.escalation_hours < 1
        ):
            errors["escalation_hours"] = (
                "Escalation hours must be at least 1."
            )

        if (
            self.sla_hours
            and self.escalation_hours
            and self.escalation_hours > self.sla_hours
        ):
            errors["escalation_hours"] = (
                "Escalation hours cannot exceed SLA hours."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class CorrectionApprovalStep(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
):
    """
    Immutable request-time approval route snapshot.
    """

    request = models.ForeignKey(
        CorrectionRequest,
        on_delete=models.PROTECT,
        related_name="approval_steps",
    )
    workflow_policy = models.ForeignKey(
        ApprovalWorkflowPolicy,
        on_delete=models.SET_NULL,
        related_name="approval_step_snapshots",
        null=True,
        blank=True,
    )
    sequence = models.PositiveSmallIntegerField(
        db_index=True,
    )
    level_name = models.CharField(
        max_length=120,
        blank=True,
    )
    approver_type = models.CharField(
        max_length=30,
        choices=ApprovalApproverType.choices,
        db_index=True,
    )
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="correction_approval_steps",
    )
    status = models.CharField(
        max_length=30,
        choices=ApprovalStepStatus.choices,
        default=ApprovalStepStatus.PENDING,
        db_index=True,
    )
    is_current = models.BooleanField(
        default=False,
        db_index=True,
    )
    due_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )
    escalates_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )
    decided_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    policy_name_snapshot = models.CharField(
        max_length=150,
        blank=True,
    )
    approver_employee_id_snapshot = models.CharField(
        max_length=30,
        blank=True,
    )
    approver_name_snapshot = models.CharField(
        max_length=150,
        blank=True,
    )
    snapshot = models.JSONField(
        default=dict,
        blank=True,
    )

    class Meta:
        db_table = "correction_approval_step"
        ordering = ["request", "sequence"]
        constraints = [
            models.UniqueConstraint(
                fields=["request", "sequence"],
                name="corr_approval_step_request_sequence_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["request", "status"],
                name="corr_step_request_status_idx",
            ),
            models.Index(
                fields=["approver", "status"],
                name="corr_step_approver_status_idx",
            ),
            models.Index(
                fields=["request", "is_current"],
                name="corr_step_request_current_idx",
            ),
        ]
        verbose_name = "Correction Approval Step"
        verbose_name_plural = (
            "Correction Approval Steps"
        )

    def __str__(self) -> str:
        return (
            f"{self.request.reference} - "
            f"{self.sequence} - {self.approver_type}"
        )

    def save(self, *args, **kwargs):
        if self.workflow_policy_id and not self.policy_name_snapshot:
            self.policy_name_snapshot = (
                self.workflow_policy.policy_name
            )

        if self.approver_id:
            if not self.approver_employee_id_snapshot:
                self.approver_employee_id_snapshot = (
                    self.approver.employee_id
                )
            if not self.approver_name_snapshot:
                self.approver_name_snapshot = (
                    self.approver.full_name
                )

        return super().save(*args, **kwargs)


class CorrectionRequestAttachment(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    SoftDeleteModel,
):
    """
    Uploaded evidence and supporting files for a correction request.
    """

    request = models.ForeignKey(
        CorrectionRequest,
        on_delete=models.PROTECT,
        related_name="attachments",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="correction_attachments",
    )
    file = models.FileField(
        upload_to=correction_attachment_upload_to,
    )
    original_name = models.CharField(
        max_length=255,
        blank=True,
    )
    content_type = models.CharField(
        max_length=120,
        blank=True,
    )
    size_bytes = models.PositiveIntegerField(
        default=0,
    )
    attachment_type = models.CharField(
        max_length=30,
        choices=CorrectionAttachmentType.choices,
        default=CorrectionAttachmentType.SUPPORTING_DOCUMENT,
        db_index=True,
    )

    class Meta:
        db_table = "correction_request_attachment"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["request", "is_deleted"],
                name="corr_attach_req_deleted_idx",
            ),
            models.Index(
                fields=["uploaded_by", "created_at"],
                name="corr_attach_user_date_idx",
            ),
        ]
        verbose_name = "Correction Request Attachment"
        verbose_name_plural = (
            "Correction Request Attachments"
        )

    def __str__(self) -> str:
        return self.original_name or str(self.file)

    def clean(self):
        super().clean()

        errors = {}
        file_name = (
            self.original_name
            or getattr(self.file, "name", "")
        )
        extension = os.path.splitext(file_name)[1].lower()

        if extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
            errors["file"] = (
                "Only PDF, Excel, CSV, and image files are allowed."
            )

        if (
            self.content_type
            and self.content_type
            not in ALLOWED_ATTACHMENT_CONTENT_TYPES
        ):
            errors["content_type"] = (
                "Uploaded file type is not allowed."
            )

        if self.size_bytes > MAX_ATTACHMENT_SIZE_BYTES:
            errors["file"] = (
                "Attachment size cannot exceed 10 MB."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.file:
            if not self.original_name:
                self.original_name = os.path.basename(
                    self.file.name
                )
            if not self.size_bytes:
                self.size_bytes = getattr(
                    self.file,
                    "size",
                    0,
                )

        self.full_clean()
        return super().save(*args, **kwargs)


class CorrectionRequestTimeline(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
):
    """
    Immutable event log for request lifecycle and user actions.
    """

    request = models.ForeignKey(
        CorrectionRequest,
        on_delete=models.PROTECT,
        related_name="timeline_entries",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="correction_timeline_entries",
        null=True,
        blank=True,
    )
    event_type = models.CharField(
        max_length=30,
        choices=CorrectionTimelineEventType.choices,
        db_index=True,
    )
    from_status = models.CharField(
        max_length=30,
        choices=CorrectionRequestStatus.choices,
        blank=True,
    )
    to_status = models.CharField(
        max_length=30,
        choices=CorrectionRequestStatus.choices,
        blank=True,
    )
    comment = models.TextField(
        blank=True,
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    class Meta:
        db_table = "correction_request_timeline"
        ordering = ["created_at"]
        indexes = [
            models.Index(
                fields=["request", "created_at"],
                name="corr_timeline_req_date_idx",
            ),
            models.Index(
                fields=["event_type", "created_at"],
                name="corr_timeline_event_date_idx",
            ),
        ]
        verbose_name = "Correction Request Timeline"
        verbose_name_plural = (
            "Correction Request Timelines"
        )

    def __str__(self) -> str:
        return (
            f"{self.request.reference} - "
            f"{self.event_type} - {self.created_at}"
        )


class CorrectionRequestResolution(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
):
    """
    ERP correction outcome recorded by the Responsible Person.

    A request may accumulate more than one resolution record across
    its lifetime when it is reopened and resolved again.
    """

    request = models.ForeignKey(
        CorrectionRequest,
        on_delete=models.PROTECT,
        related_name="resolutions",
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="correction_resolutions",
    )
    erp_action_completed = models.TextField()
    completion_date = models.DateField()
    erp_reference = models.CharField(
        max_length=100,
        blank=True,
    )
    access_window_start_used = models.DateTimeField(
        null=True,
        blank=True,
    )
    access_window_end_used = models.DateTimeField(
        null=True,
        blank=True,
    )
    actual_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    actual_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        null=True,
        blank=True,
    )
    final_comments = models.TextField(blank=True)

    class Meta:
        db_table = "correction_request_resolution"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["request", "created_at"],
                name="corr_resolution_req_date_idx",
            ),
        ]
        verbose_name = "Correction Request Resolution"
        verbose_name_plural = (
            "Correction Request Resolutions"
        )

    def __str__(self) -> str:
        return (
            f"{self.request.reference} - "
            f"{self.completion_date}"
        )

    def clean(self):
        super().clean()

        errors = {}

        if (
            self.completion_date
            and self.completion_date
            > timezone.localdate()
        ):
            errors["completion_date"] = (
                "Completion date cannot be in the future."
            )

        if (
            self.access_window_start_used
            and self.access_window_end_used
            and self.access_window_end_used
            < self.access_window_start_used
        ):
            errors["access_window_end_used"] = (
                "Access window end cannot be before the start."
            )

        if (
            self.actual_amount is not None
            and self.actual_amount < Decimal("0")
        ):
            errors["actual_amount"] = (
                "Actual amount cannot be negative."
            )

        if (
            self.actual_quantity is not None
            and self.actual_quantity < Decimal("0")
        ):
            errors["actual_quantity"] = (
                "Actual quantity cannot be negative."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
