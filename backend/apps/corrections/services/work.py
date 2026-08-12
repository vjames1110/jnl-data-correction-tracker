from django.core.exceptions import (
    ValidationError as DjangoValidationError,
)
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
from apps.corrections.services.timeline import (
    record_timeline,
)
from apps.notifications.models import (
    NotificationEventType,
)
from apps.notifications.services.delivery import (
    notify_workflow_event,
)


def accept_assignment(
    *,
    request: CorrectionRequest,
    user,
    comment: str = "",
) -> CorrectionRequest:
    """
    Responsible Person accepts a newly assigned request, optionally
    leaving an initial comment.
    """
    return _transition(
        request=request,
        user=user,
        from_statuses={
            CorrectionRequestStatus.ASSIGNED
        },
        to_status=CorrectionRequestStatus.ACCEPTED,
        action="ACCEPT",
        default_comment="Assignment accepted.",
        comment=comment,
        notification_event=(
            NotificationEventType.ASSIGNMENT_ACCEPTED
        ),
    )


def request_reassignment(
    *,
    request: CorrectionRequest,
    user,
    reason: str,
) -> CorrectionRequest:
    """
    Responsible Person declines a newly assigned request before
    accepting it, returning it to APPROVED for another assignment.
    """
    cleaned_reason = reason.strip()
    if not cleaned_reason:
        raise ValidationError(
            {
                "reason": (
                    "A reason is required to request "
                    "reassignment."
                )
            }
        )

    _ensure_is_current_owner(
        request=request,
        user=user,
    )
    _ensure_status(
        request=request,
        allowed={
            CorrectionRequestStatus.ASSIGNED
        },
    )

    with transaction.atomic():
        locked_request = _lock(request)
        _ensure_is_current_owner(
            request=locked_request,
            user=user,
        )
        _ensure_status(
            request=locked_request,
            allowed={
                CorrectionRequestStatus.ASSIGNED
            },
        )

        from_status = locked_request.current_status
        locked_request.current_status = (
            CorrectionRequestStatus.APPROVED
        )
        locked_request.current_owner = (
            locked_request.requester
        )
        _save_or_raise(locked_request)

        record_timeline(
            request=locked_request,
            actor=user,
            event_type=(
                CorrectionTimelineEventType.STATUS_CHANGED
            ),
            from_status=from_status,
            to_status=(
                CorrectionRequestStatus.APPROVED
            ),
            comment=cleaned_reason,
            metadata={
                "action": "REASSIGNMENT_REQUESTED",
                "declined_by": str(user.id),
            },
        )

        return locked_request


def start_work(
    *,
    request: CorrectionRequest,
    user,
    comment: str = "",
) -> CorrectionRequest:
    """Responsible Person marks accepted work as in progress."""
    return _transition(
        request=request,
        user=user,
        from_statuses={
            CorrectionRequestStatus.ACCEPTED
        },
        to_status=(
            CorrectionRequestStatus.IN_PROGRESS
        ),
        action="START_PROGRESS",
        default_comment="Work started.",
        comment=comment,
        notification_event=(
            NotificationEventType.WORK_IN_PROGRESS
        ),
    )


def hold_work(
    *,
    request: CorrectionRequest,
    user,
    reason: str,
    expected_resume_date=None,
    comment: str = "",
) -> CorrectionRequest:
    """Responsible Person pauses in-progress work."""
    cleaned_reason = reason.strip()
    if not cleaned_reason:
        raise ValidationError(
            {
                "reason": (
                    "A reason is required to place a "
                    "request on hold."
                )
            }
        )

    return _transition(
        request=request,
        user=user,
        from_statuses={
            CorrectionRequestStatus.IN_PROGRESS
        },
        to_status=CorrectionRequestStatus.ON_HOLD,
        action="HOLD",
        default_comment=cleaned_reason,
        comment=comment,
        metadata={
            "reason": cleaned_reason,
            "expected_resume_date": (
                expected_resume_date.isoformat()
                if expected_resume_date
                else ""
            ),
        },
    )


def resume_work(
    *,
    request: CorrectionRequest,
    user,
    comment: str = "",
) -> CorrectionRequest:
    """Responsible Person resumes work that was on hold."""
    return _transition(
        request=request,
        user=user,
        from_statuses={
            CorrectionRequestStatus.ON_HOLD
        },
        to_status=(
            CorrectionRequestStatus.IN_PROGRESS
        ),
        action="RESUME",
        default_comment="Work resumed.",
        comment=comment,
    )


def _transition(
    *,
    request: CorrectionRequest,
    user,
    from_statuses: set,
    to_status: str,
    action: str,
    default_comment: str,
    comment: str = "",
    metadata: dict | None = None,
    notification_event: str | None = None,
) -> CorrectionRequest:
    _ensure_is_current_owner(
        request=request,
        user=user,
    )
    _ensure_status(
        request=request,
        allowed=from_statuses,
    )

    with transaction.atomic():
        locked_request = _lock(request)
        _ensure_is_current_owner(
            request=locked_request,
            user=user,
        )
        _ensure_status(
            request=locked_request,
            allowed=from_statuses,
        )

        from_status = locked_request.current_status
        locked_request.current_status = to_status
        _save_or_raise(locked_request)

        record_timeline(
            request=locked_request,
            actor=user,
            event_type=(
                CorrectionTimelineEventType.STATUS_CHANGED
            ),
            from_status=from_status,
            to_status=to_status,
            comment=(
                comment.strip() or default_comment
            ),
            metadata={
                "action": action,
                **(metadata or {}),
            },
        )

        if notification_event:
            notify_workflow_event(
                event_type=notification_event,
                correction_request=locked_request,
                recipients=[
                    locked_request.requester
                ],
                actor=user,
            )

        return locked_request


def _lock(
    request: CorrectionRequest,
) -> CorrectionRequest:
    return (
        CorrectionRequest.objects.select_for_update(
            of=("self",)
        )
        .select_related("requester", "current_owner")
        .get(pk=request.pk)
    )


def _ensure_is_current_owner(
    *,
    request: CorrectionRequest,
    user,
) -> None:
    if request.current_owner_id != user.id:
        raise PermissionDenied(
            "Only the assigned Responsible Person can "
            "perform this action."
        )


def _ensure_status(
    *,
    request: CorrectionRequest,
    allowed: set,
) -> None:
    if request.current_status not in allowed:
        raise ValidationError(
            {
                "current_status": (
                    "This action is not available from "
                    f"{request.current_status} status."
                )
            }
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
