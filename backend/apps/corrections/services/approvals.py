from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import (
    PermissionDenied,
    ValidationError,
)

from apps.authentication.models import (
    AccountStatus,
    UserRole,
)
from apps.corrections.models import (
    ApprovalApproverType,
    ApprovalStepStatus,
    ApprovalWorkflowPolicy,
    CorrectionApprovalStep,
    CorrectionRequest,
    CorrectionRequestStatus,
    CorrectionTimelineEventType,
)
from apps.corrections.services.timeline import (
    record_timeline,
)
from apps.organization.models import (
    ApprovalAuthorityType,
    DirectorMapping,
)


@dataclass(frozen=True)
class ApprovalRouteStep:
    sequence: int
    approver_type: str
    approver: object
    level_name: str = ""
    sla_hours: int | None = None
    escalation_hours: int | None = None


def build_approval_route(
    request: CorrectionRequest,
) -> tuple[
    ApprovalWorkflowPolicy | None,
    list[ApprovalRouteStep],
]:
    policy = find_workflow_policy(request)
    director = find_default_approval_owner(request)
    admin = find_primary_admin()

    if director is None and admin is None:
        return policy, []

    timing_level = _first_policy_level(policy)
    route = []

    if director is not None:
        route.append(
            ApprovalRouteStep(
                sequence=1,
                approver_type=ApprovalApproverType.DIRECTOR,
                approver=director,
                level_name="Director Approval",
                sla_hours=(
                    timing_level.sla_hours
                    if timing_level
                    else None
                ),
                escalation_hours=(
                    timing_level.escalation_hours
                    if timing_level
                    else None
                ),
            )
        )

    if admin is not None and admin.id != getattr(
        director,
        "id",
        None,
    ):
        route.append(
            ApprovalRouteStep(
                sequence=2 if director else 1,
                approver_type=ApprovalApproverType.ADMIN_FINAL,
                approver=admin,
                level_name="Admin Approval",
                sla_hours=(
                    timing_level.sla_hours
                    if timing_level
                    else None
                ),
                escalation_hours=(
                    timing_level.escalation_hours
                    if timing_level
                    else None
                ),
            )
        )

    return policy, route


def find_workflow_policy(
    request: CorrectionRequest,
) -> ApprovalWorkflowPolicy | None:
    request_amount = request.amount or Decimal("0")
    queryset = (
        ApprovalWorkflowPolicy.objects.filter(
            is_active=True,
            is_deleted=False,
        )
        .filter(
            Q(site__isnull=True)
            | Q(site_id=request.site_id),
            Q(department__isnull=True)
            | Q(department_id=request.department_id),
            Q(erp_module__isnull=True)
            | Q(erp_module_id=request.erp_module_id),
            Q(voucher_type__isnull=True)
            | Q(voucher_type_id=request.voucher_type_id),
            Q(work_type__isnull=True)
            | Q(work_type_id=request.work_type_id),
            Q(priority__isnull=True)
            | Q(priority_id=request.priority_id),
            Q(amount_min__isnull=True)
            | Q(amount_min__lte=request_amount),
            Q(amount_max__isnull=True)
            | Q(amount_max__gte=request_amount),
        )
        .prefetch_related("approval_levels")
    )

    candidates = list(queryset)
    if not candidates:
        return None

    return sorted(
        candidates,
        key=_policy_specificity,
        reverse=True,
    )[0]


def find_default_approval_owner(
    request: CorrectionRequest,
):
    today = timezone.localdate()
    queryset = DirectorMapping.objects.filter(
        is_active=True,
        authority_type=ApprovalAuthorityType.PRIMARY,
    ).filter(
        Q(effective_from__isnull=True)
        | Q(effective_from__lte=today),
        Q(effective_to__isnull=True)
        | Q(effective_to__gte=today),
    )

    site_mapping = (
        queryset.filter(site_id=request.site_id)
        .order_by("-effective_from", "created_at")
        .first()
    )
    if site_mapping and _is_director_user(
        site_mapping.director
    ):
        return site_mapping.director

    department_mapping = (
        queryset.filter(department_id=request.department_id)
        .order_by("-effective_from", "created_at")
        .first()
    )
    if department_mapping and _is_director_user(
        department_mapping.director
    ):
        return department_mapping.director

    if (
        request.site_id
        and request.site.site_director_id
        and _is_director_user(request.site.site_director)
    ):
        return request.site.site_director

    return None


