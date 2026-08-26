from rest_framework.permissions import (
    SAFE_METHODS,
    BasePermission,
)

from apps.authentication.models import (
    AccountStatus,
    UserRole,
)


def can_manage_reconciliation_masters(user) -> bool:
    """
    Admin/Super Admin manage reconciliation masters company-wide;
    Store HO can also maintain them (item categories, items,
    rate/mix standards, site overrides, tolerance settings) so a
    site rollout doesn't have to wait on an administrator for every
    new item.
    """
    return bool(
        user
        and user.is_authenticated
        and user.role
        in {
            UserRole.SUPER_ADMIN,
            UserRole.ADMIN,
            UserRole.STORE_HO,
        }
    )


class HasReconciliationMasterAccess(BasePermission):
    """
    Allow active users to read reconciliation masters.

    Admin, Super Admin, and Store HO can manage item categories,
    items, and rate/mix standards.
    """

    message = (
        "Reconciliation master access is required."
    )

    def has_permission(
        self,
        request,
        view,
    ) -> bool:
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if not (
            user.is_active
            and user.account_status
            == AccountStatus.ACTIVE
        ):
            return False

        if request.method in SAFE_METHODS:
            return True

        return can_manage_reconciliation_masters(user)


class HasStorePortalAccess(BasePermission):
    """
    Allow Store HO (and admins) into the store portal. Store HO
    prepares every site's monthly reconciliation - there is no
    separate site-scoped data-entry role; a single Store HO account
    picks whichever site it's working on.
    """

    message = "Store portal access is required."

    def has_permission(
        self,
        request,
        view,
    ) -> bool:
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if not (
            user.is_active
            and user.account_status
            == AccountStatus.ACTIVE
        ):
            return False

        return user.role in {
            UserRole.STORE_HO,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class HasReconciliationReportingAccess(BasePermission):
    """
    Cross-site reporting/reopening: Director, Store HO, and
    Admin/Super Admin all legitimately work across every site.
    """

    message = (
        "Reconciliation reporting access is required."
    )

    def has_permission(
        self,
        request,
        view,
    ) -> bool:
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if not (
            user.is_active
            and user.account_status
            == AccountStatus.ACTIVE
        ):
            return False

        return user.role in {
            UserRole.DIRECTOR,
            UserRole.STORE_HO,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }


class HasReconciliationApprovalAccess(BasePermission):
    """
    Approving/returning/rejecting a submitted period is Director or
    Admin/Super Admin only. Store HO prepares and submits periods
    but does not approve its own work.
    """

    message = (
        "Reconciliation approval access is required."
    )

    def has_permission(
        self,
        request,
        view,
    ) -> bool:
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if not (
            user.is_active
            and user.account_status
            == AccountStatus.ACTIVE
        ):
            return False

        return user.role in {
            UserRole.DIRECTOR,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        }
