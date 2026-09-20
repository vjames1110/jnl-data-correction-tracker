"""
Per-site permissions for the finance tier (DPR and RA bills, HR and
Machinery). Everything else in Project Monitor stays
role-wide - only finance data is scoped to the sites a Project
Manager has been assigned to.

Rules (confirmed with the user, 2026-09-19):
- View: Director, Admin and Super Admin see every site; a Project
  Manager only sees sites they are assigned to.
- Enter: an assigned Project Manager, plus Admin/Super Admin as the
  usual backup. Director is read-only.
- Unlock a locked DPR day: Admin/Super Admin only.

HR (labour and staff cost - salaries are sensitive) follows the same
shape with its own assignment: Director/Admin/Super Admin see every
site, only a Project Manager holding the HR role for a site sees or
enters that site's HR data, and Director stays read-only.
"""

from rest_framework.exceptions import PermissionDenied

from apps.authentication.models import (
    AccountStatus,
    UserRole,
)
from apps.project_monitor.models import (
    ProjectSiteAccess,
    ProjectSiteAccessRole,
)

ALWAYS_VIEW_ROLES = {
    UserRole.DIRECTOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
}
ADMIN_ROLES = {UserRole.ADMIN, UserRole.SUPER_ADMIN}


def _is_active(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and user.account_status == AccountStatus.ACTIVE
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


def can_view_finance(user, site) -> bool:
    if not _is_active(user):
        return False
    if user.role in ALWAYS_VIEW_ROLES:
        return True
    return (
        user.role == UserRole.PROJECT_MANAGER
        and is_assigned(user, site.id)
    )


def can_enter_dpr_bills(user, site) -> bool:
    if not _is_active(user):
        return False
    if user.role in ADMIN_ROLES:
        return True
    return (
        user.role == UserRole.PROJECT_MANAGER
        and is_assigned(user, site.id)
    )


def can_view_feed(user, site, role) -> bool:
    """View a role-assigned feed (HR, Machinery) for one site."""
    if not _is_active(user):
        return False
    if user.role in ALWAYS_VIEW_ROLES:
        return True
    return user.role == UserRole.PROJECT_MANAGER and is_assigned(
        user, site.id, role
    )


def can_enter_feed(user, site, role) -> bool:
    if not _is_active(user):
        return False
    if user.role in ADMIN_ROLES:
        return True
    return user.role == UserRole.PROJECT_MANAGER and is_assigned(
        user, site.id, role
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
    otherwise the set of site ids a Project Manager may see finance
    figures for. Used to fill the dashboard's ``money`` slot without
    ever leaking a site the user is not assigned to.
    """
    if not _is_active(user):
        return set()
    if user.role in ALWAYS_VIEW_ROLES:
        return None
    if user.role == UserRole.PROJECT_MANAGER:
        return assigned_site_ids(user)
    return set()


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
