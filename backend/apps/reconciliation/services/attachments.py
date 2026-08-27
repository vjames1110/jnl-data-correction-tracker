from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import (
    NotFound,
    ValidationError,
)

from apps.reconciliation.models import (
    ReconciliationPeriod,
    ReconciliationPeriodAttachment,
    ReconciliationPeriodStatus,
)


# Evidence can only be added/removed while the period is still being
# prepared - once submitted, entries themselves are already locked
# (see StoreEntryPage's isEditable), so attachments follow the same
# window rather than a separate rule to explain.
ATTACHMENT_EDITABLE_STATUSES = {
    ReconciliationPeriodStatus.DRAFT,
}


def _ensure_attachments_unlocked(
    period: ReconciliationPeriod,
) -> None:
    if period.status not in ATTACHMENT_EDITABLE_STATUSES:
        raise ValidationError(
            {
                "status": (
                    "Attachments can only be added or "
                    "removed while the period is in "
                    "Draft."
                )
            }
        )


def create_attachment(
    *,
    period: ReconciliationPeriod,
    user,
    file,
    notes: str = "",
) -> ReconciliationPeriodAttachment:
    _ensure_attachments_unlocked(period)

    with transaction.atomic():
        attachment = ReconciliationPeriodAttachment(
            period=period,
            uploaded_by=user,
            file=file,
            original_name=getattr(file, "name", ""),
            content_type=getattr(
                file,
                "content_type",
                "",
            ),
            size_bytes=getattr(file, "size", 0),
            notes=notes,
        )
        _save_or_raise(attachment)
        return attachment


def delete_attachment(
    *,
    attachment: ReconciliationPeriodAttachment,
    user,
) -> ReconciliationPeriodAttachment:
    _ensure_attachments_unlocked(
        attachment.period
    )

    with transaction.atomic():
        locked_attachment = (
            ReconciliationPeriodAttachment.objects.select_for_update(
                of=("self",)
            )
            .select_related("period", "uploaded_by")
            .get(pk=attachment.pk)
        )
        _ensure_attachments_unlocked(
            locked_attachment.period
        )
        locked_attachment.is_deleted = True
        locked_attachment.deleted_at = timezone.now()
        locked_attachment.deleted_by = user
        locked_attachment.save(
            update_fields=[
                "is_deleted",
                "deleted_at",
                "deleted_by",
                "updated_at",
            ]
        )
        return locked_attachment


def get_attachment_or_404(
    *,
    attachment_id,
) -> ReconciliationPeriodAttachment:
    try:
        return (
            ReconciliationPeriodAttachment.objects.select_related(
                "period",
                "period__site",
                "uploaded_by",
            ).get(
                id=attachment_id,
                is_deleted=False,
            )
        )
    except ReconciliationPeriodAttachment.DoesNotExist as exc:
        raise NotFound(
            "Attachment was not found."
        ) from exc


def _save_or_raise(
    attachment: ReconciliationPeriodAttachment,
) -> None:
    try:
        attachment.save()
    except DjangoValidationError as exc:
        raise ValidationError(
            getattr(exc, "message_dict", None)
            or exc.messages
        ) from exc
