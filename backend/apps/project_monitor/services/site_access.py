"""
The finance tier (DPR and RA bills, HR, Machinery) as tasks of the
task-wise site access in ``services.project_scope``. These are thin
wrappers that keep the names the finance views and importers already
use; the rules are the same for every task:

- Director, Admin and Super Admin see every site (Director is
  read-only, Admin/Super Admin can also enter data).
- A Project Incharge or Project Manager needs the task granted on the
  site by an Admin (Site Access page) - view and enter together.
- Unlock a locked DPR day: Admin/Super Admin only.
"""

from rest_framework.exceptions import PermissionDenied

from apps.project_monitor.models import (
    ProjectSiteAccess,
    ProjectSiteAccessRole,
)
from apps.project_monitor.services import project_scope
from apps.project_monitor.services.project_scope import (
    ADMIN_ROLES,
    ALL_SITE_ROLES as ALWAYS_VIEW_ROLES,
)
from apps.project_monitor.services.project_scope import (
    is_active_account as _is_active,
)


def is_assigned(
    user,
    site_id,
    role=ProjectSiteAccessRole.DPR_BILLS,
) -> bool:
    return ProjectSiteAccess.objects.filter(
        user=user, site_id=site_id, role=role
    ).exists()


def assigned_site_ids(
    user, role=ProjectSiteAccessRole.DPR_BILLS
) -> set:
    return set(
        ProjectSiteAccess.objects.filter(
            user=user, role=role
        ).values_list("site_id", flat=True)
    )


def can_view_feed(user, site, task) -> bool:
    """View a finance task (DPR & bills, HR, Machinery) for a site."""
    return project_scope.can_view_task(user, site, task)


def can_enter_feed(user, site, task) -> bool:
    return project_scope.can_enter_task(user, site, task)


def can_view_finance(user, site) -> bool:
    return can_view_feed(
        user, site, ProjectSiteAccessRole.DPR_BILLS
    )


def can_enter_dpr_bills(user, site) -> bool:
    return can_enter_feed(
        user, site, ProjectSiteAccessRole.DPR_BILLS
    )


def can_view_hr(user, site) -> bool:
    return can_view_feed(user, site, ProjectSiteAccessRole.HR)


def can_enter_hr(user, site) -> bool:
    return can_enter_feed(user, site, ProjectSiteAccessRole.HR)


def can_view_machinery(user, site) -> bool:
    return can_view_feed(
        user, site, ProjectSiteAccessRole.MACHINERY
    )


def can_enter_machinery(user, site) -> bool:
    return can_enter_feed(
        user, site, ProjectSiteAccessRole.MACHINERY
    )


def can_unlock_days(user) -> bool:
    return _is_active(user) and user.role in ADMIN_ROLES


def can_manage_access(user) -> bool:
    return can_unlock_days(user)


def visible_site_ids(user):
    """
    ``None`` means every site (Director/Admin/Super Admin);
    otherwise the set of site ids the user may see finance figures
    for (they hold the DPR & Bills task there). Used to fill the
    dashboard's ``money`` slot without ever leaking a site the user
    has no finance access to.
    """
    if not _is_active(user):
        return set()
    if user.role in ALWAYS_VIEW_ROLES:
        return None
    if not project_scope._is_grantable(user):
        return set()
    return {
        site_id
        for site_id, tasks in project_scope._grants_by_site(
            user
        ).items()
        if ProjectSiteAccessRole.DPR_BILLS.value in tasks
    }


def ensure_can_view(user, site) -> None:
    if not can_view_finance(user, site):
        raise PermissionDenied(
            "You do not have access to this site's "
            "DPR and billing figures."
        )


def ensure_can_enter(user, site) -> None:
    if not can_enter_dpr_bills(user, site):
        raise PermissionDenied(
            "You are not assigned to enter DPR and "
            "bills for this site."
        )


def ensure_can_view_hr(user, site) -> None:
    if not can_view_hr(user, site):
        raise PermissionDenied(
            "You do not have access to this site's "
            "HR figures."
        )


def ensure_can_enter_hr(user, site) -> None:
    if not can_enter_hr(user, site):
        raise PermissionDenied(
            "You are not assigned to enter HR data for "
            "this site."
        )


def ensure_can_view_machinery(user, site) -> None:
    if not can_view_machinery(user, site):
        raise PermissionDenied(
            "You do not have access to this site's "
            "machinery figures."
        )


def ensure_can_enter_machinery(user, site) -> None:
    if not can_enter_machinery(user, site):
        raise PermissionDenied(
            "You are not assigned to enter machinery data "
            "for this site."
        )
