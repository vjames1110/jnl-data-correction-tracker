from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import (
    PermissionDenied,
    ValidationError,
)

from apps.authentication.models import (
    AccountStatus,
    UserRole,
)
from apps.corrections.models import ApprovalStepStatus
from apps.notifications.models import (
    NotificationEventType,
)
from apps.notifications.services.delivery import (
    notify_users,
)
from apps.reconciliation.models import (
    ReconciliationApprovalStep,
    ReconciliationApproverType,
    ReconciliationPeriod,
    ReconciliationPeriodStatus,
)


@dataclass(frozen=True)
class ApprovalRouteStep:
    sequence: int
    approver_type: str
    approver: object
    level_name: str = ""


def find_primary_director():
    return (
        get_user_model()
        .objects.filter(
            role=UserRole.DIRECTOR,
            is_active=True,
            account_status=AccountStatus.ACTIVE,
        )
        .order_by("employee_id")
        .first()
    )


def build_approval_route() -> list[ApprovalRouteStep]:
    """
    Store HO prepares and submits every site's month; Director gives
    the (single) approval. Store HO is the preparer, not a reviewer,
    so it never appears in its own approval route.
    """
    director = find_primary_director()

    if director is None:
        return []

    return [
        ApprovalRouteStep(
            sequence=1,
            approver_type=ReconciliationApproverType.DIRECTOR,
            approver=director,
            level_name="Director Approval",
        )
    ]


def snapshot_approval_route(
    *,
    period: ReconciliationPeriod,
    route: list[ApprovalRouteStep],
) -> list[ReconciliationApprovalStep]:
    last_round = (
        period.approval_steps.aggregate(
            Max("round_number")
        )["round_number__max"]
        or 0
    )
    round_number = last_round + 1

    steps = [
        ReconciliationApprovalStep(
            period=period,
            round_number=round_number,
            sequence=route_step.sequence,
            level_name=route_step.level_name,
            approver_type=route_step.approver_type,
            approver=route_step.approver,
            is_current=index == 0,
            approver_employee_id_snapshot=(
                route_step.approver.employee_id
            ),
            approver_name_snapshot=(
                route_step.approver.full_name
            ),
        )
        for index, route_step in enumerate(route)
    ]

    return ReconciliationApprovalStep.objects.bulk_create(
        steps
    )


def notify_submission(
    *,
    period: ReconciliationPeriod,
    first_approver,
    actor,
) -> None:
    period_label = (
        f"{period.site.site_code} - "
        f"{period.period_month:%b %Y}"
    )

    if period.submitted_by_id:
        notify_users(
            recipients=[period.submitted_by],
            event_type=(
                NotificationEventType.RECONCILIATION_SUBMITTED
            ),
            title="Reconciliation submitted",
            message=(
                f"{period_label} was submitted for "
                "approval."
            ),
            deep_link=_entry_deep_link(period),
            actor=actor,
        )

    notify_users(
        recipients=[first_approver],
        event_type=(
            NotificationEventType.RECONCILIATION_APPROVAL_PENDING
        ),
        title="Reconciliation approval pending",
        message=(
            f"{period_label} is awaiting your approval."
        ),
        deep_link=_inbox_deep_link(),
        actor=actor,
    )


def approve_step(
    *,
    step: ReconciliationApprovalStep,
    user,
    comment: str = "",
    allow_admin: bool = False,
) -> ReconciliationApprovalStep:
    with transaction.atomic():
        locked_step = _locked_step(step)
        _validate_action_allowed(
            step=locked_step,
            user=user,
            allow_admin=allow_admin,
        )
        period = locked_step.period
        period_label = (
            f"{period.site.site_code} - "
            f"{period.period_month:%b %Y}"
        )

        locked_step.status = ApprovalStepStatus.APPROVED
        locked_step.is_current = False
        locked_step.decided_at = timezone.now()
        locked_step.comment = comment
        locked_step.save(
            update_fields=[
                "status",
                "is_current",
                "decided_at",
                "comment",
                "updated_at",
            ]
        )

        next_step = (
            period.approval_steps.filter(
                status=ApprovalStepStatus.PENDING,
            )
            .exclude(pk=locked_step.pk)
            .order_by("sequence")
            .first()
        )

        if next_step is not None:
            next_step.is_current = True
            next_step.save(
                update_fields=[
                    "is_current",
                    "updated_at",
                ]
            )
            notify_users(
                recipients=[next_step.approver],
                event_type=(
                    NotificationEventType.RECONCILIATION_APPROVAL_PENDING
                ),
                title="Reconciliation approval pending",
                message=(
                    f"{period_label} is awaiting "
                    "your approval."
                ),
                deep_link=_inbox_deep_link(),
                actor=user,
            )
        else:
            period.status = (
                ReconciliationPeriodStatus.APPROVED
            )
            period.save(
                update_fields=[
                    "status",
                    "updated_at",
                ]
            )
            if period.submitted_by_id:
                notify_users(
                    recipients=[period.submitted_by],
                    event_type=(
                        NotificationEventType.RECONCILIATION_APPROVED
                    ),
                    title="Reconciliation approved",
                    message=f"{period_label} was approved.",
                    deep_link=_entry_deep_link(period),
                    actor=user,
                )

        return locked_step


