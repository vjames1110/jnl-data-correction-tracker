from django.contrib import admin

from apps.employees.models import (
    EmployeeProfile,
)


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = [
        "employee_id",
        "full_name",
        "role",
        "employment_status",
        "site",
        "department",
        "designation",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "employment_status",
        "role",
        "gender",
        "site",
        "department",
        "designation",
        "is_active",
    ]
    search_fields = [
        "employee_id",
        "first_name",
        "last_name",
        "email",
        "mobile",
        "erp_user_id",
        "user__employee_id",
    ]
    autocomplete_fields = [
        "user",
        "site",
        "department",
        "designation",
        "reporting_manager",
    ]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
    ]
    fieldsets = (
        (
            "Employee identity",
            {
                "fields": (
                    "id",
                    "user",
                    "employee_id",
                    "first_name",
                    "last_name",
                    "email",
                    "mobile",
                    "gender",
                    "profile_photo",
                    "is_active",
                )
            },
        ),
        (
            "Employment details",
            {
                "fields": (
                    "date_of_joining",
                    "last_working_date",
                    "employment_status",
                    "role",
                    "erp_user_id",
                )
            },
        ),
        (
            "Organization mapping",
            {
                "fields": (
                    "site",
                    "department",
                    "designation",
                    "reporting_manager",
                )
            },
        ),
        (
            "Audit information",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )
