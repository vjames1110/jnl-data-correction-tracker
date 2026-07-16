from rest_framework.permissions import BasePermission


class IsActiveAuthenticatedUser(BasePermission):
    """
    Allow access only to authenticated and active users.
    """

    message = "Your account is inactive or authentication is required."

    def has_permission(self, request, view) -> bool:
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and user.is_active
        )


class IsStaffUser(BasePermission):
    """
    Allow access only to active Django staff users.

    This is temporary foundation-level permission. Application-specific
    admin roles will be introduced during authentication.
    """

    message = "Administrator access is required."

    def has_permission(self, request, view) -> bool:
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.is_staff
        )


class ReadOnly(BasePermission):
    """
    Allow only safe read requests.
    """

    def has_permission(self, request, view) -> bool:
        return request.method in {
            "GET",
            "HEAD",
            "OPTIONS",
        }