"""
The 48-hour edit/delete window on a task's own "meeting update" (see
``activity_engine.apply_update``) and on hiding/unhiding it (see
``activity_engine.hide_activity``/``unhide_activity``): a Project
Manager or Incharge may touch an activity only while it is still
within 48 hours of its own last change, or while an Admin/Director has
granted them a fresh 48-hour window on it. Director and above are
never restricted (``ADMIN_ROLES``) - adding a brand-new custom
activity is never restricted either, since there is nothing yet to
edit or delete.

The window is rolling, not one-time: every legitimate touch (by
anyone) resets ``Activity.updated_at``, so a person actively
correcting a task stays inside the window for as long as they keep
coming back within 48 hours of their own last edit. It only locks once
48 hours pass with no further activity.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import (
    PermissionDenied,
    ValidationError,
)

from apps.project_monitor.models import (
    ActivityEditAccessRequest,
    EditAccessRequestStatus,
)
from apps.project_monitor.services.project_scope import (
    ADMIN_ROLES,
)

EDIT_WINDOW = timedelta(hours=48)

# Matched by the frontend to offer a "Request edit access" action
# instead of a plain error - keep this exact wording stable.
EDIT_WINDOW_MESSAGE = (
    "This task hasn't been touched in the last 48 hours. Ask an "
    "Admin or Director for edit access, or send a request below."
)


class EditWindowExpired(PermissionDenied):
    default_detail = EDIT_WINDOW_MESSAGE
    default_code = "edit_window_expired"


def is_within_edit_window(activity) -> bool:
    return timezone.now() - activity.updated_at <= EDIT_WINDOW


def _active_grant(activity, user):
    return (
        activity.edit_access_requests.filter(
            created_by=user,
            status=EditAccessRequestStatus.GRANTED,
            access_until__gt=timezone.now(),
        )
        .order_by("-access_until")
        .first()
    )


def has_active_grant(activity, user) -> bool:
    return _active_grant(activity, user) is not None


def can_edit_activity(user, activity) -> bool:
    if user.role in ADMIN_ROLES:
        return True
    return is_within_edit_window(
        activity
    ) or has_active_grant(activity, user)


def ensure_can_edit_activity(user, activity) -> None:
    if not can_edit_activity(user, activity):
        raise EditWindowExpired()


def request_edit_access(
    *, activity, actor, reason=""
) -> ActivityEditAccessRequest:
    if actor.role in ADMIN_ROLES:
        raise ValidationError(
            "Admin and Director are never time-limited - there's "
            "nothing to request."
        )
    if is_within_edit_window(activity):
        raise ValidationError(
            "This task is still inside its 48-hour edit window - "
            "no request is needed yet."
        )
    if has_active_grant(activity, actor):
        raise ValidationError(
            "You already have an active edit-access grant for "
            "this task."
        )
    existing = activity.edit_access_requests.filter(
        created_by=actor,
        status=EditAccessRequestStatus.PENDING,
    ).first()
    if existing:
        raise ValidationError(
            "You already have a pending request for this task."
        )
    return ActivityEditAccessRequest.objects.create(
        activity=activity,
        reason=reason,
        created_by=actor,
        updated_by=actor,
    )


def _decide(
    request_obj, *, status, actor, remarks
) -> ActivityEditAccessRequest:
    if request_obj.status != EditAccessRequestStatus.PENDING:
        raise ValidationError(
            "This request has already been decided."
        )
    now = timezone.now()
    request_obj.status = status
    request_obj.decided_by = actor
    request_obj.decided_at = now
    request_obj.decision_remarks = remarks
    request_obj.access_until = (
        now + EDIT_WINDOW
        if status == EditAccessRequestStatus.GRANTED
        else None
    )
    request_obj.updated_by = actor
    request_obj.save(
        update_fields=[
            "status",
            "decided_by",
            "decided_at",
            "decision_remarks",
            "access_until",
            "updated_by",
            "updated_at",
        ]
    )
    return request_obj


def grant_edit_access(
    request_obj, *, actor, remarks=""
) -> ActivityEditAccessRequest:
    return _decide(
        request_obj,
        status=EditAccessRequestStatus.GRANTED,
        actor=actor,
        remarks=remarks,
    )


def deny_edit_access(
    request_obj, *, actor, remarks=""
) -> ActivityEditAccessRequest:
    return _decide(
        request_obj,
        status=EditAccessRequestStatus.DENIED,
        actor=actor,
        remarks=remarks,
    )
