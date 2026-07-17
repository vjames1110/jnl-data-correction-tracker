from drf_spectacular.extensions import (
    OpenApiAuthenticationExtension,
)


class ApplicationJWTAuthenticationScheme(
    OpenApiAuthenticationExtension
):
    target_class = (
        "apps.authentication.api.authentication."
        "ApplicationJWTAuthentication"
    )
    name = "bearerAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
