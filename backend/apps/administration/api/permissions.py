from rest_framework.permissions import BasePermission

from apps.authentication.models import (
    AccountStatus,
    UserRole,
)
from apps.authentication.roles import SETUP_MANAGER_ROLES


class HasAdminPortalAccess(BasePermission):
    """
    Permit access only to active Super Admin and Admin users.
    """

    message = "Administrator access is required."

    def has_permission(
        self,
        request,
        view,
    ) -> bool:
        user = request.user

        if not user or not user.is_authenticated:
            return False

        return bool(
            user.is_active
            and user.account_status == AccountStatus.ACTIVE
            and user.role
            in {
                UserRole.SUPER_ADMIN,
                UserRole.ADMIN,
            }
        )


class HasAdministrationPortalAccess(BasePermission):
    """
    Permit the Administration module's own screens (User Management,
    Organization Setup and Project Management setup) to Super Admin,
    Admin and the Director. What each of them may do on a screen is
    decided by ``get_user_capabilities`` and by that screen's API.
    """

    message = "Administration access is required."

    def has_permission(
        self,
        request,
        view,
    ) -> bool:
        user = request.user

        if not user or not user.is_authenticated:
            return False

        return bool(
            user.is_active
            and user.account_status == AccountStatus.ACTIVE
            and user.role in SETUP_MANAGER_ROLES
        )


class IsSuperAdminOnly(BasePermission):
    """
    Permit access only to an active Super Admin.
    """

    message = "Super Administrator access is required."

    def has_permission(
        self,
        request,
        view,
    ) -> bool:
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.account_status == AccountStatus.ACTIVE
            and user.role == UserRole.SUPER_ADMIN
        )