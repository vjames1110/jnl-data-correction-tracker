from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.notifications.models import (
    NotificationEventType,
)
from apps.notifications.services.delivery import (
    notify_users,
)
from apps.reconciliation.models import (
    ReconciliationPeriod,
    ReconciliationPeriodStatus,
)
from apps.reconciliation.services.approvals import (
    build_approval_route,
    notify_submission,
    snapshot_approval_route,
)


def get_or_create_period(*, site, period_month):
    normalized_month = period_month.replace(day=1)

    period, _ = (
        ReconciliationPeriod.objects.get_or_create(
            site=site,
            period_month=normalized_month,
        )
    )
    return period


def submit_period(*, period: ReconciliationPeriod, user):
    with transaction.atomic():
        locked_period = (
            ReconciliationPeriod.objects.select_for_update(
                of=("self",),
            )
            .select_related("site")
            .get(pk=period.pk)
        )

        if not locked_period.is_editable:
            raise ValidationError(
                {
                    "status": (
                        "Period is not in a "
                        "submittable state."
                    )
                }
            )

        if not locked_period.entries.exists():
            raise ValidationError(
                {
                    "status": (
                        "Add at least one entry "
                        "before submitting."
                    )
                }
            )

        route = build_approval_route()
        if not route:
            raise ValidationError(
                {
                    "approval_configuration": (
                        "No active Director is "
                        "configured to approve "
                        "reconciliation periods. "
                        "Contact an administrator."
                    )
                }
            )

        locked_period.status = (
            ReconciliationPeriodStatus.PENDING_APPROVAL
        )
        locked_period.submitted_by = user
        locked_period.submitted_at = timezone.now()
        locked_period.save(
            update_fields=[
                "status",
                "submitted_by",
                "submitted_at",
                "updated_at",
            ]
        )
        steps = snapshot_approval_route(
            period=locked_period,
            route=route,
        )

    notify_submission(
        period=locked_period,
        first_approver=steps[0].approver,
        actor=user,
    )
    return locked_period


def reopen_period(*, period: ReconciliationPeriod, user):
    """
    Recover a permanently-terminal ``Rejected`` period back to
    ``Draft`` so the store can correct and resubmit it, instead of
    the month being unrecoverable. The rejected round's approval
    steps are left exactly as they were - they're the audit record
    of why it was rejected - a resubmission after this starts a
    fresh round, same as after a Return.
    """
    with transaction.atomic():
        locked_period = (
            ReconciliationPeriod.objects.select_for_update(
                of=("self",),
            )
            .select_related("site", "submitted_by")
            .get(pk=period.pk)
        )

        if (
            locked_period.status
            != ReconciliationPeriodStatus.REJECTED
        ):
            raise ValidationError(
                {
                    "status": (
                        "Only a rejected period can "
                        "be reopened."
                    )
                }
            )

        locked_period.status = (
            ReconciliationPeriodStatus.DRAFT
        )
        locked_period.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

    period_label = (
        f"{locked_period.site.site_code} - "
        f"{locked_period.period_month:%b %Y}"
    )
    if locked_period.submitted_by_id:
        notify_users(
            recipients=[locked_period.submitted_by],
            event_type=(
                NotificationEventType.RECONCILIATION_RETURNED
            ),
            title="Reconciliation reopened",
            message=(
                f"{period_label} was reopened by "
                f"{user.full_name} for correction. "
                "You can edit and resubmit it."
            ),
            deep_link=(
                "/store/entry?month="
                f"{locked_period.period_month:%Y-%m}"
                f"&site={locked_period.site_id}"
            ),
            actor=user,
        )

    return locked_period
