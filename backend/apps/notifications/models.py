import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class NotificationEventType(models.TextChoices):
    REQUEST_SUBMITTED = (
        "REQUEST_SUBMITTED",
        "Request Submitted",
    )
    APPROVAL_PENDING = (
        "APPROVAL_PENDING",
        "Approval Pending",
    )
    REQUEST_APPROVED = (
        "REQUEST_APPROVED",
        "Request Approved",
    )
    REQUEST_REJECTED = (
        "REQUEST_REJECTED",
        "Request Rejected",
    )
    CLARIFICATION_REQUIRED = (
        "CLARIFICATION_REQUIRED",
        "Clarification Required",
    )
    REQUEST_ASSIGNED = (
        "REQUEST_ASSIGNED",
        "Request Assigned",
    )
    ASSIGNMENT_ACCEPTED = (
        "ASSIGNMENT_ACCEPTED",
        "Assignment Accepted",
    )
    WORK_IN_PROGRESS = (
        "WORK_IN_PROGRESS",
        "Work In Progress",
    )
    REQUEST_RESOLVED = (
        "REQUEST_RESOLVED",
        "Request Resolved",
    )
    CONFIRMATION_PENDING = (
        "CONFIRMATION_PENDING",
        "Confirmation Pending",
    )
    REQUEST_REOPENED = (
        "REQUEST_REOPENED",
        "Request Reopened",
    )
    SLA_WARNING = "SLA_WARNING", "SLA Warning"
    SLA_BREACH = "SLA_BREACH", "SLA Breach"


class NotificationSeverity(models.TextChoices):
    INFO = "INFO", "Info"
    SUCCESS = "SUCCESS", "Success"
    WARNING = "WARNING", "Warning"
    CRITICAL = "CRITICAL", "Critical"


class NotificationEmailStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    SENT = "SENT", "Sent"
    SKIPPED = "SKIPPED", "Skipped"
    FAILED = "FAILED", "Failed"


class Notification(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="triggered_notifications",
        null=True,
        blank=True,
    )
    correction_request = models.ForeignKey(
        "corrections.CorrectionRequest",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    event_type = models.CharField(
        max_length=40,
        choices=NotificationEventType.choices,
        db_index=True,
    )
    severity = models.CharField(
        max_length=20,
        choices=NotificationSeverity.choices,
        default=NotificationSeverity.INFO,
        db_index=True,
    )
    title = models.CharField(max_length=180)
    message = models.TextField(blank=True)
    deep_link = models.CharField(
        max_length=255,
        blank=True,
    )
    payload = models.JSONField(default=dict, blank=True)
    delivered_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notifications_notification"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["recipient", "read_at"],
                name="notif_recipient_read_idx",
            ),
            models.Index(
                fields=["recipient", "event_type"],
                name="notif_recipient_event_idx",
            ),
            models.Index(
                fields=[
                    "correction_request",
                    "event_type",
                ],
                name="notif_request_event_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.recipient_id} - {self.event_type}"

    @property
    def is_read(self) -> bool:
        return self.read_at is not None

    def mark_read(self):
        if self.read_at is None:
            self.read_at = timezone.now()
            self.save(
                update_fields=["read_at", "updated_at"]
            )


class NotificationPreference(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preference",
    )
    in_app_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=False)
    muted_event_types = models.JSONField(
        default=list,
        blank=True,
    )
    quiet_hours_start = models.TimeField(
        null=True,
        blank=True,
    )
    quiet_hours_end = models.TimeField(
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notifications_preference"
        ordering = ["user__employee_id"]

    def __str__(self) -> str:
        return f"{self.user_id} notification preferences"

    def allows_event(self, event_type: str) -> bool:
        return self.allows_in_app_event(event_type)

    def allows_in_app_event(self, event_type: str) -> bool:
        return (
            self.in_app_enabled
            and event_type
            not in set(self.muted_event_types or [])
        )

    def allows_email_event(self, event_type: str) -> bool:
        return (
            self.email_enabled
            and event_type
            not in set(self.muted_event_types or [])
        )


class NotificationEmailDelivery(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="email_deliveries",
    )
    recipient_email = models.EmailField()
    status = models.CharField(
        max_length=20,
        choices=NotificationEmailStatus.choices,
        default=NotificationEmailStatus.PENDING,
        db_index=True,
    )
    provider_message_id = models.CharField(
        max_length=255,
        blank=True,
    )
    error_message = models.TextField(blank=True)
    attempted_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notifications_email_delivery"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["notification", "status"],
                name="notif_email_notif_status_idx",
            ),
            models.Index(
                fields=["recipient_email", "status"],
                name="notif_email_recipient_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.recipient_email} - {self.status}"