def find_primary_admin():
    return (
        get_user_model()
        .objects.filter(
            role__in=[
                UserRole.ADMIN,
                UserRole.SUPER_ADMIN,
            ],
            is_active=True,
            account_status=AccountStatus.ACTIVE,
        )
        .order_by("employee_id")
        .first()
    )


def resolve_level_approver(*, level, request):
    if (
        level.approver_type
        == ApprovalApproverType.DEPARTMENT_HOD
    ):
        return (
            request.department.department_hod
            if request.department_id
            else None
        )

    if level.approver_type == ApprovalApproverType.SITE_HOD:
        return (
            request.site.site_hod
            if request.site_id
            else None
        )

    if level.approver_type == ApprovalApproverType.DIRECTOR:
        return find_default_approval_owner(request)

    if (
        level.approver_type
        == ApprovalApproverType.ADMIN_FINAL
    ):
        return find_primary_admin()

    if level.approver_type == ApprovalApproverType.CUSTOM:
        return level.custom_approver

    return None


def snapshot_approval_route(
    *,
    request: CorrectionRequest,
    policy: ApprovalWorkflowPolicy | None,
    route: list[ApprovalRouteStep],
    submitted_at,
) -> list[CorrectionApprovalStep]:
    if request.approval_steps.exists():
        return list(
            request.approval_steps.order_by("sequence")
        )

    steps = []
    for index, route_step in enumerate(route):
        due_at = (
            submitted_at
            + timedelta(hours=route_step.sla_hours)
            if route_step.sla_hours
            else None
        )
        escalates_at = (
            submitted_at
            + timedelta(
                hours=route_step.escalation_hours
            )
            if route_step.escalation_hours
            else None
        )

        steps.append(
            CorrectionApprovalStep(
                request=request,
                workflow_policy=policy,
                sequence=route_step.sequence,
                level_name=route_step.level_name,
                approver_type=route_step.approver_type,
                approver=route_step.approver,
                is_current=index == 0,
                due_at=due_at,
                escalates_at=escalates_at,
                policy_name_snapshot=(
                    policy.policy_name if policy else ""
                ),
                approver_employee_id_snapshot=(
                    route_step.approver.employee_id
                ),
                approver_name_snapshot=(
                    route_step.approver.full_name
                ),
                snapshot={
                    "policy_id": str(policy.id)
                    if policy
                    else "",
                    "policy_name": (
                        policy.policy_name if policy else ""
                    ),
                    "sequence": route_step.sequence,
                    "level_name": route_step.level_name,
                    "approver_type": route_step.approver_type,
                    "approver_id": str(
                        route_step.approver.id
                    ),
                    "approver_employee_id": (
                        route_step.approver.employee_id
                    ),
                    "approver_name": (
                        route_step.approver.full_name
                    ),
                    "sla_hours": route_step.sla_hours,
                    "escalation_hours": (
                        route_step.escalation_hours
                    ),
                },
            )
        )

    return CorrectionApprovalStep.objects.bulk_create(
        steps
    )


def approve_step(
    *,
    step: CorrectionApprovalStep,
    user,
    comment: str = "",
    allow_admin: bool = False,
) -> CorrectionApprovalStep:
    with transaction.atomic():
        locked_step = _locked_step(step)
        _validate_action_allowed(
            step=locked_step,
            user=user,
            allow_admin=allow_admin,
        )
        correction_request = locked_step.request
        from_status = correction_request.current_status

        locked_step.status = ApprovalStepStatus.APPROVED
        locked_step.is_current = False
        locked_step.decided_at = timezone.now()
        locked_step.save(
            update_fields=[
                "status",
                "is_current",
                "decided_at",
                "updated_at",
            ]
        )

        correction_request.approval_steps.filter(
            status=ApprovalStepStatus.PENDING
        ).exclude(pk=locked_step.pk).update(
            status=ApprovalStepStatus.SKIPPED,
            is_current=False,
        )
        correction_request.current_status = (
            CorrectionRequestStatus.APPROVED
        )
        correction_request.current_owner = user
        correction_request.save(
            update_fields=[
                "current_status",
                "current_owner",
                "updated_at",
            ]
        )

        record_timeline(
            request=correction_request,
            actor=user,
            event_type=CorrectionTimelineEventType.APPROVAL_ACTION,
            from_status=from_status,
            to_status=correction_request.current_status,
            comment=comment,
            metadata={
                "action": "APPROVE",
                "step_id": str(locked_step.id),
                "sequence": locked_step.sequence,
                "admin_intervention": allow_admin,
                "first_decision_wins": True,
            },
        )

        return locked_step


def reject_step(
    *,
    step: CorrectionApprovalStep,
    user,
    comment: str = "",
    allow_admin: bool = False,
) -> CorrectionApprovalStep:
    if not comment.strip():
        raise ValidationError(
            {"comment": "Rejection reason is required."}
        )

    return _close_approval_flow(
        step=step,
        user=user,
        status=ApprovalStepStatus.REJECTED,
        request_status=CorrectionRequestStatus.REJECTED,
        action="REJECT",
        comment=comment,
        allow_admin=allow_admin,
    )


def return_step(
    *,
    step: CorrectionApprovalStep,
    user,
    comment: str = "",
    allow_admin: bool = False,
) -> CorrectionApprovalStep:
    if not comment.strip():
        raise ValidationError(
            {
                "comment": (
                    "Return-for-clarification reason is required."
                )
            }
        )

    return _close_approval_flow(
        step=step,
        user=user,
        status=ApprovalStepStatus.RETURNED,
        request_status=CorrectionRequestStatus.REOPENED,
        action="RETURN",
        comment=comment,
        allow_admin=allow_admin,
    )


def delegate_step(
    *,
    step: CorrectionApprovalStep,
    user,
    delegate_to,
    comment: str = "",
    allow_admin: bool = False,
) -> CorrectionApprovalStep:
    if delegate_to is None:
        raise ValidationError(
            {"delegate_to": "Delegate approver is required."}
        )

    if delegate_to.id == step.approver_id:
        raise ValidationError(
            {
                "delegate_to": (
                    "Delegate approver must be different from "
                    "the current approver."
                )
            }
        )

    if not (
        delegate_to.is_active
        and delegate_to.account_status
        == AccountStatus.ACTIVE
    ):
        raise ValidationError(
            {
                "delegate_to": (
                    "Delegate approver must be an active user."
                )
            }
        )

    with transaction.atomic():
        locked_step = _locked_step(step)
        _validate_action_allowed(
            step=locked_step,
            user=user,
            allow_admin=allow_admin,
        )
        previous_approver = locked_step.approver
        locked_step.approver = delegate_to
        locked_step.approver_type = (
            ApprovalApproverType.CUSTOM
        )
        locked_step.save(
            update_fields=[
                "approver",
                "approver_type",
                "updated_at",
            ]
        )
        locked_step.request.current_owner = delegate_to
        locked_step.request.save(
            update_fields=[
                "current_owner",
                "updated_at",
            ]
        )

        record_timeline(
            request=locked_step.request,
            actor=user,
            event_type=CorrectionTimelineEventType.APPROVAL_ACTION,
            from_status=locked_step.request.current_status,
            to_status=locked_step.request.current_status,
            comment=comment,
            metadata={
                "action": "DELEGATE",
                "step_id": str(locked_step.id),
                "sequence": locked_step.sequence,
                "from_approver_id": str(previous_approver.id),
                "from_approver_employee_id": (
                    previous_approver.employee_id
                ),
                "to_approver_id": str(delegate_to.id),
                "to_approver_employee_id": (
                    delegate_to.employee_id
                ),
                "admin_intervention": allow_admin,
            },
        )

        return locked_step


def add_approval_comment(
    *,
    step: CorrectionApprovalStep,
    user,
    comment: str,
    allow_admin: bool = False,
) -> CorrectionApprovalStep:
    if not comment.strip():
        raise ValidationError(
            {"comment": "Comment is required."}
        )

    _validate_action_allowed(
        step=step,
        user=user,
        allow_admin=allow_admin,
    )
    record_timeline(
        request=step.request,
        actor=user,
        event_type=CorrectionTimelineEventType.APPROVAL_ACTION,
        from_status=step.request.current_status,
        to_status=step.request.current_status,
        comment=comment,
        metadata={
            "action": "COMMENT",
            "step_id": str(step.id),
            "sequence": step.sequence,
            "admin_intervention": allow_admin,
        },
    )

    return step


def send_approval_reminder(
    *,
    step: CorrectionApprovalStep,
    user,
    comment: str = "",
    allow_admin: bool = False,
) -> CorrectionApprovalStep:
    _validate_action_allowed(
        step=step,
        user=user,
        allow_admin=allow_admin,
    )
    record_timeline(
        request=step.request,
        actor=user,
        event_type=CorrectionTimelineEventType.APPROVAL_ACTION,
        from_status=step.request.current_status,
        to_status=step.request.current_status,
        comment=comment or "Approval reminder recorded.",
        metadata={
            "action": "REMINDER",
            "step_id": str(step.id),
            "sequence": step.sequence,
            "reminded_approver_id": str(step.approver_id),
            "reminded_approver_employee_id": (
                step.approver.employee_id
            ),
            "admin_intervention": allow_admin,
        },
    )
    return step


def escalate_step(
    *,
    step: CorrectionApprovalStep,
    user,
    backup_approver=None,
    comment: str = "",
    allow_admin: bool = False,
) -> CorrectionApprovalStep:
    with transaction.atomic():
        locked_step = _locked_step(step)
        _validate_action_allowed(
            step=locked_step,
            user=user,
            allow_admin=allow_admin,
        )
        previous_approver = locked_step.approver

        if backup_approver is not None:
            if not (
                backup_approver.is_active
                and backup_approver.account_status
                == AccountStatus.ACTIVE
            ):
                raise ValidationError(
                    {
                        "backup_approver": (
                            "Backup approver must be an active user."
                        )
                    }
                )
            locked_step.approver = backup_approver
            locked_step.request.current_owner = backup_approver
            locked_step.save(
                update_fields=[
                    "approver",
                    "updated_at",
                ]
            )
            locked_step.request.save(
                update_fields=[
                    "current_owner",
                    "updated_at",
                ]
            )

        record_timeline(
            request=locked_step.request,
            actor=user,
            event_type=CorrectionTimelineEventType.APPROVAL_ACTION,
            from_status=locked_step.request.current_status,
            to_status=locked_step.request.current_status,
            comment=comment or "Approval step escalated.",
            metadata={
                "action": "ESCALATE",
                "step_id": str(locked_step.id),
                "sequence": locked_step.sequence,
                "from_approver_id": str(previous_approver.id),
                "backup_approver_id": (
                    str(backup_approver.id)
                    if backup_approver
                    else ""
                ),
                "admin_intervention": allow_admin,
            },
        )

        return locked_step


def record_sla_breaches(*, now=None) -> int:
    current_time = now or timezone.now()
    breached_steps = CorrectionApprovalStep.objects.filter(
        status=ApprovalStepStatus.PENDING,
        is_current=True,
        due_at__isnull=False,
        due_at__lt=current_time,
        request__current_status=CorrectionRequestStatus.PENDING_APPROVAL,
    ).select_related("request", "approver")

    recorded = 0
    for step in breached_steps:
        exists = step.request.timeline_entries.filter(
            event_type=CorrectionTimelineEventType.APPROVAL_ACTION,
            metadata__action="SLA_BREACH",
            metadata__step_id=str(step.id),
        ).exists()
        if exists:
            continue

        record_timeline(
            request=step.request,
            actor=None,
            event_type=CorrectionTimelineEventType.APPROVAL_ACTION,
            from_status=step.request.current_status,
            to_status=step.request.current_status,
            comment="Approval SLA breached.",
            metadata={
                "action": "SLA_BREACH",
                "step_id": str(step.id),
                "sequence": step.sequence,
                "approver_id": str(step.approver_id),
                "due_at": step.due_at.isoformat(),
            },
        )
        recorded += 1

    return recorded


def _policy_specificity(
    policy: ApprovalWorkflowPolicy,
) -> tuple[int, int, int]:
    scope_fields = [
        policy.site_id,
        policy.department_id,
        policy.erp_module_id,
        policy.voucher_type_id,
        policy.work_type_id,
        policy.priority_id,
        policy.amount_min,
        policy.amount_max,
    ]
    return (
        sum(1 for value in scope_fields if value is not None),
        policy.approval_levels.filter(
            is_deleted=False
        ).count(),
        -policy.display_order,
    )


def _first_policy_level(policy):
    if policy is None:
        return None

    return (
        policy.approval_levels.filter(
            is_deleted=False
        )
        .order_by("sequence")
        .first()
    )


def _locked_step(
    step: CorrectionApprovalStep,
) -> CorrectionApprovalStep:
    return (
        CorrectionApprovalStep.objects.select_for_update()
        .select_related(
            "request",
            "request__site",
            "request__site__site_director",
            "request__site__site_hod",
            "request__department",
            "request__department__department_hod",
            "approver",
        )
        .get(pk=step.pk)
    )


