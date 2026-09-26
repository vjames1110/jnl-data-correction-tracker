"""
Starting task grants for people the Admin assigns through the screens
that already exist.

Project Monitor access is task-wise grants per site (Site Access
page). But an Admin also sets people up elsewhere: an employee's site
in User Management, and a site's Project Manager in Organization
Setup > HOD mappings. Doing either for a Project Incharge or Project
Manager would otherwise leave them with no access at all, so it gives
them a *starting set* of tasks on that site - which the Admin can then
trim or extend in the Site Access grid.

- Project Incharge: every grantable task (they are the person making
  the entries). HR and Machinery are never granted - the HR and
  Machinery departments enter those.
- Project Manager: the progress tasks and Reports (DPR & Bills stays
  something an Admin grants on purpose).

This only ever ADDS missing grants and only when the assignment
itself changes, so tasks an Admin removed later are never put back by
an unrelated edit.
"""

from apps.authentication.models import UserRole
from apps.project_monitor.models import ProjectSiteAccess
from apps.project_monitor.services import project_scope


def default_tasks_for(role) -> tuple:
    if role == UserRole.PROJECT_INCHARGE:
        return project_scope.GRANTABLE_TASKS
    if role == UserRole.PROJECT_MANAGER:
        return (
            project_scope.PROGRESS_TASKS
            + project_scope.REPORT_TASKS
        )
    return ()


def ensure_default_grants(user, site) -> int:
    """
    Give ``user`` the starting tasks for their role on ``site``;
    returns how many grants were added. Does nothing for anyone who
    cannot be granted tasks (wrong role, inactive account).
    """
    if user is None or site is None:
        return 0
    if not project_scope.is_active_account(user):
        return 0

    added = 0
    for task in default_tasks_for(user.role):
        _, created = ProjectSiteAccess.objects.get_or_create(
            site=site, user=user, role=task
        )
        added += int(created)
    return added
