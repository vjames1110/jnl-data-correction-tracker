import html
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from django.conf import settings
from django.utils import timezone

from apps.notifications.models import (
    Notification,
    NotificationEmailDelivery,
    NotificationEmailStatus,
    NotificationPreference,
)


logger = logging.getLogger(__name__)


def send_notification_email(
    notification: Notification,
) -> NotificationEmailDelivery:
    recipient = notification.recipient
    recipient_email = (recipient.email or "").strip()
    delivery = NotificationEmailDelivery.objects.create(
        notification=notification,
        recipient_email=recipient_email or "missing-email@example.invalid",
        status=NotificationEmailStatus.PENDING,
    )

    skip_reason = _skip_reason(
        notification=notification,
        recipient_email=recipient_email,
    )
    if skip_reason:
        return _mark_delivery(
            delivery,
            status=NotificationEmailStatus.SKIPPED,
            error_message=skip_reason,
        )

    payload = _build_brevo_payload(notification)
    request = Request(
        settings.BREVO_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "api-key": settings.BREVO_API_KEY,
            "content-type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(
            request,
            timeout=settings.NOTIFICATION_EMAIL_TIMEOUT_SECONDS,
        ) as response:
            body = response.read().decode("utf-8")
            response_data = json.loads(body or "{}")
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        logger.warning(
            "Brevo email delivery failed for notification %s: %s",
            notification.id,
            exc.code,
        )
        return _mark_delivery(
            delivery,
            status=NotificationEmailStatus.FAILED,
            error_message=_truncate_error(
                f"Brevo HTTP {exc.code}: {error_body}"
            ),
        )
    except (TimeoutError, URLError, OSError, json.JSONDecodeError) as exc:
        logger.warning(
            "Brevo email delivery failed for notification %s: %s",
            notification.id,
            exc,
        )
        return _mark_delivery(
            delivery,
            status=NotificationEmailStatus.FAILED,
            error_message=_truncate_error(str(exc)),
        )

    message_id = _provider_message_id(response_data)
    return _mark_delivery(
        delivery,
        status=NotificationEmailStatus.SENT,
        provider_message_id=message_id,
    )


def send_notification_emails(
    notifications: list[Notification],
) -> list[NotificationEmailDelivery]:
    deliveries = []
    for notification in notifications:
        deliveries.append(send_notification_email(notification))

    return deliveries


def _skip_reason(
    *,
    notification: Notification,
    recipient_email: str,
) -> str:
    if not settings.NOTIFICATION_EMAILS_ENABLED:
        return "Notification emails are disabled."

    if not settings.BREVO_API_KEY:
        return "Brevo API key is not configured."

    if not recipient_email:
        return "Recipient does not have an email address."

    if not settings.BREVO_SENDER_EMAIL:
        return "Brevo sender email is not configured."

    preference = NotificationPreference.objects.filter(
        user=notification.recipient
    ).first()
    if preference and not preference.allows_email_event(
        notification.event_type
    ):
        return "Recipient email preference does not allow this event."

    return ""


def _build_brevo_payload(notification: Notification) -> dict:
    recipient = notification.recipient
    recipient_name = recipient.full_name or recipient.employee_id
    event_tag = notification.event_type.lower().replace("_", "-")

    return {
        "sender": {
            "name": settings.BREVO_SENDER_NAME,
            "email": settings.BREVO_SENDER_EMAIL,
        },
        "to": [
            {
                "email": recipient.email,
                "name": recipient_name,
            }
        ],
        "subject": f"[JNL Correction Tracker] {notification.title}",
        "htmlContent": _html_content(notification),
        "textContent": _text_content(notification),
        "tags": [
            "jnl-correction-tracker",
            event_tag,
        ],
        "headers": {
            "X-JNL-Notification-ID": str(notification.id),
        },
    }


def _html_content(notification: Notification) -> str:
    title = html.escape(notification.title)
    message = html.escape(notification.message or "")
    request_reference = html.escape(
        getattr(notification.correction_request, "reference", "")
        or ""
    )
    deep_link = html.escape(_absolute_deep_link(notification))
    action_link = (
        (
            '<p><a href="{url}" '
            'style="display:inline-block;padding:10px 14px;'
            "background:#0f5ea8;color:#ffffff;text-decoration:none;"
            'border-radius:4px">Open in tracker</a></p>'
        ).format(url=deep_link)
        if deep_link
        else ""
    )

    request_block = (
        f"<p><strong>Request:</strong> {request_reference}</p>"
        if request_reference
        else ""
    )

    return (
        "<html><body>"
        '<div style="font-family:Arial,sans-serif;'
        'font-size:14px;line-height:1.5;color:#1f2937">'
        f"<h2>{title}</h2>"
        f"<p>{message}</p>"
        f"{request_block}"
        f"{action_link}"
        "<p>This is an automated notification from "
        "JNL Data Correction Tracker.</p>"
        "</div></body></html>"
    )


def _text_content(notification: Notification) -> str:
    lines = [
        notification.title,
        "",
        notification.message or "",
    ]
    request_reference = getattr(
        notification.correction_request,
        "reference",
        "",
    )
    if request_reference:
        lines.extend(["", f"Request: {request_reference}"])

    deep_link = _absolute_deep_link(notification)
    if deep_link:
        lines.extend(["", f"Open in tracker: {deep_link}"])

    lines.extend(
        [
            "",
            "This is an automated notification from "
            "JNL Data Correction Tracker.",
        ]
    )
    return "\n".join(lines)


def _absolute_deep_link(notification: Notification) -> str:
    if not notification.deep_link:
        return ""

    base_url = settings.APP_FRONTEND_BASE_URL.rstrip("/") + "/"
    return urljoin(base_url, notification.deep_link.lstrip("/"))


def _provider_message_id(response_data: dict) -> str:
    message_id = response_data.get("messageId", "")
    if message_id:
        return str(message_id)

    message_ids = response_data.get("messageIds") or []
    if message_ids:
        return str(message_ids[0])

    return ""


def _mark_delivery(
    delivery: NotificationEmailDelivery,
    *,
    status: str,
    provider_message_id: str = "",
    error_message: str = "",
) -> NotificationEmailDelivery:
    delivery.status = status
    delivery.provider_message_id = provider_message_id
    delivery.error_message = error_message
    delivery.attempted_at = timezone.now()
    delivery.save(
        update_fields=[
            "status",
            "provider_message_id",
            "error_message",
            "attempted_at",
            "updated_at",
        ]
    )
    return delivery


def _truncate_error(message: str) -> str:
    return (message or "")[:1000]
