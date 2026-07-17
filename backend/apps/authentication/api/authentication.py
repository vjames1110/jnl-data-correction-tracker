from rest_framework.exceptions import (
    PermissionDenied,
)
from rest_framework_simplejwt.authentication import (
    JWTAuthentication,
)


PASSWORD_CHANGE_ALLOWED_PATHS = {
    "/api/v1/auth/me/",
    "/api/v1/auth/change-password/",
    "/api/v1/auth/logout/",
    "/api/v1/auth/refresh/",
    "/api/v1/auth/verify/",
}


class ApplicationJWTAuthentication(
    JWTAuthentication
):
    """
    Prevent users with temporary passwords from accessing normal
    application APIs before changing their password.
    """

    def authenticate(self, request):
        authentication_result = super().authenticate(
            request
        )

        if authentication_result is None:
            return None

        user, validated_token = (
            authentication_result
        )

        if (
            user.must_change_password
            and request.path
            not in PASSWORD_CHANGE_ALLOWED_PATHS
        ):
            raise PermissionDenied(
                detail={
                    "code": "PASSWORD_CHANGE_REQUIRED",
                    "message": (
                        "You must change your temporary "
                        "password before continuing."
                    ),
                }
            )

        return user, validated_token