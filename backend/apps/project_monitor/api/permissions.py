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
    Project Incharge and Project Manager, and Admin/Super Admin and
    the Director (who work on every site), can enter and edit Project
    Monitor data, and the
    Project Management HO can enter the project Overview. This is only
    the role gate - which SITES and TASKS a person may use is
    enforced per request by ``services.project_scope`` (Incharge and
    Manager are limited to the tasks granted on their sites; the HO
    to the Overview).
    """

    message = (
        "Project Monitor portal access is required."
    )

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not _is_active_authenticated(user):
            return False

        return user.role in {
            UserRole.DIRECTOR,
            UserRole.PROJECT_MANAGER,
            UserRole.PROJECT_INCHARGE,
            UserRole.PROJECT_HO,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class HasProjectMonitorReportingAccess(BasePermission):
    """
    Live visibility across every project for the Director and the
    project roles - no submit/approve cycle to gate here, per the
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
            UserRole.PROJECT_HO,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class HasProjectSitePickerAccess(BasePermission):
    """
    The site picker (``project-monitor/sites/``): everyone with any
    Project Monitor role, including the HR and Machinery departments,
    whose only page needs the list of sites. Every other endpoint
    keeps its own, narrower gate.
    """

    message = "Project Monitor access is required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not _is_active_authenticated(user):
            return False

        return user.role in {
            UserRole.DIRECTOR,
            UserRole.PROJECT_MANAGER,
            UserRole.PROJECT_INCHARGE,
            UserRole.PROJECT_HO,
            UserRole.HR_DEPARTMENT,
            UserRole.MACHINERY_DEPARTMENT,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class HasProjectMonitorMasterAccess(BasePermission):
    """
    The Project Management masters (the Structure Type master - which
    config fields/activity groups a structure type generates - and the
    RDSO span library) are configuration, not day-to-day entry.
    Read access (so the Add-a-structure form and matrix can list
    active types) is open to anyone with portal or reporting access;
    writes are for Admin/Super Admin, the Director and the Project
    Management HO. (Who may use which site stays on Site Access,
    which is for Admin/Super Admin and the Director.)
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
                UserRole.PROJECT_HO,
                UserRole.ADMIN,
                UserRole.SUPER_ADMIN,
            }

        return user.role in {
            UserRole.DIRECTOR,
            UserRole.PROJECT_HO,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class HasFinanceRoleAccess(BasePermission):
    """
    The role-level gate for the finance endpoints (DPR/billing, HR,
    Machinery): only the roles that can ever see finance data get past
    it. Whether the caller may see or enter a *particular site and
    task* is decided per request by ``services.site_access``
    (``ensure_can_view``/``ensure_can_enter`` and their HR and
    machinery versions), since that depends on the task, not just the
    role - e.g. the HR Department passes this gate but sees only HR.
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
            UserRole.PROJECT_HO,
            UserRole.HR_DEPARTMENT,
            UserRole.MACHINERY_DEPARTMENT,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class HasProjectMonitorCostingAccess(BasePermission):
    """
    Costing (expense vs value of work done, "Today at a glance") is
    the one Project Monitor feed with no per-site Project Manager or
    Incharge grant at all - project margin is materially more
    sensitive than progress or even billing figures. Only the
    Director and Admin/Super Admin may view AND enter material rates
    and the stores concrete-production figures.
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
            UserRole.DIRECTOR,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class IsProjectMonitorAdmin(BasePermission):
    """
    Admin/Super Admin and the Director (site assignments, day
    unlocks).
    """

    message = "Admin access is required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not _is_active_authenticated(user):
            return False

        return user.role in {
            UserRole.DIRECTOR,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }
