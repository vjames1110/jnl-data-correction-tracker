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
    Project Manager (and Admin/Super Admin as a backup) can enter
    and edit Project Monitor data - no per-site account restriction,
    the same "pick whichever site you're working on" convention
    Store HO already uses for Store Reconciliation.
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
                UserRole.ADMIN,
                UserRole.SUPER_ADMIN,
            }

        return user.role in {
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }
