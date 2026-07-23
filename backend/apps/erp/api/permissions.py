from rest_framework.permissions import (
    SAFE_METHODS,
    BasePermission,
)

from apps.authentication.models import (
    AccountStatus,
    UserRole,
)


class HasErpMasterAccess(BasePermission):
    """
    Allow active users to read ERP masters.

    Admin and Super Admin users can manage ERP configuration.
    """

    message = "ERP master access is required."

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

        return user.role in {
            UserRole.SUPER_ADMIN,
            UserRole.ADMIN,
        }
