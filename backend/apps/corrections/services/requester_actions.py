from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import (
    PermissionDenied,
    ValidationError,
)

from apps.corrections.models import (
    CorrectionRequest,
    CorrectionRequestStatus,
    CorrectionTimelineEventType,
)
from apps.corrections.services.access import (
    can_access_request,
)
from apps.corrections.services.timeline import (
    record_timeline,
)
from apps.notifications.models import (
    NotificationEventType,
)
from apps.notifications.services.delivery import (
    notify_workflow_event,
)


def add_request_comment(
    *,
    request: CorrectionRequest,
    user,
    comment: str,
    response_type: str = "COMMENT",
) -> CorrectionRequest:
    _ensure_access(
        request=request,
        user=user,
    )

    cleaned_comment = comment.strip()
    if not cleaned_comment:
        raise ValidationError(
            {
                "comment": (
                    "Comment is required."
                )
            }
        )

    record_timeline(
        request=request,
        actor=user,
        event_type=CorrectionTimelineEventType.COMMENT,
        from_status=request.current_status,
        to_status=request.current_status,
        comment=cleaned_comment,
        metadata={
            "response_type": response_type,
        },
    )

    return request


def confirm_resolution(
    *,
    request: CorrectionRequest,
    user,
    comment: str = "",
) -> CorrectionRequest:
    _ensure_requester(
        request=request,
        user=user,
    )

    if (
        request.current_status
        != CorrectionRequestStatus.RESOLVED
    ):
        raise ValidationError(
            {
                "current_status": (
                    "Only resolved requests can be confirmed."
                )
            }
        )

    with transaction.atomic():
        locked_request = (
            CorrectionRequest.objects.select_for_update(
                of=("self",)
            )
            .select_related("requester", "current_owner")
            .get(pk=request.pk)
        )
        _ensure_requester(
            request=locked_request,
            user=user,
        )

        if (
            locked_request.current_status
            != CorrectionRequestStatus.RESOLVED
        ):
            raise ValidationError(
                {
                    "current_status": (
                        "Only resolved requests can be confirmed."
                    )
                }
            )

        locked_request.current_status = (
            CorrectionRequestStatus.CLOSED
        )
        locked_request.current_owner = user
        _save_or_raise(locked_request)

        record_timeline(
            request=locked_request,
            actor=user,
            event_type=CorrectionTimelineEventType.CLOSED,
            from_status=CorrectionRequestStatus.RESOLVED,
            to_status=CorrectionRequestStatus.CLOSED,
            comment=(
                comment.strip()
                or "Resolution confirmed by requester."
            ),
        )

        return locked_request


def reopen_request(
    *,
    request: CorrectionRequest,
    user,
    comment: str,
) -> CorrectionRequest:
    _ensure_requester(
        request=request,
        user=user,
    )

    cleaned_comment = comment.strip()
    if not cleaned_comment:
        raise ValidationError(
            {
                "comment": (
                    "Reopen reason is required."
                )
            }
        )

    if request.current_status not in {
        CorrectionRequestStatus.RESOLVED,
        CorrectionRequestStatus.CLOSED,
    }:
        raise ValidationError(
            {
                "current_status": (
                    "Only resolved or closed requests can be reopened."
                )
            }
        )

    with transaction.atomic():
        locked_request = (
            CorrectionRequest.objects.select_for_update(
                of=("self",)
            )
            .select_related("requester", "current_owner")
            .get(pk=request.pk)
        )
        _ensure_requester(
            request=locked_request,
            user=user,
        )

        if locked_request.current_status not in {
            CorrectionRequestStatus.RESOLVED,
            CorrectionRequestStatus.CLOSED,
        }:
            raise ValidationError(
                {
                    "current_status": (
                        "Only resolved or closed requests can be reopened."
                    )
                }
            )

        from_status = locked_request.current_status
        locked_request.current_status = (
            CorrectionRequestStatus.REOPENED
        )
        _save_or_raise(locked_request)

        record_timeline(
            request=locked_request,
            actor=user,
            event_type=CorrectionTimelineEventType.REOPENED,
            from_status=from_status,
            to_status=CorrectionRequestStatus.REOPENED,
            comment=cleaned_comment,
        )
        notify_workflow_event(
            event_type=NotificationEventType.REQUEST_REOPENED,
            correction_request=locked_request,
            recipients=[
                locked_request.current_owner
            ]
            if locked_request.current_owner_id
            != locked_request.requester_id
            else [],
            actor=user,
        )

        return locked_request


def _ensure_access(
    *,
    request: CorrectionRequest,
    user,
) -> None:
    if not can_access_request(
        request=request,
        user=user,
    ):
        raise PermissionDenied(
            "You do not have access to this correction request."
        )


def _ensure_requester(
    *,
    request: CorrectionRequest,
    user,
) -> None:
    _ensure_access(
        request=request,
        user=user,
    )

    if request.requester_id != user.id:
        raise PermissionDenied(
            "Only the requester can perform this action."
        )


def _save_or_raise(
    request: CorrectionRequest,
) -> None:
    try:
        request.save()
    except DjangoValidationError as exc:
        raise ValidationError(
            getattr(exc, "message_dict", None)
            or exc.messages
        ) from exc
