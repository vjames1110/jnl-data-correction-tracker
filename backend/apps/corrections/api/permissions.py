from rest_framework.permissions import BasePermission

from apps.authentication.models import AccountStatus


class HasCorrectionRequestAccess(BasePermission):
    """
    Allow active authenticated users to manage their own drafts.
    """

    message = "Correction request access is required."

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
            and user.account_status
            == AccountStatus.ACTIVE
        )
