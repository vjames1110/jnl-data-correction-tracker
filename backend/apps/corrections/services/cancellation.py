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
    can_cancel_request,
)
from apps.corrections.services.timeline import (
    record_timeline,
)


CANCELLABLE_STATUSES = {
    CorrectionRequestStatus.DRAFT,
    CorrectionRequestStatus.SUBMITTED,
    CorrectionRequestStatus.PENDING_APPROVAL,
    CorrectionRequestStatus.APPROVED,
    CorrectionRequestStatus.ASSIGNED,
    CorrectionRequestStatus.REOPENED,
}


def cancel_request(
    *,
    request: CorrectionRequest,
    user,
    reason: str = "",
) -> CorrectionRequest:
    if not can_access_request(
        request=request,
        user=user,
    ):
        raise PermissionDenied(
            "You do not have access to this correction request."
        )

    if not can_cancel_request(
        request=request,
        user=user,
    ):
        raise PermissionDenied(
            "Only the requester or an admin can cancel this request."
        )

    if request.current_status not in CANCELLABLE_STATUSES:
        raise ValidationError(
            {
                "current_status": (
                    "This request cannot be cancelled from "
                    f"{request.current_status} status."
                )
            }
        )

    with transaction.atomic():
        locked_request = (
            CorrectionRequest.objects.select_for_update()
            .select_related("requester", "current_owner")
            .get(pk=request.pk)
        )
        if not can_access_request(
            request=locked_request,
            user=user,
        ):
            raise PermissionDenied(
                "You do not have access to this correction request."
            )
        if not can_cancel_request(
            request=locked_request,
            user=user,
        ):
            raise PermissionDenied(
                "Only the requester or an admin can cancel this request."
            )
        if (
            locked_request.current_status
            not in CANCELLABLE_STATUSES
        ):
            raise ValidationError(
                {
                    "current_status": (
                        "This request cannot be cancelled from "
                        f"{locked_request.current_status} status."
                    )
                }
            )

        from_status = locked_request.current_status
        locked_request.current_status = (
            CorrectionRequestStatus.CANCELLED
        )
        locked_request.current_owner = locked_request.requester
        _save_or_raise(locked_request)

        record_timeline(
            request=locked_request,
            actor=user,
            event_type=(
                CorrectionTimelineEventType.STATUS_CHANGED
            ),
            from_status=from_status,
            to_status=CorrectionRequestStatus.CANCELLED,
            comment=(
                reason.strip()
                or "Correction request cancelled."
            ),
        )

        return locked_request


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
