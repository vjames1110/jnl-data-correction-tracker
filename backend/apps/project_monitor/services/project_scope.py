"""
Who may use which part of Project Monitor on which site.

Access is granted by an Admin on the Site Access page, **per site,
per person, per task** (see ``ProjectSiteAccessRole`` for the tasks):

- Director, Admin and Super Admin see every task on every site
  (Director is read-only; Admin and Super Admin can also enter data).
- A Project Incharge or Project Manager can use exactly the tasks
  they were granted on a site - view and enter - and nothing on
  sites they were not granted. Several people can hold tasks on the
  same site, and one person can hold any mix of tasks.
- Everyone else has no Project Monitor access.

A person who holds any task on a site can see that site (its
Overview summary, All Projects, the site picker); the tabs and data
of a task they do not hold stay hidden.

Every rule here reads grants through ``_grants_by_site`` - the single
database read, which tests replace to grant tasks in bulk.
"""

from rest_framework.exceptions import PermissionDenied

from apps.authentication.models import (
    AccountStatus,
    UserRole,
)
from apps.organization.models import Site
from apps.project_monitor.models import (
    GRANTABLE_USER_ROLES,
    ProjectSiteAccess,
    ProjectSiteAccessRole as Task,
)

# See every site and task.
ALL_SITE_ROLES = {
    UserRole.DIRECTOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
}
# Can enter data on any site (Director cannot).
ADMIN_ROLES = {UserRole.ADMIN, UserRole.SUPER_ADMIN}
# People whose access comes from grants.
SCOPED_ROLES = set(GRANTABLE_USER_ROLES)

PROGRESS_TASKS = (
    Task.OVERVIEW.value,
    Task.STRUCTURES.value,
    Task.BUILDINGS.value,
    Task.GIRDERS.value,
    Task.ACTION_ITEMS.value,
    Task.LINEAR_WORKS.value,
)
FINANCE_TASKS = (
    Task.DPR_BILLS.value,
    Task.HR.value,
    Task.MACHINERY.value,
)
REPORT_TASKS = (Task.REPORTS.value,)
ALL_TASKS = PROGRESS_TASKS + FINANCE_TASKS + REPORT_TASKS

_GROUPS = (
    ("progress", "Progress tracking", PROGRESS_TASKS),
    ("finance", "Finance", FINANCE_TASKS),
    ("reports", "Reports", REPORT_TASKS),
)
TASK_META = [
    {
        "key": task,
        "label": Task(task).label,
        "group": group,
        "group_label": group_label,
    }
    for group, group_label, tasks in _GROUPS
    for task in tasks
]

# The activity-based tasks and the module key the rollups, due
# tracker and overdue badges use for them.
TASK_MODULES = {
    Task.STRUCTURES.value: "structures",
    Task.BUILDINGS.value: "buildings",
    Task.GIRDERS.value: "girders",
    Task.ACTION_ITEMS.value: "action_items",
}


def is_active_account(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and user.account_status == AccountStatus.ACTIVE
    )


def _grants_by_site(user) -> dict:
    """``{site_id: {task, ...}}`` - the one place grants are read."""
    grants: dict = {}
    for site_id, task in ProjectSiteAccess.objects.filter(
        user=user
    ).values_list("site_id", "role"):
        grants.setdefault(site_id, set()).add(task)
    return grants


def _is_grantable(user) -> bool:
    return is_active_account(user) and user.role in SCOPED_ROLES


def granted_tasks(user, site) -> set:
    """The tasks ``user`` was granted on ``site`` (never Director/Admin)."""
    if site is None or not _is_grantable(user):
        return set()
    return set(_grants_by_site(user).get(site.id, ()))


def tasks_for(user, site) -> set:
    """Every task the user may use on the site."""
    if not is_active_account(user):
        return set()
    if user.role in ALL_SITE_ROLES:
        return set(ALL_TASKS)
    return granted_tasks(user, site)


