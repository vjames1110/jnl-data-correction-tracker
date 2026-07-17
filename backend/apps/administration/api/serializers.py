from rest_framework import serializers

from apps.authentication.models import (
    LoginHistory,
    User,
)


class DashboardPeriodQuerySerializer(
    serializers.Serializer
):
    period = serializers.ChoiceField(
        choices=[
            ("7d", "Last 7 days"),
            ("30d", "Last 30 days"),
            ("90d", "Last 90 days"),
        ],
        default="30d",
        required=False,
    )


class LoginTrendQuerySerializer(
    DashboardPeriodQuerySerializer
):
    pass


class RecentActivityQuerySerializer(
    serializers.Serializer
):
    limit = serializers.IntegerField(
        default=10,
        min_value=1,
        max_value=50,
        required=False,
    )


class AdminProfileSerializer(
    serializers.ModelSerializer
):
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
            "first_name",
            "last_name",
            "full_name",
            "email",
            "role",
            "role_display",
            "account_status",
            "account_status_display",
            "is_active",
            "is_staff",
            "must_change_password",
            "password_changed_at",
            "last_login",
            "last_login_ip",
            "created_at",
        ]


class RecentLoginActivitySerializer(
    serializers.ModelSerializer
):
    user_full_name = serializers.SerializerMethodField()
    role = serializers.CharField(
        source="user.role",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = LoginHistory
        fields = [
            "id",
            "employee_id_attempted",
            "user_full_name",
            "role",
            "event_type",
            "was_successful",
            "ip_address",
            "failure_reason",
            "created_at",
        ]

    def get_user_full_name(
        self,
        obj: LoginHistory,
    ) -> str | None:
        if obj.user is None:
            return None

        return obj.user.full_name