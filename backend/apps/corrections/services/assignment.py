from django.core.exceptions import (
    ValidationError as DjangoValidationError,
)
from django.db import transaction
from django.db.models import Count, Q
from rest_framework.exceptions import (
    PermissionDenied,
    ValidationError,
)

from apps.authentication.models import (
    AccountStatus,
    UserRole,
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
from apps.erp.models import ResponsiblePersonMapping
from apps.notifications.models import (
    NotificationEventType,
)
from apps.notifications.services.delivery import (
    notify_workflow_event,
)


ACTIVE_ASSIGNMENT_STATUSES = (
    CorrectionRequestStatus.ASSIGNED,
    CorrectionRequestStatus.IN_PROGRESS,
)

MANUALLY_ASSIGNABLE_STATUSES = {
    CorrectionRequestStatus.APPROVED,
    CorrectionRequestStatus.ASSIGNED,
}

REASSIGNABLE_STATUSES = {
    CorrectionRequestStatus.ACCEPTED,
    CorrectionRequestStatus.IN_PROGRESS,
    CorrectionRequestStatus.ON_HOLD,
    CorrectionRequestStatus.RESOLVED,
    CorrectionRequestStatus.REOPENED,
    CorrectionRequestStatus.CLOSED,
}

REQUESTER_REASSIGNABLE_STATUSES = {
    CorrectionRequestStatus.RESOLVED,
    CorrectionRequestStatus.REOPENED,
    CorrectionRequestStatus.CLOSED,
}


def resolve_responsible_person(
    request: CorrectionRequest,
) -> ResponsiblePersonMapping | None:
    """
    Match a request against active Responsible Person mappings.

    Candidates are ranked by mapping specificity first, current active
    workload second, and configured display order last, so evenly
    matched responsible persons do not get overloaded.
    """
    candidates = list(_matching_mappings(request))
    if not candidates:
        return None

    if len(candidates) == 1:
        return candidates[0]

    workload = _active_workload(
        {
            mapping.responsible_person_id
            for mapping in candidates
        }
    )

    return min(
        candidates,
        key=lambda mapping: (
            -_specificity_score(mapping),
            workload.get(
                mapping.responsible_person_id, 0
            ),
            mapping.display_order,
            str(mapping.id),
        ),
    )


def _matching_mappings(request: CorrectionRequest):
    return ResponsiblePersonMapping.objects.filter(
        is_active=True,
        erp_module_id=request.erp_module_id,
    ).filter(
        Q(voucher_type__isnull=True)
        | Q(voucher_type_id=request.voucher_type_id),
        Q(department__isnull=True)
        | Q(department_id=request.department_id),
        Q(site__isnull=True)
        | Q(site_id=request.site_id),
        Q(work_type__isnull=True)
        | Q(work_type_id=request.work_type_id),
        Q(priority__isnull=True)
        | Q(priority_id=request.priority_id),
    ).select_related("responsible_person")


def _specificity_score(
    mapping: ResponsiblePersonMapping,
) -> int:
    fields = [
        mapping.voucher_type_id,
        mapping.department_id,
        mapping.site_id,
        mapping.work_type_id,
        mapping.priority_id,
    ]
    return sum(1 for value in fields if value)


def _active_workload(responsible_person_ids) -> dict:
    counts = (
        CorrectionRequest.objects.filter(
            current_owner_id__in=responsible_person_ids,
            current_status__in=ACTIVE_ASSIGNMENT_STATUSES,
            is_deleted=False,
        )
        .values("current_owner_id")
        .annotate(total=Count("id"))
    )
    return {
        row["current_owner_id"]: row["total"]
        for row in counts
    }


def assign_request(
    *,
    request: CorrectionRequest,
    responsible_person,
    actor,
    comment: str = "",
) -> CorrectionRequest:
    """
    Manually assign, or override the automatically resolved
    Responsible Person for, an approved or already-assigned request.
    """
    return _apply_assignment(
        request=request,
        responsible_person=responsible_person,
        actor=actor,
        allowed_statuses=MANUALLY_ASSIGNABLE_STATUSES,
        status_error=(
            "Only approved or assigned requests can be "
            "manually assigned."
        ),
        note=(
            comment.strip()
            or "Request manually assigned."
        ),
        metadata={"manual": True},
    )


def reassign_request(
    *,
    request: CorrectionRequest,
    responsible_person,
    actor,
    reason: str,
) -> CorrectionRequest:
    """
    Reassign a request that is already being worked on to a
    different Responsible Person.

    The request is reset to ASSIGNED so the new owner goes through
    acceptance themselves; the previous owner and reason stay visible
    through the request's timeline history, and workload is picked up
    live the next time an assignment is resolved since it is computed
    from each candidate's current active requests rather than a
    stored counter.

    A resolved or reopened request may also be reassigned by its own
    requester (in addition to an admin or authorized approver) so a
    correction that was not actually completed, or completed
    incorrectly, can be routed to a different Responsible Person with
    a reason, without waiting on an admin.
    """
    cleaned_reason = reason.strip()
    if not cleaned_reason:
        raise ValidationError(
            {
                "reason": (
                    "A reason is required to reassign "
                    "this request."
                )
            }
        )

    return _apply_assignment(
        request=request,
        responsible_person=responsible_person,
        actor=actor,
        allowed_statuses=REASSIGNABLE_STATUSES,
        status_error=(
            "Only accepted, in-progress, on-hold, "
            "resolved, reopened or closed requests "
            "can be reassigned."
        ),
        note=cleaned_reason,
        metadata={
            "reassigned": True,
            "reason": cleaned_reason,
        },
        ensure_permission=_ensure_can_reassign,
    )


def _apply_assignment(
    *,
    request: CorrectionRequest,
    responsible_person,
    actor,
    allowed_statuses: set,
    status_error: str,
    note: str,
    metadata: dict,
    ensure_permission=None,
) -> CorrectionRequest:
    ensure_permission = (
        ensure_permission or _ensure_can_assign
    )
    ensure_permission(
        request=request,
        actor=actor,
    )
    _ensure_valid_responsible_person(
        responsible_person
    )
    _ensure_status_in(
        request=request,
        allowed=allowed_statuses,
        error_message=status_error,
    )

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
        ensure_permission(
            request=locked_request,
            actor=actor,
        )
        _ensure_status_in(
            request=locked_request,
            allowed=allowed_statuses,
            error_message=status_error,
        )

        previous_owner = locked_request.current_owner
        from_status = locked_request.current_status
        locked_request.current_status = (
            CorrectionRequestStatus.ASSIGNED
        )
        locked_request.current_owner = (
            responsible_person
        )
        _save_or_raise(locked_request)

        record_timeline(
            request=locked_request,
            actor=actor,
            event_type=(
                CorrectionTimelineEventType.ASSIGNED
            ),
            from_status=from_status,
            to_status=(
                CorrectionRequestStatus.ASSIGNED
            ),
            comment=note,
            metadata={
                "assigned_by": str(actor.id),
                "assigned_to": str(
                    responsible_person.id
                ),
                "previous_owner": (
                    str(previous_owner.id)
                    if previous_owner
                    else ""
                ),
                **metadata,
            },
        )
        notify_workflow_event(
            event_type=(
                NotificationEventType.REQUEST_ASSIGNED
            ),
            correction_request=locked_request,
            recipients=[responsible_person],
            actor=actor,
        )

        return locked_request


def _ensure_can_assign(
    *,
    request: CorrectionRequest,
    actor,
) -> None:
    if not can_access_request(
        request=request,
        user=actor,
    ):
        raise PermissionDenied(
            "You do not have access to this correction request."
        )

    if _is_admin_user(actor) or actor.has_role(
        UserRole.DIRECTOR
    ):
        return

    raise PermissionDenied(
        "Only an admin or an authorized approver can "
        "assign this request."
    )


def _ensure_can_reassign(
    *,
    request: CorrectionRequest,
    actor,
) -> None:
    if not can_access_request(
        request=request,
        user=actor,
    ):
        raise PermissionDenied(
            "You do not have access to this correction request."
        )

    if _is_admin_user(actor) or actor.has_role(
        UserRole.DIRECTOR
    ):
        return

    if (
        request.requester_id == actor.id
        and request.current_status
        in REQUESTER_REASSIGNABLE_STATUSES
    ):
        return

    raise PermissionDenied(
        "Only an admin, an authorized approver, or "
        "the requester of a resolved, reopened or "
        "closed request can reassign this request."
    )


def _ensure_valid_responsible_person(user) -> None:
    if (
        user is None
        or user.role != UserRole.RESPONSIBLE_PERSON
        or not user.is_active
        or user.account_status
        != AccountStatus.ACTIVE
    ):
        raise ValidationError(
            {
                "responsible_person": (
                    "Selected user must be an active "
                    "Responsible Person."
                )
            }
        )


def _ensure_status_in(
    *,
    request: CorrectionRequest,
    allowed: set,
    error_message: str,
) -> None:
    if request.current_status not in allowed:
        raise ValidationError(
            {"current_status": error_message}
        )


def _is_admin_user(user) -> bool:
    return bool(
        user
        and (
            user.is_staff
            or user.has_role(
                UserRole.SUPER_ADMIN,
                UserRole.ADMIN,
            )
        )
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
