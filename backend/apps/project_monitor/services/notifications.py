"""
Wires Project Monitor into the app's existing, already-shared
notification system (``apps.notifications`` - the same ``Notification``
model/``notify_users()`` helper Corrections and Reconciliation already
use) rather than a parallel mechanism. Two directions only, per the
roadmap's own Phase 7 line item (the "review" half of that line is
already covered by the per-activity sign-off in ``services/review.py``):

1. A PM/Admin "meeting update" on any activity notifies the Site's
   Director, deduped per (site, meeting_date) so revising many rows in
   one sitting produces one notification, not one per row.
2. A review (single activity, or a whole sheet reviewed at once)
   notifies whoever last updated the activity/activities - not a
   role-wide broadcast - skipping the reviewer themselves.
"""

from apps.authentication.models import UserRole
from apps.notifications.models import (
    Notification,
    NotificationEventType,
)
from apps.notifications.services.delivery import notify_users
from apps.project_monitor.models import GirderSpan


def resolve_activity_site(activity):
    """
    ``Activity`` only carries a generic ``parent`` (Structure/
    Building/GirderJob/GirderSpan/ActionItem) - every one of those
    already has a ``site`` FK except ``GirderSpan``, which reaches it
    through its own parent ``GirderJob``.
    """
    parent = activity.parent
    if parent is None:
        return None
    if isinstance(parent, GirderSpan):
        return parent.job.site
    return getattr(parent, "site", None)


def _project_label(site) -> str:
    return site.project_name or site.site_name


def _overview_deep_link(role: str, site_id) -> str:
    if role == UserRole.PROJECT_MANAGER:
        base = "/project-manager/dashboard"
    elif role == UserRole.DIRECTOR:
        base = "/director/project-monitor"
    else:
        base = "/admin/project-monitor"
    return f"{base}?site={site_id}"


def notify_director_of_update(
    *, activity, meeting_date, actor
) -> None:
    site = resolve_activity_site(activity)
    if (
        not site
        or not site.site_director_id
        or site.site_director_id == actor.id
    ):
        return

    meeting_date_iso = meeting_date.isoformat()
    already_notified = _notification_exists(
        recipient_id=site.site_director_id,
        event_type=(
            NotificationEventType.PROJECT_MONITOR_UPDATE_LOGGED
        ),
        site_id=str(site.id),
        meeting_date=meeting_date_iso,
    )
    if already_notified:
        return

    notify_users(
        recipients=[site.site_director],
        event_type=(
            NotificationEventType.PROJECT_MONITOR_UPDATE_LOGGED
        ),
        actor=actor,
        title="Project update logged",
        message=(
            f"{actor.full_name} logged progress updates for "
            f"{_project_label(site)} ahead of the "
            f"{meeting_date:%d-%m-%Y} meeting."
        ),
        deep_link=_overview_deep_link(
            UserRole.DIRECTOR, site.id
        ),
        payload={
            "site": str(site.id),
            "meeting_date": meeting_date_iso,
        },
    )


def _notification_exists(
    *, recipient_id, event_type, site_id, meeting_date
) -> bool:
    return Notification.objects.filter(
        recipient_id=recipient_id,
        event_type=event_type,
        payload__site=site_id,
        payload__meeting_date=meeting_date,
    ).exists()


def notify_activity_reviewed(*, activity, actor) -> None:
    site = resolve_activity_site(activity)
    if not site:
        return
    _notify_reviewed_users(
        activities=[activity],
        site=site,
        label=activity.name,
        actor=actor,
    )


def notify_sheet_reviewed(
    *, activities, site, label, actor
) -> None:
    _notify_reviewed_users(
        activities=activities,
        site=site,
        label=label,
        actor=actor,
    )


def _notify_reviewed_users(
    *, activities, site, label, actor
) -> None:
    recipients = {
        activity.updated_by
        for activity in activities
        if activity.updated_by_id
        and activity.updated_by_id != actor.id
    }
    if not recipients:
        return

    project_label = _project_label(site)
    for user in recipients:
        notify_users(
            recipients=[user],
            event_type=(
                NotificationEventType.PROJECT_MONITOR_ACTIVITY_REVIEWED
            ),
            actor=actor,
            title="Update reviewed",
            message=(
                f"{actor.full_name} reviewed {label} on "
                f"{project_label}."
            ),
            deep_link=_overview_deep_link(
                user.role, site.id
            ),
            payload={"site": str(site.id)},
        )
