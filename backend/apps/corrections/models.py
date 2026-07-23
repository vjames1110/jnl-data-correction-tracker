import os
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import (
    SoftDeleteModel,
    TimeStampedModel,
    UUIDPrimaryKeyModel,
)
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
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    RESOLVED = "RESOLVED", "Resolved"
    REOPENED = "REOPENED", "Reopened"
    CLOSED = "CLOSED", "Closed"
    REJECTED = "REJECTED", "Rejected"
    CANCELLED = "CANCELLED", "Cancelled"


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
