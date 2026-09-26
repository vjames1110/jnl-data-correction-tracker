from rest_framework.permissions import (
    SAFE_METHODS,
    BasePermission,
)

from apps.authentication.models import (
    AccountStatus,
    UserRole,
)
from apps.authentication.roles import SETUP_MANAGER_ROLES


class HasOrganizationAccess(BasePermission):
    """
    Allow active users to view organization masters.

    Admin, Super Admin and the Director can manage organization
    records.
    Viewsets can set ``super_admin_only_writes`` for operations that
    should be restricted to Super Admin.
    """

    message = "Organization access is required."

    def has_permission(
        self,
        request,
        view,
    ) -> bool:
        user = request.user

        if not user or not user.is_authenticated:
            return False

        is_active_account = bool(
            user.is_active
            and user.account_status == AccountStatus.ACTIVE
        )

        if not is_active_account:
            return False

        if request.method in SAFE_METHODS:
            return True

        if getattr(
            view,
            "super_admin_only_writes",
            False,
        ):
            return user.role == UserRole.SUPER_ADMIN

        return user.role in SETUP_MANAGER_ROLES