def _validate_action_allowed(
    *,
    step: CorrectionApprovalStep,
    user,
    allow_admin: bool = False,
) -> None:
    if not _is_active_user(user):
        raise PermissionDenied(
            "Active authenticated approver is required."
        )

    is_admin = _is_admin_user(user)
    admin_override = allow_admin and is_admin

    if not admin_override and step.approver_id != user.id:
        raise PermissionDenied(
            "Only the current approver can act on this approval step."
        )

    if step.status != ApprovalStepStatus.PENDING:
        raise ValidationError(
            {"status": "Approval step is not pending."}
        )

    if not step.is_current:
        raise ValidationError(
            {"sequence": "Approval step is not the current level."}
        )

    if (
        step.request.current_status
        != CorrectionRequestStatus.PENDING_APPROVAL
    ):
        raise ValidationError(
            {
                "request": (
                    "Request is not pending approval."
                )
            }
        )

    if (
        not admin_override
        and not _has_context_access(step=step, user=user)
    ):
        raise PermissionDenied(
            "Approver does not have site or department access for this request."
        )


def _close_approval_flow(
    *,
    step: CorrectionApprovalStep,
    user,
    status: str,
    request_status: str,
    action: str,
    comment: str,
    allow_admin: bool = False,
) -> CorrectionApprovalStep:
    with transaction.atomic():
        locked_step = _locked_step(step)
        _validate_action_allowed(
            step=locked_step,
            user=user,
            allow_admin=allow_admin,
        )
        correction_request = locked_step.request
        from_status = correction_request.current_status
        locked_step.status = status
        locked_step.is_current = False
        locked_step.decided_at = timezone.now()
        locked_step.save(
            update_fields=[
                "status",
                "is_current",
                "decided_at",
                "updated_at",
            ]
        )
        correction_request.approval_steps.filter(
            status=ApprovalStepStatus.PENDING
        ).exclude(pk=locked_step.pk).update(
            status=ApprovalStepStatus.SKIPPED,
            is_current=False,
        )
        correction_request.current_status = request_status
        correction_request.current_owner = (
            correction_request.requester
        )
        correction_request.save(
            update_fields=[
                "current_status",
                "current_owner",
                "updated_at",
            ]
        )

        record_timeline(
            request=correction_request,
            actor=user,
            event_type=CorrectionTimelineEventType.APPROVAL_ACTION,
            from_status=from_status,
            to_status=request_status,
            comment=comment,
            metadata={
                "action": action,
                "step_id": str(locked_step.id),
                "sequence": locked_step.sequence,
                "admin_intervention": allow_admin,
            },
        )

        return locked_step


def _has_context_access(
    *,
    step: CorrectionApprovalStep,
    user,
) -> bool:
    if _is_admin_user(user):
        return True

    if step.approver_type in {
        ApprovalApproverType.CUSTOM,
        ApprovalApproverType.ADMIN_FINAL,
    }:
        return True

    request = step.request

    if (
        request.department_id
        and request.department.department_hod_id
        == user.id
    ):
        return True

    if (
        request.site_id
        and request.site.site_hod_id == user.id
    ):
        return True

    if (
        request.site_id
        and request.site.site_director_id == user.id
    ):
        return True

    if (
        user.has_role(UserRole.DIRECTOR)
        and _director_authorized_for_request(
            request=request,
            user=user,
        )
    ):
        return True

    try:
        profile = user.employee_profile
    except Exception:
        return False

    return bool(
        (
            request.site_id
            and profile.site_id == request.site_id
        )
        or (
            request.department_id
            and profile.department_id
            == request.department_id
        )
    )


def _director_authorized_for_request(
    *,
    request: CorrectionRequest,
    user,
) -> bool:
    today = timezone.localdate()
    return DirectorMapping.objects.filter(
        director=user,
        is_active=True,
    ).filter(
        Q(effective_from__isnull=True)
        | Q(effective_from__lte=today),
        Q(effective_to__isnull=True)
        | Q(effective_to__gte=today),
    ).filter(
        Q(site_id=request.site_id)
        | Q(department_id=request.department_id)
    ).exists()


def _is_active_user(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and user.account_status
        == AccountStatus.ACTIVE
    )


def _is_active_account(user) -> bool:
    return bool(
        user
        and user.is_active
        and user.account_status
        == AccountStatus.ACTIVE
    )


def _is_director_user(user) -> bool:
    return bool(
        _is_active_account(user)
        and user.has_role(UserRole.DIRECTOR)
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
