from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import (
    validate_password,
)
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

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
