from django.contrib import admin

from apps.organization.models import (
    ApprovalAuthorityType,
    Company,
    Department,
    Designation,
    DirectorMapping,
    ReportingManagerMapping,
    Site,
    SiteDepartmentMapping,
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


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = [
        "department_code",
        "department_name",
        "company",
        "department_hod",
        "display_order",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "company",
        "is_active",
    ]
    search_fields = [
        "department_code",
        "department_name",
        "description",
        "department_hod__employee_id",
        "department_hod__first_name",
        "department_hod__last_name",
    ]
    autocomplete_fields = [
        "company",
        "department_hod",
    ]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
    ]
    fieldsets = (
        (
            "Department details",
            {
                "fields": (
                    "id",
                    "company",
                    "department_code",
                    "department_name",
                    "description",
                    "department_hod",
                    "display_order",
                    "is_active",
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


@admin.register(Designation)
class DesignationAdmin(admin.ModelAdmin):
    list_display = [
        "designation_code",
        "designation_name",
        "department",
        "level",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "department__company",
        "department",
        "is_active",
        "level",
    ]
    search_fields = [
        "designation_code",
        "designation_name",
        "department__department_code",
        "department__department_name",
    ]
    autocomplete_fields = [
        "department",
    ]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
    ]
    fieldsets = (
        (
            "Designation details",
            {
                "fields": (
                    "id",
                    "department",
                    "designation_code",
                    "designation_name",
                    "level",
                    "is_active",
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


@admin.register(SiteDepartmentMapping)
class SiteDepartmentMappingAdmin(admin.ModelAdmin):
    list_display = [
        "site",
        "department",
        "site_hod",
        "department_hod",
        "effective_date",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "site__company",
        "site",
        "department",
        "is_active",
    ]
    search_fields = [
        "site__site_code",
        "site__site_name",
        "department__department_code",
        "department__department_name",
        "site_hod__employee_id",
        "department_hod__employee_id",
    ]
    autocomplete_fields = [
        "site",
        "department",
        "site_hod",
        "department_hod",
    ]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
    ]
    fieldsets = (
        (
            "Mapping details",
            {
                "fields": (
                    "id",
                    "site",
                    "department",
                    "site_hod",
                    "department_hod",
                    "effective_date",
                    "is_active",
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


@admin.register(DirectorMapping)
class DirectorMappingAdmin(admin.ModelAdmin):
    list_display = [
        "director",
        "site",
        "department",
        "authority_type",
        "effective_from",
        "effective_to",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "authority_type",
        "site__company",
        "site",
        "department",
        "is_active",
    ]
    search_fields = [
        "director__employee_id",
        "director__first_name",
        "director__last_name",
        "site__site_code",
        "site__site_name",
        "department__department_code",
        "department__department_name",
    ]
    autocomplete_fields = [
        "director",
        "site",
        "department",
    ]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
    ]
    fieldsets = (
        (
            "Director authority",
            {
                "fields": (
                    "id",
                    "director",
                    "site",
                    "department",
                    "authority_type",
                    "effective_from",
                    "effective_to",
                    "is_active",
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

    def get_changeform_initial_data(self, request):
        initial_data = super().get_changeform_initial_data(
            request
        )
        initial_data.setdefault(
            "authority_type",
            ApprovalAuthorityType.PRIMARY,
        )
        return initial_data


@admin.register(ReportingManagerMapping)
class ReportingManagerMappingAdmin(admin.ModelAdmin):
    list_display = [
        "employee",
        "reporting_manager",
        "site",
        "department",
        "effective_from",
        "effective_to",
        "is_active",
        "updated_at",
    ]
    list_filter = [
        "site__company",
        "site",
        "department",
        "is_active",
    ]
    search_fields = [
        "employee__employee_id",
        "employee__first_name",
        "employee__last_name",
        "reporting_manager__employee_id",
        "reporting_manager__first_name",
        "reporting_manager__last_name",
        "site__site_code",
        "department__department_code",
    ]
    autocomplete_fields = [
        "employee",
        "reporting_manager",
        "site",
        "department",
    ]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
    ]
    fieldsets = (
        (
            "Reporting relation",
            {
                "fields": (
                    "id",
                    "employee",
                    "reporting_manager",
                    "site",
                    "department",
                    "effective_from",
                    "effective_to",
                    "is_active",
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
