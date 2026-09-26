"""
Who may use which part of Project Monitor on which site.

Two kinds of people:

**Company-wide roles** work on every site, with a fixed set of tasks
each (``COMPANY_WIDE``):

- Director: sees every task; read-only (but manages the masters).
- Admin and Super Admin: see and enter every task.
- Project Management HO: sees the progress tasks, DPR & Bills and
  Reports on every site; enters only the project Overview (and
  manages the masters). Not HR salaries, machinery costs or Costing.
- HR Department: the HR task only. Machinery Department: the
  Machinery task only. They alone enter that data.

**Granted roles** - Project Incharge and Project Manager - get
access from an Admin on the Site Access page, **per site, per person,
per task** (see ``ProjectSiteAccessRole``): exactly the tasks they
were granted on a site, view and enter, and nothing on other sites.
HR and Machinery cannot be granted to them (``GRANTABLE_TASKS``).

Everyone else has no Project Monitor access.

A person who holds any *summary* task on a site can see that site (its
Overview, All Projects, the site picker); the tabs and data of a task
they do not hold stay hidden. HR and Machinery alone do not make a
site's Overview or progress visible.

Grants are read through ``_grants_by_site`` - the single database
read, which tests replace to grant tasks in bulk.
"""

from typing import NamedTuple

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

# Can see every task on every site (Director is read-only).
ALL_SITE_ROLES = {
    UserRole.DIRECTOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
}
# Can enter data on any site.
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

# HR and Machinery are entered only by their departments, so a
# Project Incharge / Project Manager can never be granted them.
DEPARTMENT_TASKS = (Task.HR.value, Task.MACHINERY.value)
GRANTABLE_TASKS = tuple(
    task for task in ALL_TASKS if task not in DEPARTMENT_TASKS
)
# Tasks that let someone see a site's Overview / progress summary.
SUMMARY_TASKS = GRANTABLE_TASKS

_GROUPS = (
    ("progress", "Progress tracking", PROGRESS_TASKS),
    (
        "finance",
        "Finance",
        tuple(
            task
            for task in FINANCE_TASKS
            if task not in DEPARTMENT_TASKS
        ),
    ),
    ("reports", "Reports", REPORT_TASKS),
)
# What the Site Access grid offers: only the grantable tasks.
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
_ALL_MODULES = frozenset(TASK_MODULES.values())


class RoleTasks(NamedTuple):
    """What a company-wide role may view and enter, on every site."""

    view: frozenset
    enter: frozenset


_EVERY_TASK = frozenset(ALL_TASKS)
COMPANY_WIDE = {
    UserRole.SUPER_ADMIN: RoleTasks(_EVERY_TASK, _EVERY_TASK),
    UserRole.ADMIN: RoleTasks(_EVERY_TASK, _EVERY_TASK),
    UserRole.DIRECTOR: RoleTasks(_EVERY_TASK, frozenset()),
    UserRole.PROJECT_HO: RoleTasks(
        view=frozenset(
            PROGRESS_TASKS
            + (Task.DPR_BILLS.value,)
            + REPORT_TASKS
        ),
        enter=frozenset({Task.OVERVIEW.value}),
    ),
    UserRole.HR_DEPARTMENT: RoleTasks(
        frozenset({Task.HR.value}), frozenset({Task.HR.value})
    ),
    UserRole.MACHINERY_DEPARTMENT: RoleTasks(
        frozenset({Task.MACHINERY.value}),
        frozenset({Task.MACHINERY.value}),
    ),
}


def is_active_account(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and user.account_status == AccountStatus.ACTIVE
    )


def is_company_wide(user) -> bool:
    """A role that works on every site with a fixed set of tasks."""
    return (
        is_active_account(user) and user.role in COMPANY_WIDE
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
    """
    The tasks a Project Incharge/Manager was granted on ``site``
    (nothing for company-wide roles; HR/Machinery are never theirs
    even if an old grant row still exists).
    """
    if site is None or not _is_grantable(user):
        return set()
    return {
        task
        for task in _grants_by_site(user).get(site.id, ())
        if task in GRANTABLE_TASKS
    }


def view_tasks_for(user, site) -> set:
    """Every task the user may see on the site."""
    if not is_active_account(user):
        return set()
    if user.role in COMPANY_WIDE:
        return set(COMPANY_WIDE[user.role].view)
    return granted_tasks(user, site)


# The historical name; identical to ``view_tasks_for``.
tasks_for = view_tasks_for


def enter_tasks_for(user, site) -> set:
    """Every task the user may make entries for on the site."""
    if not is_active_account(user):
        return set()
    if user.role in COMPANY_WIDE:
        return set(COMPANY_WIDE[user.role].enter)
    return granted_tasks(user, site)


def user_site_ids(user) -> set:
    """Sites where a Project Incharge/Manager holds at least one task."""
    if not _is_grantable(user):
        return set()
    return {
        site_id
        for site_id, tasks in _grants_by_site(user).items()
        if any(task in GRANTABLE_TASKS for task in tasks)
    }


def scoped_site_ids(user):
    """
    ``None`` = every site (any company-wide role); otherwise the set
    of site ids the user holds any task on (possibly empty).
    """
    if not is_active_account(user):
        return set()
    if user.role in COMPANY_WIDE:
        return None
    return user_site_ids(user)


def can_view_site(user, site) -> bool:
    """
    See the site's Overview / progress summary: hold any summary task
    on it. HR or Machinery alone do not count.
    """
    if site is None or not is_active_account(user):
        return False
    return bool(set(SUMMARY_TASKS) & view_tasks_for(user, site))


def can_view_task(user, site, task) -> bool:
    if site is None or not is_active_account(user):
        return False
    return task in view_tasks_for(user, site)


def can_enter_task(user, site, task) -> bool:
    if site is None or not is_active_account(user):
        return False
    return task in enter_tasks_for(user, site)


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


def _modules_of(tasks) -> set:
    return {
        TASK_MODULES[task] for task in tasks if task in TASK_MODULES
    }


def granted_modules(user, site):
    """
    Activity modules (structures, buildings, girders, action items)
    the user may see rows of on this site; ``None`` = all of them.
    Feeds the due tracker and the overdue badges.
    """
    if not is_active_account(user):
        return set()
    modules = _modules_of(view_tasks_for(user, site))
    return None if modules == _ALL_MODULES else modules


def module_access(user):
    """
    ``None`` (every site, every module) or ``{site_id: {module,...}}``
    for someone limited by grants or by a role without every module.
    """
    if not is_active_account(user):
        return {}
    if user.role in COMPANY_WIDE:
        modules = _modules_of(COMPANY_WIDE[user.role].view)
        return None if modules == _ALL_MODULES else {}
    return {
        site_id: _modules_of(tasks)
        for site_id, tasks in _grants_by_site(user).items()
        if tasks and _is_grantable(user)
    }


def site_task_map(user) -> dict:
    """``{site_id: [task keys in display order]}`` for the site picker."""
    grants = _grants_by_site(user) if _is_grantable(user) else {}
    return {
        site_id: [
            t
            for t in ALL_TASKS
            if t in tasks and t in GRANTABLE_TASKS
        ]
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
