"""Builders for the task-grant tests (who may use what, on which site)."""

from apps.project_monitor.models import ProjectSiteAccess
from apps.project_monitor.services import project_scope


def grant(user, site, *tasks):
    """
    Give ``user`` the ``tasks`` on ``site`` the way the Site Access
    page does. With no tasks named, every grantable task (HR and
    Machinery belong to their departments and cannot be granted).
    """
    for task in tasks or project_scope.GRANTABLE_TASKS:
        ProjectSiteAccess.objects.get_or_create(
            site=site, user=user, role=task
        )
    return user
