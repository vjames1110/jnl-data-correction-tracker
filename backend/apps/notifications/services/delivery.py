from collections.abc import Iterable

from django.db import transaction

from apps.notifications.models import (
    Notification,
    NotificationEventType,
    NotificationPreference,
    NotificationSeverity,
)
from apps.notifications.services.email import (
    send_notification_emails,
)


EVENT_DEFAULTS = {
    NotificationEventType.REQUEST_SUBMITTED: {
        "title": "Request submitted",
        "severity": NotificationSeverity.INFO,
    },
    NotificationEventType.APPROVAL_PENDING: {
        "title": "Approval pending",
        "severity": NotificationSeverity.WARNING,
    },
    NotificationEventType.REQUEST_APPROVED: {
        "title": "Request approved",
        "severity": NotificationSeverity.SUCCESS,
    },
    NotificationEventType.REQUEST_REJECTED: {
        "title": "Request rejected",
        "severity": NotificationSeverity.CRITICAL,
    },
    NotificationEventType.CLARIFICATION_REQUIRED: {
        "title": "Clarification required",
        "severity": NotificationSeverity.WARNING,
    },
    NotificationEventType.REQUEST_ASSIGNED: {
        "title": "Request assigned",
        "severity": NotificationSeverity.INFO,
    },
    NotificationEventType.ASSIGNMENT_ACCEPTED: {
        "title": "Assignment accepted",
        "severity": NotificationSeverity.INFO,
    },
    NotificationEventType.WORK_IN_PROGRESS: {
        "title": "Work in progress",
        "severity": NotificationSeverity.INFO,
    },
    NotificationEventType.REQUEST_RESOLVED: {
        "title": "Request resolved",
        "severity": NotificationSeverity.SUCCESS,
    },
    NotificationEventType.CONFIRMATION_PENDING: {
        "title": "Confirmation pending",
        "severity": NotificationSeverity.WARNING,
    },
    NotificationEventType.REQUEST_REOPENED: {
        "title": "Request reopened",
        "severity": NotificationSeverity.WARNING,
    },
    NotificationEventType.SLA_WARNING: {
        "title": "SLA warning",
        "severity": NotificationSeverity.WARNING,
    },
    NotificationEventType.SLA_BREACH: {
        "title": "SLA breached",
        "severity": NotificationSeverity.CRITICAL,
    },
    NotificationEventType.AUTO_CLOSE_REMINDER: {
        "title": "Confirm resolution soon",
        "severity": NotificationSeverity.WARNING,
    },
    NotificationEventType.REQUEST_AUTO_CLOSED: {
        "title": "Request auto-closed",
        "severity": NotificationSeverity.INFO,
    },
    NotificationEventType.RECONCILIATION_SUBMITTED: {
        "title": "Reconciliation submitted",
        "severity": NotificationSeverity.INFO,
    },
    NotificationEventType.RECONCILIATION_APPROVAL_PENDING: {
        "title": "Reconciliation approval pending",
        "severity": NotificationSeverity.WARNING,
    },
    NotificationEventType.RECONCILIATION_APPROVED: {
        "title": "Reconciliation approved",
        "severity": NotificationSeverity.SUCCESS,
    },
    NotificationEventType.RECONCILIATION_REJECTED: {
        "title": "Reconciliation rejected",
        "severity": NotificationSeverity.CRITICAL,
    },
    NotificationEventType.RECONCILIATION_RETURNED: {
        "title": "Reconciliation returned for correction",
        "severity": NotificationSeverity.WARNING,
    },
}


def notify_users(
    *,
    recipients: Iterable,
    event_type: str,
    correction_request=None,
    actor=None,
    title: str = "",
    message: str = "",
    deep_link: str = "",
    payload: dict | None = None,
) -> list[Notification]:
    unique_recipients = _unique_active_users(recipients)
    if not unique_recipients:
        return []

    def create_notifications():
        preferences = _preferences_for(unique_recipients)
        notifications = []

        for recipient in unique_recipients:
            preference = preferences.get(recipient.id)
            if preference and not preference.allows_in_app_event(
                event_type
            ):
                continue

            defaults = EVENT_DEFAULTS.get(
                event_type,
                {
                    "title": "Notification",
                    "severity": NotificationSeverity.INFO,
                },
            )
            request_reference = getattr(
                correction_request,
                "reference",
                "",
            )
            notifications.append(
                Notification(
                    recipient=recipient,
                    actor=actor,
                    correction_request=correction_request,
                    event_type=event_type,
                    severity=defaults["severity"],
                    title=title or defaults["title"],
                    message=message
                    or _default_message(
                        event_type=event_type,
                        request_reference=request_reference,
                    ),
                    deep_link=deep_link
                    or _request_deep_link(
                        correction_request
                    ),
                    payload=payload or {},
                )
            )

        if not notifications:
            return []

        created_notifications = Notification.objects.bulk_create(
            notifications
        )
        send_notification_emails(created_notifications)
        return created_notifications

    if transaction.get_connection().in_atomic_block:
        created = []

        def on_commit():
            created.extend(create_notifications())

        transaction.on_commit(on_commit)
        return created

    return create_notifications()


def notify_workflow_event(
    *,
    event_type: str,
    correction_request,
    recipients: Iterable,
    actor=None,
    message: str = "",
    payload: dict | None = None,
) -> list[Notification]:
    return notify_users(
        recipients=recipients,
        event_type=event_type,
        correction_request=correction_request,
        actor=actor,
        message=message,
        payload=payload,
    )


def _unique_active_users(users) -> list:
    unique = {}
    for user in users:
        if not user or not getattr(user, "is_active", False):
            continue
        unique[user.id] = user

    return list(unique.values())


def _preferences_for(users) -> dict:
    user_ids = [user.id for user in users]
    existing = {
        preference.user_id: preference
        for preference in NotificationPreference.objects.filter(
            user_id__in=user_ids
        )
    }

    missing = [
        NotificationPreference(user=user)
        for user in users
        if user.id not in existing
    ]
    if missing:
        created = (
            NotificationPreference.objects.bulk_create(
                missing
            )
        )
        existing.update(
            {
                preference.user_id: preference
                for preference in created
            }
        )

    return existing


def _request_deep_link(correction_request) -> str:
    if correction_request is None:
        return ""

    return f"/user/requests/{correction_request.id}"


def _default_message(
    *,
    event_type: str,
    request_reference: str,
) -> str:
    if not request_reference:
        return ""

    event_label = dict(
        NotificationEventType.choices
    ).get(event_type, "Notification")
    return f"{event_label}: {request_reference}"
