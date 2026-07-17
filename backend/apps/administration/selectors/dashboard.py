from datetime import datetime

from django.db.models import Count, QuerySet
from django.db.models.functions import TruncDate

from apps.authentication.models import (
    AccountStatus,
    LoginEventType,
    LoginHistory,
    User,
)


def get_all_users_queryset() -> QuerySet[User]:
    return User.objects.all()


def get_active_users_count() -> int:
    return User.objects.filter(
        is_active=True,
        account_status=AccountStatus.ACTIVE,
    ).count()


def get_inactive_users_count() -> int:
    return User.objects.filter(
        is_active=False,
    ).count()


def get_locked_users_count() -> int:
    return User.objects.filter(
        account_status=AccountStatus.LOCKED,
    ).count()


def get_suspended_users_count() -> int:
    return User.objects.filter(
        account_status=AccountStatus.SUSPENDED,
    ).count()


def get_temporary_password_users_count() -> int:
    return User.objects.filter(
        is_active=True,
        must_change_password=True,
    ).count()


def get_role_distribution():
    return (
        User.objects
        .values("role")
        .annotate(count=Count("id"))
        .order_by("role")
    )


def get_account_status_distribution():
    return (
        User.objects
        .values("account_status")
        .annotate(count=Count("id"))
        .order_by("account_status")
    )


def get_successful_login_count(
    *,
    start_datetime: datetime,
) -> int:
    return LoginHistory.objects.filter(
        event_type=LoginEventType.LOGIN_SUCCESS,
        was_successful=True,
        created_at__gte=start_datetime,
    ).count()


def get_failed_login_count(
    *,
    start_datetime: datetime,
) -> int:
    return LoginHistory.objects.filter(
        event_type=LoginEventType.LOGIN_FAILED,
        was_successful=False,
        created_at__gte=start_datetime,
    ).count()


def get_login_trend(
    *,
    start_datetime: datetime,
):
    return (
        LoginHistory.objects
        .filter(
            created_at__gte=start_datetime,
            event_type__in=[
                LoginEventType.LOGIN_SUCCESS,
                LoginEventType.LOGIN_FAILED,
            ],
        )
        .annotate(event_date=TruncDate("created_at"))
        .values(
            "event_date",
            "event_type",
        )
        .annotate(count=Count("id"))
        .order_by(
            "event_date",
            "event_type",
        )
    )