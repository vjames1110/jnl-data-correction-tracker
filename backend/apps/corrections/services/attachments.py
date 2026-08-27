from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import (
    NotFound,
    PermissionDenied,
    ValidationError,
)

from apps.corrections.models import (
    CorrectionRequest,
    CorrectionRequestAttachment,
    CorrectionRequestStatus,
    CorrectionTimelineEventType,
)
from apps.corrections.services.access import (
    can_access_request,
    visible_request_queryset,
)
from apps.corrections.services.timeline import (
    record_timeline,
)


# A request in one of these statuses is done - unlike every other
# state-mutating service in this app, attachment add/delete had no
# status gate at all, so evidence could still be added or removed
# after the record was supposed to be finalized.
ATTACHMENT_LOCKED_STATUSES = {
    CorrectionRequestStatus.CLOSED,
    CorrectionRequestStatus.REJECTED,
    CorrectionRequestStatus.CANCELLED,
}


def _ensure_attachments_unlocked(
    request: CorrectionRequest,
) -> None:
    if request.current_status in ATTACHMENT_LOCKED_STATUSES:
        raise ValidationError(
            {
                "current_status": (
                    "Attachments cannot be added or "
                    "removed on a "
                    f"{request.get_current_status_display()} "
                    "request."
                )
            }
        )


def create_attachment(
    *,
    request: CorrectionRequest,
    user,
    file,
    attachment_type: str,
) -> CorrectionRequestAttachment:
    validate_request_access(
        request=request,
        user=user,
    )
    _ensure_attachments_unlocked(request)

    with transaction.atomic():
        attachment = CorrectionRequestAttachment(
            request=request,
            uploaded_by=user,
            file=file,
            original_name=getattr(file, "name", ""),
            content_type=getattr(
                file,
                "content_type",
                "",
            ),
            size_bytes=getattr(file, "size", 0),
            attachment_type=attachment_type,
        )
        _save_or_raise(attachment)

        record_timeline(
            request=request,
            actor=user,
            event_type=(
                CorrectionTimelineEventType.ATTACHMENT_ADDED
            ),
            from_status=request.current_status,
            to_status=request.current_status,
            comment="Attachment added.",
            metadata={
                "attachment_id": str(attachment.id),
                "file_name": attachment.original_name,
                "content_type": attachment.content_type,
                "size_bytes": attachment.size_bytes,
            },
        )
        return attachment


def delete_attachment(
    *,
    attachment: CorrectionRequestAttachment,
    user,
) -> CorrectionRequestAttachment:
    validate_request_access(
        request=attachment.request,
        user=user,
    )
    _ensure_attachments_unlocked(attachment.request)

    with transaction.atomic():
        locked_attachment = (
            CorrectionRequestAttachment.objects.select_for_update(
                of=("self",)
            )
            .select_related("request", "uploaded_by")
            .get(pk=attachment.pk)
        )
        validate_request_access(
            request=locked_attachment.request,
            user=user,
        )
        _ensure_attachments_unlocked(
            locked_attachment.request
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

        record_timeline(
            request=locked_attachment.request,
            actor=user,
            event_type=(
                CorrectionTimelineEventType.ATTACHMENT_DELETED
            ),
            from_status=(
                locked_attachment.request.current_status
            ),
            to_status=(
                locked_attachment.request.current_status
            ),
            comment="Attachment removed.",
            metadata={
                "attachment_id": str(
                    locked_attachment.id
                ),
                "file_name": (
                    locked_attachment.original_name
                ),
            },
        )
        return locked_attachment


def get_accessible_request_or_404(
    *,
    request_id,
    user,
) -> CorrectionRequest:
    try:
        request = CorrectionRequest.objects.select_related(
            "requester",
            "current_owner",
        ).get(
            id=request_id,
            is_deleted=False,
        )
    except CorrectionRequest.DoesNotExist as exc:
        raise NotFound(
            "Correction request was not found."
        ) from exc

    validate_request_access(
        request=request,
        user=user,
    )
    return request


def validate_request_access(
    *,
    request: CorrectionRequest,
    user,
) -> None:
    if _can_access_request(
        request=request,
        user=user,
    ):
        return

    raise PermissionDenied(
        "You do not have access to this correction request."
    )


def accessible_request_queryset(user):
    return visible_request_queryset(user)


def _can_access_request(
    *,
    request: CorrectionRequest,
    user,
) -> bool:
    return can_access_request(
        request=request,
        user=user,
    )


def _save_or_raise(
    attachment: CorrectionRequestAttachment,
) -> None:
    try:
        attachment.save()
    except DjangoValidationError as exc:
        raise ValidationError(
            getattr(exc, "message_dict", None)
            or exc.messages
        ) from exc