def reject_step(
    *,
    step: ReconciliationApprovalStep,
    user,
    comment: str = "",
    allow_admin: bool = False,
) -> ReconciliationApprovalStep:
    if not comment.strip():
        raise ValidationError(
            {"comment": "Rejection reason is required."}
        )

    return _close_approval_flow(
        step=step,
        user=user,
        status=ApprovalStepStatus.REJECTED,
        period_status=ReconciliationPeriodStatus.REJECTED,
        comment=comment,
        allow_admin=allow_admin,
        event_type=NotificationEventType.RECONCILIATION_REJECTED,
        title="Reconciliation rejected",
    )


def return_step(
    *,
    step: ReconciliationApprovalStep,
    user,
    comment: str = "",
    allow_admin: bool = False,
) -> ReconciliationApprovalStep:
    if not comment.strip():
        raise ValidationError(
            {
                "comment": (
                    "Return-for-correction reason is "
                    "required."
                )
            }
        )

    return _close_approval_flow(
        step=step,
        user=user,
        status=ApprovalStepStatus.RETURNED,
        period_status=ReconciliationPeriodStatus.DRAFT,
        comment=comment,
        allow_admin=allow_admin,
        event_type=NotificationEventType.RECONCILIATION_RETURNED,
        title="Reconciliation returned for correction",
    )


def _close_approval_flow(
    *,
    step: ReconciliationApprovalStep,
    user,
    status: str,
    period_status: str,
    comment: str,
    allow_admin: bool,
    event_type: str,
    title: str,
) -> ReconciliationApprovalStep:
    with transaction.atomic():
        locked_step = _locked_step(step)
        _validate_action_allowed(
            step=locked_step,
            user=user,
            allow_admin=allow_admin,
        )
        period = locked_step.period
        period_label = (
            f"{period.site.site_code} - "
            f"{period.period_month:%b %Y}"
        )

        locked_step.status = status
        locked_step.is_current = False
        locked_step.decided_at = timezone.now()
        locked_step.comment = comment
        locked_step.save(
            update_fields=[
                "status",
                "is_current",
                "decided_at",
                "comment",
                "updated_at",
            ]
        )

        period.approval_steps.filter(
            status=ApprovalStepStatus.PENDING,
        ).exclude(pk=locked_step.pk).update(
            status=ApprovalStepStatus.SKIPPED,
            is_current=False,
        )

        period.status = period_status
        period.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        if period.submitted_by_id:
            notify_users(
                recipients=[period.submitted_by],
                event_type=event_type,
                title=title,
                message=f"{period_label}: {comment}",
                deep_link=_entry_deep_link(period),
                actor=user,
            )

        return locked_step


def _entry_deep_link(period: ReconciliationPeriod) -> str:
    return (
        "/store/entry?month="
        f"{period.period_month:%Y-%m}&site={period.site_id}"
    )


def _inbox_deep_link() -> str:
    return "/store/approvals"


def _locked_step(
    step: ReconciliationApprovalStep,
) -> ReconciliationApprovalStep:
    return (
        ReconciliationApprovalStep.objects.select_for_update(
            of=("self",)
        )
        .select_related(
            "period",
            "period__site",
            "approver",
        )
        .get(pk=step.pk)
    )


def _validate_action_allowed(
    *,
    step: ReconciliationApprovalStep,
    user,
    allow_admin: bool = False,
) -> None:
    if not _is_active_user(user):
        raise PermissionDenied(
            "Active authenticated approver is required."
        )

    # ``allow_admin`` is decided by the caller (views.py), which
    # already knows the real role-based rule for who gets to
    # override the assigned approver - Admin/Super Admin, and now
    # Director too. Trust it as-is rather than re-deriving a
    # narrower admin-only check here, which would silently block
    # any future override role the caller is allowed to grant.
    if (
        not allow_admin
        and step.approver_id != user.id
    ):
        raise PermissionDenied(
            "Only the current approver can act on this "
            "approval step."
        )

    if step.status != ApprovalStepStatus.PENDING:
        raise ValidationError(
            {"status": "Approval step is not pending."}
        )

    if not step.is_current:
        raise ValidationError(
            {
                "sequence": (
                    "Approval step is not the current "
                    "level."
                )
            }
        )

    if (
        step.period.status
        != ReconciliationPeriodStatus.PENDING_APPROVAL
    ):
        raise ValidationError(
            {
                "period": (
                    "Period is not pending approval."
                )
            }
        )


def _is_active_user(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and user.account_status
        == AccountStatus.ACTIVE
    )


