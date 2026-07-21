from rest_framework import serializers

from apps.authentication.models import (
    AccountStatus,
    LoginHistory,
    User,
    UserRole,
)
from apps.employees.models import EmployeeProfile


class UserAccountSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
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
            "account_status",
            "account_status_display",
            "is_active",
            "is_staff",
            "must_change_password",
            "locked_until",
            "last_login",
        ]


class EmployeeProfileSerializer(
    serializers.ModelSerializer
):
    user_detail = UserAccountSerializer(
        source="user",
        read_only=True,
    )
    full_name = serializers.CharField(
        read_only=True,
    )
    site_code = serializers.CharField(
        source="site.site_code",
        read_only=True,
    )
    department_code = serializers.CharField(
        source="department.department_code",
        read_only=True,
    )
    designation_code = serializers.CharField(
        source="designation.designation_code",
        read_only=True,
    )
    reporting_manager_employee_id = (
        serializers.CharField(
            source="reporting_manager.employee_id",
            read_only=True,
        )
    )

    class Meta:
        model = EmployeeProfile
        fields = [
            "id",
            "user",
            "user_detail",
            "employee_id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "mobile",
            "gender",
            "date_of_joining",
            "employment_status",
            "site",
            "site_code",
            "department",
            "department_code",
            "designation",
            "designation_code",
            "reporting_manager",
            "reporting_manager_employee_id",
            "role",
            "is_active",
            "erp_user_id",
            "profile_photo",
            "last_working_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class EmployeeImportFileSerializer(
    serializers.Serializer
):
    file = serializers.FileField()


class EmployeeFailedRowsExportSerializer(
    serializers.Serializer
):
    failed_rows = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=True,
    )


class EmployeeCreateAccountSerializer(
    serializers.Serializer
):
    role = serializers.ChoiceField(
        choices=UserRole.choices,
        required=False,
    )
    send_notification = serializers.BooleanField(
        required=False,
        default=False,
    )

    def validate_role(self, value):
        return value or UserRole.USER


class EmployeeChangeRoleSerializer(
    serializers.Serializer
):
    role = serializers.ChoiceField(
        choices=UserRole.choices,
    )


class LoginHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginHistory
        fields = [
            "id",
            "employee_id_attempted",
            "event_type",
            "was_successful",
            "ip_address",
            "failure_reason",
            "request_id",
            "created_at",
        ]


class EmployeeAccountActionResponseSerializer(
    serializers.Serializer
):
    user = UserAccountSerializer()
    temporary_password = serializers.CharField(
        required=False,
    )
    notification = serializers.DictField(
        required=False,
    )
    revoked_sessions = serializers.IntegerField(
        required=False,
    )


class EmployeeAccountStatusSerializer(
    serializers.Serializer
):
    account_status = serializers.ChoiceField(
        choices=AccountStatus.choices,
    )
