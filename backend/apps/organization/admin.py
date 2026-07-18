from django.contrib import admin

from apps.organization.models import Company


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = [
        "company_code",
        "company_name",
        "registered_name",
        "is_active",
        "time_zone",
        "updated_at",
    ]
    list_filter = [
        "is_active",
        "time_zone",
    ]
    search_fields = [
        "company_code",
        "company_name",
        "registered_name",
        "contact_person",
        "contact_email",
        "contact_phone",
    ]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
    ]
    fieldsets = (
        (
            "Company details",
            {
                "fields": (
                    "id",
                    "company_code",
                    "company_name",
                    "registered_name",
                    "is_active",
                    "time_zone",
                )
            },
        ),
        (
            "Address and contact",
            {
                "fields": (
                    "address",
                    "contact_person",
                    "contact_email",
                    "contact_phone",
                    "website",
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
