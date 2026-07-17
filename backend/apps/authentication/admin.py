from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.authentication.models import (
    LoginHistory,
    User,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["employee_id"]

    list_display = [
        "employee_id",
        "full_name",
        "role",
        "account_status",
        "is_active",
        "is_staff",
        "must_change_password",
        "last_login",
    ]

    list_filter = [
        "role",
        "account_status",
        "is_active",
        "is_staff",
        "must_change_password",
    ]

    search_fields = [
        "employee_id",
        "first_name",
        "last_name",
        "email",
    ]

    readonly_fields = [
        "id",
        "last_login",
        "password_changed_at",
        "failed_login_attempts",
        "last_failed_login_at",
        "last_login_ip",
        "created_at",
        "updated_at",
    ]

    fieldsets = (
        (
            "Authentication",
            {
                "fields": (
                    "id",
                    "employee_id",
                    "password",
                )
            },
        ),
        (
            "Personal information",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "email",
                )
            },
        ),
        (
            "Access control",
            {
                "fields": (
                    "role",
                    "account_status",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (
            "Password security",
            {
                "fields": (
                    "must_change_password",
                    "password_changed_at",
                )
            },
        ),
        (
            "Login security",
            {
                "fields": (
                    "failed_login_attempts",
                    "locked_until",
                    "last_failed_login_at",
                    "last_login_ip",
                    "last_login",
                )
            },
        ),
        (
            "Audit information",
            {
                "fields": (
                    "created_by",
                    "updated_by",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    add_fieldsets = (
        (
            "Create user",
            {
                "classes": ("wide",),
                "fields": (
                    "employee_id",
                    "first_name",
                    "last_name",
                    "email",
                    "role",
                    "password1",
                    "password2",
                    "is_active",
                    "is_staff",
                    "must_change_password",
                ),
            },
        ),
    )


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = [
        "employee_id_attempted",
        "event_type",
        "was_successful",
        "ip_address",
        "created_at",
    ]

    list_filter = [
        "event_type",
        "was_successful",
        "created_at",
    ]

    search_fields = [
        "employee_id_attempted",
        "user__employee_id",
        "ip_address",
        "request_id",
    ]

    readonly_fields = [
        "id",
        "user",
        "employee_id_attempted",
        "event_type",
        "was_successful",
        "ip_address",
        "user_agent",
        "failure_reason",
        "request_id",
        "created_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(
        self,
        request,
        obj=None,
    ):
        return False