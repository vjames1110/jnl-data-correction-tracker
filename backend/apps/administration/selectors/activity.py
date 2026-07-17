from django.db.models import QuerySet

from apps.authentication.models import LoginHistory


def get_recent_login_activity(
    *,
    limit: int = 10,
) -> QuerySet[LoginHistory]:
    """
    Return the latest authentication-related activity.

    A larger organization-wide activity stream will later include
    employee, master-data, approval and correction actions.
    """

    safe_limit = min(
        max(limit, 1),
        50,
    )

    return (
        LoginHistory.objects
        .select_related("user")
        .order_by("-created_at")[:safe_limit]
    )