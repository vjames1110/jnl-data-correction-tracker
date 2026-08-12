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
    CorrectionRequestResolution,
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


def resolve_work(
    *,
    request: CorrectionRequest,
    user,
    erp_action_completed: str,
    completion_date,
    final_comments: str = "",
    erp_reference: str = "",
    access_window_start_used=None,
    access_window_end_used=None,
    actual_amount=None,
    actual_quantity=None,
) -> CorrectionRequest:
    """
    Responsible Person records the ERP correction outcome and marks
    the request Resolved, ready for requester confirmation.
    """
    _ensure_is_current_owner(
        request=request,
        user=user,
    )
    _ensure_status(request)

    with transaction.atomic():
        locked_request = (
            CorrectionRequest.objects.select_for_update(
                of=("self",)
            )
            .select_related(
                "requester", "current_owner"
            )
            .get(pk=request.pk)
        )
        _ensure_is_current_owner(
            request=locked_request,
            user=user,
        )
        _ensure_status(locked_request)

        resolution = CorrectionRequestResolution(
            request=locked_request,
            resolved_by=user,
            erp_action_completed=(
                erp_action_completed.strip()
            ),
            completion_date=completion_date,
            erp_reference=erp_reference.strip(),
            access_window_start_used=(
                access_window_start_used
            ),
            access_window_end_used=(
                access_window_end_used
            ),
            actual_amount=actual_amount,
            actual_quantity=actual_quantity,
            final_comments=final_comments.strip(),
        )
        _save_or_raise(resolution)

        from_status = locked_request.current_status
        locked_request.current_status = (
            CorrectionRequestStatus.RESOLVED
        )
        _save_or_raise(locked_request)

        record_timeline(
            request=locked_request,
            actor=user,
            event_type=(
                CorrectionTimelineEventType.RESOLVED
            ),
            from_status=from_status,
            to_status=(
                CorrectionRequestStatus.RESOLVED
            ),
            comment=(
                final_comments.strip()
                or "Request resolved."
            ),
            metadata={
                "resolution_id": str(resolution.id),
                "erp_reference": erp_reference.strip(),
            },
        )
        notify_workflow_event(
            event_type=(
                NotificationEventType.REQUEST_RESOLVED
            ),
            correction_request=locked_request,
            recipients=[locked_request.requester],
            actor=user,
        )
        notify_workflow_event(
            event_type=(
                NotificationEventType.CONFIRMATION_PENDING
            ),
            correction_request=locked_request,
            recipients=[locked_request.requester],
            actor=user,
        )

        return locked_request


def _ensure_is_current_owner(
    *,
    request: CorrectionRequest,
    user,
) -> None:
    if request.current_owner_id != user.id:
        raise PermissionDenied(
            "Only the assigned Responsible Person can "
            "resolve this request."
        )


def _ensure_status(request: CorrectionRequest) -> None:
    if (
        request.current_status
        != CorrectionRequestStatus.IN_PROGRESS
    ):
        raise ValidationError(
            {
                "current_status": (
                    "Only in-progress requests can be "
                    "resolved."
                )
            }
        )


def _save_or_raise(instance) -> None:
    try:
        instance.save()
    except DjangoValidationError as exc:
        raise ValidationError(
            getattr(exc, "message_dict", None)
            or exc.messages
        ) from exc
