from rest_framework.permissions import (
    SAFE_METHODS,
    BasePermission,
)

from apps.authentication.models import (
    AccountStatus,
    UserRole,
)


class HasEmployeeAccess(BasePermission):
    """
    Allow active users to view employees and admins to manage them.
    """

    message = "Employee master access is required."

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
            and user.account_status == AccountStatus.ACTIVE
        ):
            return False

        if request.method in SAFE_METHODS:
            return True

        return user.role in {
            UserRole.SUPER_ADMIN,
            UserRole.ADMIN,
        }