def user_site_ids(user) -> set:
    """Sites where a Project Incharge/Manager holds at least one task."""
    if not _is_grantable(user):
        return set()
    return {
        site_id
        for site_id, tasks in _grants_by_site(user).items()
        if tasks
    }


def scoped_site_ids(user):
    """
    ``None`` = every site (Director/Admin/Super Admin); otherwise the
    set of site ids the user holds any task on (possibly empty).
    """
    if not is_active_account(user):
        return set()
    if user.role in ALL_SITE_ROLES:
        return None
    return user_site_ids(user)


def can_view_site(user, site) -> bool:
    """See the site at all: hold any task on it (or be Director/Admin)."""
    if site is None or not is_active_account(user):
        return False
    if user.role in ALL_SITE_ROLES:
        return True
    return bool(granted_tasks(user, site))


def can_view_task(user, site, task) -> bool:
    if site is None or not is_active_account(user):
        return False
    if user.role in ALL_SITE_ROLES:
        return True
    return task in granted_tasks(user, site)


def can_enter_task(user, site, task) -> bool:
    if site is None or not is_active_account(user):
        return False
    if user.role in ADMIN_ROLES:
        return True
    if user.role == UserRole.DIRECTOR:
        return False
    return task in granted_tasks(user, site)


def _task_label(task) -> str:
    return Task(task).label if task in ALL_TASKS else str(task)


def ensure_can_view_site(user, site) -> None:
    if site is None:
        # Orphaned rows (no site) are an Admin matter.
        if is_active_account(user) and user.role in ADMIN_ROLES:
            return
        raise PermissionDenied(
            "You do not have access to this project."
        )
    if not can_view_site(user, site):
        raise PermissionDenied(
            "You do not have access to this project. Ask an "
            "Admin to grant you a task on it (Site Access)."
        )


def ensure_can_view_task(user, site, task) -> None:
    if site is None:
        ensure_can_view_site(user, site)
        return
    if not can_view_task(user, site, task):
        raise PermissionDenied(
            f'You do not have access to "{_task_label(task)}" '
            "on this project. Ask an Admin to grant it "
            "(Site Access)."
        )


def ensure_can_enter_task(user, site, task) -> None:
    if site is None:
        if is_active_account(user) and user.role in ADMIN_ROLES:
            return
        raise PermissionDenied(
            "You cannot make entries on this project."
        )
    if not can_enter_task(user, site, task):
        raise PermissionDenied(
            f'You cannot make "{_task_label(task)}" entries on '
            "this project. Ask an Admin to grant the task "
            "(Site Access)."
        )


def granted_modules(user, site):
    """
    Activity modules (structures, buildings, girders, action items)
    the user may see rows of on this site; ``None`` = all of them.
    Feeds the due tracker and the overdue badges.
    """
    if not is_active_account(user):
        return set()
    if user.role in ALL_SITE_ROLES:
        return None
    return {
        TASK_MODULES[task]
        for task in granted_tasks(user, site)
        if task in TASK_MODULES
    }


def module_access(user):
    """
    ``None`` (every site, every module) or ``{site_id: {module,...}}``
    for someone limited by grants.
    """
    if not is_active_account(user):
        return {}
    if user.role in ALL_SITE_ROLES:
        return None
    return {
        site_id: {
            TASK_MODULES[task]
            for task in tasks
            if task in TASK_MODULES
        }
        for site_id, tasks in _grants_by_site(user).items()
        if tasks and _is_grantable(user)
    }


def site_task_map(user) -> dict:
    """``{site_id: [task keys in display order]}`` for the site picker."""
    grants = _grants_by_site(user) if _is_grantable(user) else {}
    return {
        site_id: [t for t in ALL_TASKS if t in tasks]
        for site_id, tasks in grants.items()
        if tasks
    }


def project_sites_queryset(user):
    """Active sites the user may see, for site pickers."""
    queryset = Site.objects.filter(is_active=True)
    ids = scoped_site_ids(user)
    if ids is None:
        return queryset
    return queryset.filter(id__in=ids)
