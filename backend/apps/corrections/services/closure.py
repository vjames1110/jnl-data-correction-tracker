from decimal import Decimal

from django.core.exceptions import (
    ValidationError as DjangoValidationError,
)
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone
from rest_framework.exceptions import (
    ValidationError,
)

from apps.corrections.models import (
    ClosureType,
    CorrectionAutoCloseSettings,
    CorrectionRequest,
    CorrectionRequestStatus,
    CorrectionTimelineEventType,
    SlaResult,
)
from apps.corrections.services.timeline import (
    record_timeline,
)
from apps.notifications.models import (
    Notification,
    NotificationEventType,
)
from apps.notifications.services.delivery import (
    notify_workflow_event,
)


def get_auto_close_settings() -> (
    CorrectionAutoCloseSettings
):
    return CorrectionAutoCloseSettings.get_solo()


def compute_final_sla_result(
    *,
    request: CorrectionRequest,
    closed_at,
) -> str:
    if not request.sla_deadline:
        return SlaResult.NOT_APPLICABLE

    if closed_at <= request.sla_deadline:
        return SlaResult.MET

    return SlaResult.BREACHED


def compute_resolution_duration_hours(
    *,
    request: CorrectionRequest,
    closed_at,
) -> Decimal | None:
    started_at = (
        request.submitted_at or request.created_at
    )
    if not started_at:
        return None

    hours = (
        closed_at - started_at
    ).total_seconds() / 3600

    return Decimal(str(round(max(hours, 0), 2)))


def apply_closure(
    *,
    request: CorrectionRequest,
    closure_type: str,
    comment: str,
    closed_by=None,
    reassign_owner_to=None,
) -> CorrectionRequest:
    """
    Shared terminal-closure transition used by both an explicit
    requester confirmation and the automatic closure sweep, so the
    audit fields (closure type, final SLA result, resolution
    duration) are always computed the same way regardless of how a
    request reaches CLOSED.
    """
    closed_at = timezone.now()
    from_status = request.current_status

    request.current_status = (
        CorrectionRequestStatus.CLOSED
    )
    request.closed_at = closed_at
    request.closed_by = closed_by
    request.closure_type = closure_type
    request.final_sla_result = (
        compute_final_sla_result(
            request=request,
            closed_at=closed_at,
        )
    )
    request.resolution_duration_hours = (
        compute_resolution_duration_hours(
            request=request,
            closed_at=closed_at,
        )
    )
    if reassign_owner_to is not None:
        request.current_owner = reassign_owner_to

    _save_or_raise(request)

    record_timeline(
        request=request,
        actor=closed_by,
        event_type=CorrectionTimelineEventType.CLOSED,
        from_status=from_status,
        to_status=CorrectionRequestStatus.CLOSED,
        comment=comment,
        metadata={"closure_type": closure_type},
    )

    return request


def _eligible_resolved_queryset(
    *,
    settings: CorrectionAutoCloseSettings,
    cutoff,
):
    queryset = CorrectionRequest.objects.filter(
        current_status=(
            CorrectionRequestStatus.RESOLVED
        ),
        is_deleted=False,
        updated_at__lte=cutoff,
    )

    if settings.exclude_critical_priority:
        queryset = queryset.exclude(
            priority__priority_name__iexact="Critical"
        )

    return queryset


def run_auto_close_sweep(*, now=None) -> dict:
    """
    Close every resolved request the requester never confirmed or
    reopened within the configured window.

    Intended to be invoked periodically outside the request/response
    cycle (management command, or an admin-triggered API action)
    since background scheduling (Celery) is not wired up yet.
    """
    settings = get_auto_close_settings()
    if not settings.is_enabled:
        return {
            "enabled": False,
            "closed": [],
        }

    now = now or timezone.now()
    cutoff = now - timezone.timedelta(
        days=settings.auto_close_after_days
    )
    candidates = _eligible_resolved_queryset(
        settings=settings,
        cutoff=cutoff,
    )

    closed_references = []

    for request_id in list(
        candidates.values_list("id", flat=True)
    ):
        closed_reference = _auto_close_one(
            request_id=request_id,
        )
        if closed_reference:
            closed_references.append(
                closed_reference
            )

    return {
        "enabled": True,
        "closed": closed_references,
    }


def _auto_close_one(*, request_id) -> str | None:
    with transaction.atomic():
        try:
            locked_request = (
                CorrectionRequest.objects.select_for_update(
                    of=("self",)
                )
                .select_related("requester")
                .get(pk=request_id)
            )
        except CorrectionRequest.DoesNotExist:
            return None

        if (
            locked_request.current_status
            != CorrectionRequestStatus.RESOLVED
        ):
            return None

        apply_closure(
            request=locked_request,
            closure_type=ClosureType.AUTO_CLOSED,
            comment=(
                "Automatically closed after the "
                "configured number of days without "
                "requester confirmation."
            ),
        )

        notify_workflow_event(
            event_type=(
                NotificationEventType.REQUEST_AUTO_CLOSED
            ),
            correction_request=locked_request,
            recipients=[locked_request.requester],
        )

        return locked_request.reference


def run_auto_close_reminder_sweep(
    *,
    now=None,
) -> dict:
    """
    Remind requesters, once per resolution, that a resolved request
    will be auto-closed soon unless they confirm or reassign it.
    """
    settings = get_auto_close_settings()
    if not settings.is_enabled:
        return {
            "enabled": False,
            "reminded": [],
        }

    now = now or timezone.now()
    reminder_after_days = (
        settings.auto_close_after_days
        - settings.reminder_before_days
    )
    cutoff = now - timezone.timedelta(
        days=reminder_after_days
    )

    already_reminded = Notification.objects.filter(
        correction_request=OuterRef("pk"),
        event_type=(
            NotificationEventType.AUTO_CLOSE_REMINDER
        ),
        created_at__gte=OuterRef("updated_at"),
    )
    candidates = (
        _eligible_resolved_queryset(
            settings=settings,
            cutoff=cutoff,
        )
        .filter(~Exists(already_reminded))
        .select_related("requester")
    )

    reminded_references = []

    for request in candidates:
        notify_workflow_event(
            event_type=(
                NotificationEventType.AUTO_CLOSE_REMINDER
            ),
            correction_request=request,
            recipients=[request.requester],
        )
        reminded_references.append(request.reference)

    return {
        "enabled": True,
        "reminded": reminded_references,
    }


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
