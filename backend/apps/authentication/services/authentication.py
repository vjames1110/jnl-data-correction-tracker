from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.authentication.models import (
    AccountStatus,
    LoginEventType,
    LoginHistory,
    User,
)


MAX_FAILED_LOGIN_ATTEMPTS = 5
ACCOUNT_LOCK_DURATION_MINUTES = 30


def get_client_ip(request) -> str | None:
    forwarded_for = request.META.get(
        "HTTP_X_FORWARDED_FOR"
    )

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    return request.META.get("REMOTE_ADDR")


def get_user_agent(request) -> str:
    return request.META.get(
        "HTTP_USER_AGENT",
        "",
    )[:1000]


def record_login_event(
    *,
    request,
    event_type: str,
    was_successful: bool,
    employee_id: str = "",
    user: User | None = None,
    failure_reason: str = "",
) -> LoginHistory:
    return LoginHistory.objects.create(
        user=user,
        employee_id_attempted=employee_id,
        event_type=event_type,
        was_successful=was_successful,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        failure_reason=failure_reason,
        request_id=getattr(
            request,
            "request_id",
            "",
        ),
    )


@transaction.atomic
def register_failed_login(
    *,
    user: User,
    request,
) -> None:
    user.failed_login_attempts += 1
    user.last_failed_login_at = timezone.now()

    update_fields = [
        "failed_login_attempts",
        "last_failed_login_at",
        "updated_at",
    ]

    if (
        user.failed_login_attempts
        >= MAX_FAILED_LOGIN_ATTEMPTS
    ):
        user.account_status = AccountStatus.LOCKED
        user.locked_until = (
            timezone.now()
            + timedelta(
                minutes=ACCOUNT_LOCK_DURATION_MINUTES
            )
        )

        update_fields.extend(
            [
                "account_status",
                "locked_until",
            ]
        )

        record_login_event(
            request=request,
            user=user,
            employee_id=user.employee_id,
            event_type=LoginEventType.ACCOUNT_LOCKED,
            was_successful=False,
            failure_reason=(
                "Maximum failed login attempts exceeded."
            ),
        )

    user.save(update_fields=update_fields)


@transaction.atomic
def register_successful_login(
    *,
    user: User,
    request,
) -> None:
    user.failed_login_attempts = 0
    user.last_failed_login_at = None
    user.locked_until = None
    user.account_status = AccountStatus.ACTIVE
    user.last_login_ip = get_client_ip(request)
    user.last_login = timezone.now()

    user.save(
        update_fields=[
            "failed_login_attempts",
            "last_failed_login_at",
            "locked_until",
            "account_status",
            "last_login_ip",
            "last_login",
            "updated_at",
        ]
    )

    record_login_event(
        request=request,
        user=user,
        employee_id=user.employee_id,
        event_type=LoginEventType.LOGIN_SUCCESS,
        was_successful=True,
    )