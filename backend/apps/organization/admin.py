from django.contrib import admin

from apps.organization.models import (
    Company,
    Site,
)


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


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = [
        "site_code",
        "site_name",
        "company",
        "state",
        "district",
        "is_active",
        "site_director",
        "site_hod",
        "updated_at",
    ]
    list_filter = [
        "company",
        "is_active",
        "state",
        "district",
    ]
    search_fields = [
        "site_code",
        "site_name",
        "project_name",
        "state",
        "district",
        "cost_centre",
        "erp_site_code",
        "site_director__employee_id",
        "site_director__first_name",
        "site_director__last_name",
        "site_hod__employee_id",
        "site_hod__first_name",
        "site_hod__last_name",
    ]
    autocomplete_fields = [
        "company",
        "site_director",
        "site_hod",
    ]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
    ]
    fieldsets = (
        (
            "Site details",
            {
                "fields": (
                    "id",
                    "company",
                    "site_code",
                    "site_name",
                    "project_name",
                    "is_active",
                )
            },
        ),
        (
            "Location",
            {
                "fields": (
                    "state",
                    "district",
                    "address",
                )
            },
        ),
        (
            "Dates and mappings",
            {
                "fields": (
                    "start_date",
                    "end_date",
                    "site_director",
                    "site_hod",
                )
            },
        ),
        (
            "ERP references",
            {
                "fields": (
                    "cost_centre",
                    "erp_site_code",
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
