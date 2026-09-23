from rest_framework.permissions import (
    SAFE_METHODS,
    BasePermission,
)

from apps.authentication.models import (
    AccountStatus,
    UserRole,
)


def _is_active_authenticated(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and user.account_status
        == AccountStatus.ACTIVE
    )


class HasProjectMonitorPortalAccess(BasePermission):
    """
    Project Incharge and Project Manager (and Admin/Super Admin as
    a backup) can enter and edit Project Monitor data. This is only
    the role gate - which SITES a person may work on is enforced per
    request by ``services.project_scope`` (Project Incharge and
    Project Manager are limited to their own sites).
    """

    message = (
        "Project Monitor portal access is required."
    )

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not _is_active_authenticated(user):
            return False

        return user.role in {
            UserRole.PROJECT_MANAGER,
            UserRole.PROJECT_INCHARGE,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class HasProjectMonitorReportingAccess(BasePermission):
    """
    Director gets live, read-only visibility across every project,
    same as Director's existing read-only access into Store
    Reconciliation - no submit/approve cycle to gate here, per the
    confirmed "live view + review comments" design.
    """

    message = (
        "Project Monitor reporting access is "
        "required."
    )

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not _is_active_authenticated(user):
            return False

        return user.role in {
            UserRole.DIRECTOR,
            UserRole.PROJECT_MANAGER,
            UserRole.PROJECT_INCHARGE,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class HasProjectMonitorMasterAccess(BasePermission):
    """
    The Structure Type master (which config fields/activity groups
    a structure type generates) is Admin/Super Admin configuration,
    not day-to-day entry - same "masters are Admin-only" convention
    as Reconciliation's Item Categories/Site Overrides. Read access
    (so the Add-a-structure form and matrix can list active types)
    is open to anyone with portal or reporting access; only
    writes are restricted here.
    """

    message = (
        "Structure Type master access is required."
    )

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not _is_active_authenticated(user):
            return False

        if request.method in SAFE_METHODS:
            return user.role in {
                UserRole.DIRECTOR,
                UserRole.PROJECT_MANAGER,
                UserRole.PROJECT_INCHARGE,
                UserRole.ADMIN,
                UserRole.SUPER_ADMIN,
            }

        return user.role in {
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class HasFinanceRoleAccess(BasePermission):
    """
    The role-level gate for DPR/billing endpoints: only the roles
    that can ever see finance data get past it. Whether the caller
    may see or enter a *particular site* is decided per request by
    ``services.site_access`` (``ensure_can_view``/``ensure_can_enter``),
    since that depends on the site's assignments, not just the role.
    """

    message = "Project Monitor finance access is required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not _is_active_authenticated(user):
            return False

        return user.role in {
            UserRole.DIRECTOR,
            UserRole.PROJECT_MANAGER,
            UserRole.PROJECT_INCHARGE,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class HasProjectMonitorCostingAccess(BasePermission):
    """
    Costing (expense vs value of work done, "Today at a glance") is
    the one Project Monitor feed with no per-site Project Manager or
    Incharge grant at all - project margin is materially more
    sensitive than progress or even billing figures. Director may
    view every site (read-only, as everywhere else); only
    Admin/Super Admin may view AND enter material rates and the
    stores concrete-production figures.
    """

    message = (
        "Project Monitor costing access is required."
    )

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not _is_active_authenticated(user):
            return False

        if request.method in SAFE_METHODS:
            return user.role in {
                UserRole.DIRECTOR,
                UserRole.ADMIN,
                UserRole.SUPER_ADMIN,
            }

        return user.role in {
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class IsProjectMonitorAdmin(BasePermission):
    """Admin/Super Admin only (site assignments, day unlocks)."""

    message = "Admin access is required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not _is_active_authenticated(user):
            return False

        return user.role in {
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }
