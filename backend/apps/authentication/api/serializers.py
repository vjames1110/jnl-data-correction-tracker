from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import (
    validate_password,
)
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import (
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.exceptions import (
    ExpiredTokenError,
    InvalidToken,
    TokenError,
)
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import UntypedToken

try:
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken,
    )
except ImportError:  # pragma: no cover
    BlacklistedToken = None

from apps.authentication.models import (
    AccountStatus,
    LoginEventType,
    User,
)
from apps.authentication.selectors.users import (
    get_user_by_employee_id,
)
from apps.authentication.services.authentication import (
    record_login_event,
    register_failed_login,
)


class CurrentUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        read_only=True,
    )

    role_display = serializers.CharField(
        source="get_role_display",
        read_only=True,
    )

    account_status_display = serializers.CharField(
        source="get_account_status_display",
        read_only=True,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "employee_id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "role_display",
            "account_status",
            "account_status_display",
            "is_active",
            "is_staff",
            "must_change_password",
            "password_changed_at",
            "last_login",
        ]


class LoginResponseDataSerializer(serializers.Serializer):
    access = serializers.CharField(
        read_only=True,
    )
    refresh = serializers.CharField(
        read_only=True,
    )
    token_type = serializers.CharField(
        read_only=True,
    )
    must_change_password = serializers.BooleanField(
        read_only=True,
    )
    user = CurrentUserSerializer(
        read_only=True,
    )


class LoginResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(
        read_only=True,
    )
    message = serializers.CharField(
        read_only=True,
    )
    data = LoginResponseDataSerializer(
        read_only=True,
    )


class CurrentUserResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(
        read_only=True,
    )
    message = serializers.CharField(
        read_only=True,
    )
    data = CurrentUserSerializer(
        read_only=True,
    )


class EmptyDataResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(
        read_only=True,
    )
    message = serializers.CharField(
        read_only=True,
    )
    data = serializers.JSONField(
        read_only=True,
        allow_null=True,
    )


class TokenRefreshResponseDataSerializer(serializers.Serializer):
    access = serializers.CharField(
        read_only=True,
    )
    refresh = serializers.CharField(
        read_only=True,
    )
    token_type = serializers.CharField(
        read_only=True,
    )


class TokenRefreshResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(
        read_only=True,
    )
    message = serializers.CharField(
        read_only=True,
    )
    data = TokenRefreshResponseDataSerializer(
        read_only=True,
    )


class TokenVerifyResponseDataSerializer(serializers.Serializer):
    valid = serializers.BooleanField(
        read_only=True,
    )
    token_type = serializers.CharField(
        read_only=True,
    )
    user_id = serializers.CharField(
        read_only=True,
        allow_blank=True,
    )


class TokenVerifyResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(
        read_only=True,
    )
    message = serializers.CharField(
        read_only=True,
    )
    data = TokenVerifyResponseDataSerializer(
        read_only=True,
    )


class ApplicationTokenRefreshSerializer(
    TokenRefreshSerializer
):
    """
    Validate refresh tokens while preserving the standard Simple JWT
    rotation and blacklist behavior.
    """

    def validate(self, attrs):
        self.user = None

        try:
            refresh = self.token_class(
                attrs["refresh"]
            )
        except TokenError as exc:
            raise InvalidToken(exc.args[0]) from exc

        user_id = refresh.payload.get(
            api_settings.USER_ID_CLAIM
        )

        if user_id:
            self.user = (
                get_user_model()
                .objects.filter(
                    **{
                        api_settings.USER_ID_FIELD: user_id
                    }
                )
                .first()
            )

        try:
            data = super().validate(attrs)
        except TokenError as exc:
            raise InvalidToken(exc.args[0]) from exc

        if not data.get("access"):
            raise serializers.ValidationError(
                {
                    "access": [
                        "A refreshed access token could not be generated."
                    ]
                }
            )

        if not data.get("refresh"):
            data["refresh"] = attrs["refresh"]

        data["token_type"] = "Bearer"

        return data


class ApplicationTokenVerifySerializer(
    serializers.Serializer
):
    token = serializers.CharField(
        write_only=True,
    )

    def validate(self, attrs):
        self.failure_code = "INVALID_TOKEN"
        self.validated_token = None

        try:
            token = UntypedToken(attrs["token"])
        except ExpiredTokenError as exc:
            self.failure_code = "TOKEN_EXPIRED"
            raise InvalidToken(exc.args[0]) from exc
        except TokenError as exc:
            raise InvalidToken(exc.args[0]) from exc

        if self._is_blacklisted(token):
            self.failure_code = "TOKEN_REVOKED"
            raise InvalidToken("Token is blacklisted")

        self.validated_token = token

        return {
            "valid": True,
            "token_type": token.get(
                api_settings.TOKEN_TYPE_CLAIM,
                "",
            ),
            "user_id": str(
                token.get(
                    api_settings.USER_ID_CLAIM,
                    "",
                )
            ),
        }

    def _is_blacklisted(self, token) -> bool:
        if (
            BlacklistedToken is None
            or not api_settings.BLACKLIST_AFTER_ROTATION
            or (
                "rest_framework_simplejwt.token_blacklist"
                not in settings.INSTALLED_APPS
            )
        ):
            return False

        jti = token.get(api_settings.JTI_CLAIM)

        if not jti:
            return False

        return BlacklistedToken.objects.filter(
            token__jti=jti,
        ).exists()


class LoginSerializer(serializers.Serializer):
    employee_id = serializers.CharField(
        max_length=30,
        trim_whitespace=True,
    )

    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    def validate(self, attrs):
        request = self.context["request"]

        employee_id = (
            attrs["employee_id"]
            .strip()
            .upper()
        )
        password = attrs["password"]

        user = get_user_by_employee_id(
            employee_id
        )

        if user is None:
            record_login_event(
                request=request,
                employee_id=employee_id,
                event_type=LoginEventType.LOGIN_FAILED,
                was_successful=False,
                failure_reason="Unknown employee ID.",
            )

            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "Invalid Employee ID or password."
                    ]
                }
            )

        if not user.is_active:
            record_login_event(
                request=request,
                user=user,
                employee_id=employee_id,
                event_type=LoginEventType.LOGIN_FAILED,
                was_successful=False,
                failure_reason="Inactive account.",
            )

            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "This account is inactive."
                    ]
                }
            )

        if user.account_status == AccountStatus.SUSPENDED:
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "This account has been suspended."
                    ]
                }
            )

        if user.is_account_locked:
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "This account is temporarily locked."
                    ]
                }
            )

        authenticated_user = authenticate(
            request=request,
            employee_id=employee_id,
            password=password,
        )

        if authenticated_user is None:
            register_failed_login(
                user=user,
                request=request,
            )

            record_login_event(
                request=request,
                user=user,
                employee_id=employee_id,
                event_type=LoginEventType.LOGIN_FAILED,
                was_successful=False,
                failure_reason="Incorrect password.",
            )

            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "Invalid Employee ID or password."
                    ]
                }
            )

        attrs["user"] = authenticated_user

        return attrs


class ChangePasswordSerializer(
    serializers.Serializer
):
    current_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    new_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    confirm_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    def validate_current_password(
        self,
        value: str,
    ) -> str:
        user = self.context["request"].user

        if not user.check_password(value):
            raise serializers.ValidationError(
                "The current password is incorrect."
            )

        return value

    def validate(self, attrs):
        if (
            attrs["new_password"]
            != attrs["confirm_password"]
        ):
            raise serializers.ValidationError(
                {
                    "confirm_password": [
                        "The password confirmation does not match."
                    ]
                }
            )

        user = self.context["request"].user

        if user.check_password(
            attrs["new_password"]
        ):
            raise serializers.ValidationError(
                {
                    "new_password": [
                        "The new password must be different "
                        "from the current password."
                    ]
                }
            )

        try:
            validate_password(
                password=attrs["new_password"],
                user=user,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {
                    "new_password": list(exc.messages)
                }
            ) from exc

        return attrs


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(
        write_only=True,
    )
