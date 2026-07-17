from datetime import timedelta
from typing import Any

from django.utils import timezone

from apps.administration.constants.dashboard import (
    DASHBOARD_PERIOD_DAYS,
    DEFAULT_DASHBOARD_PERIOD,
    DashboardPeriod,
)
from apps.administration.selectors.dashboard import (
    get_account_status_distribution,
    get_active_users_count,
    get_all_users_queryset,
    get_failed_login_count,
    get_inactive_users_count,
    get_locked_users_count,
    get_login_trend,
    get_role_distribution,
    get_successful_login_count,
    get_suspended_users_count,
    get_temporary_password_users_count,
)
from apps.authentication.models import (
    AccountStatus,
    LoginEventType,
    UserRole,
)


def resolve_dashboard_period(
    period: str | None,
) -> DashboardPeriod:
    if not period:
        return DEFAULT_DASHBOARD_PERIOD

    try:
        return DashboardPeriod(period)
    except ValueError as exc:
        valid_periods = ", ".join(
            item.value
            for item in DashboardPeriod
        )

        raise ValueError(
            f"Invalid period. Allowed values: {valid_periods}."
        ) from exc


def get_dashboard_start_datetime(
    period: DashboardPeriod,
):
    number_of_days = DASHBOARD_PERIOD_DAYS[period]

    return (
        timezone.now()
        - timedelta(days=number_of_days - 1)
    ).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )


def build_role_distribution() -> list[dict[str, Any]]:
    role_labels = dict(UserRole.choices)

    query_results = {
        item["role"]: item["count"]
        for item in get_role_distribution()
    }

    return [
        {
            "key": role.value,
            "label": role_labels[role.value],
            "count": query_results.get(
                role.value,
                0,
            ),
        }
        for role in UserRole
    ]


def build_account_status_distribution() -> list[dict[str, Any]]:
    status_labels = dict(AccountStatus.choices)

    query_results = {
        item["account_status"]: item["count"]
        for item in get_account_status_distribution()
    }

    return [
        {
            "key": account_status.value,
            "label": status_labels[
                account_status.value
            ],
            "count": query_results.get(
                account_status.value,
                0,
            ),
        }
        for account_status in AccountStatus
    ]


def build_login_trend(
    *,
    start_datetime,
) -> list[dict[str, Any]]:
    raw_results = get_login_trend(
        start_datetime=start_datetime,
    )

    event_lookup: dict[str, dict[str, int]] = {}

    for item in raw_results:
        date_key = item["event_date"].isoformat()

        event_lookup.setdefault(
            date_key,
            {
                "successful": 0,
                "failed": 0,
            },
        )

        if (
            item["event_type"]
            == LoginEventType.LOGIN_SUCCESS
        ):
            event_lookup[date_key]["successful"] = (
                item["count"]
            )

        elif (
            item["event_type"]
            == LoginEventType.LOGIN_FAILED
        ):
            event_lookup[date_key]["failed"] = (
                item["count"]
            )

    today = timezone.localdate()
    start_date = timezone.localdate(
        start_datetime
    )

    result = []
    current_date = start_date

    while current_date <= today:
        date_key = current_date.isoformat()
        event_counts = event_lookup.get(
            date_key,
            {
                "successful": 0,
                "failed": 0,
            },
        )

        result.append(
            {
                "date": date_key,
                "successful": event_counts[
                    "successful"
                ],
                "failed": event_counts[
                    "failed"
                ],
            }
        )

        current_date += timedelta(days=1)

    return result


def build_admin_dashboard(
    *,
    period: str | None,
) -> dict[str, Any]:
    resolved_period = resolve_dashboard_period(
        period
    )

    start_datetime = get_dashboard_start_datetime(
        resolved_period
    )

    total_users = get_all_users_queryset().count()
    active_users = get_active_users_count()
    inactive_users = get_inactive_users_count()
    locked_users = get_locked_users_count()
    suspended_users = get_suspended_users_count()
    temporary_password_users = (
        get_temporary_password_users_count()
    )

    successful_logins = get_successful_login_count(
        start_datetime=start_datetime,
    )
    failed_logins = get_failed_login_count(
        start_datetime=start_datetime,
    )

    total_login_attempts = (
        successful_logins + failed_logins
    )

    login_success_rate = (
        round(
            successful_logins
            / total_login_attempts
            * 100,
            2,
        )
        if total_login_attempts
        else 0.0
    )

    return {
        "period": {
            "key": resolved_period.value,
            "days": DASHBOARD_PERIOD_DAYS[
                resolved_period
            ],
            "start_at": start_datetime,
            "end_at": timezone.now(),
        },
        "summary": {
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": inactive_users,
            "locked_users": locked_users,
            "suspended_users": suspended_users,
            "temporary_password_users": (
                temporary_password_users
            ),
            "successful_logins": successful_logins,
            "failed_logins": failed_logins,
            "login_success_rate": login_success_rate,
        },
        "role_distribution": (
            build_role_distribution()
        ),
        "account_status_distribution": (
            build_account_status_distribution()
        ),
        "login_trend": build_login_trend(
            start_datetime=start_datetime,
        ),
        "generated_at": timezone.now(),
    }