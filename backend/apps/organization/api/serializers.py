import copy

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.authentication.models import User
from apps.organization.models import (
    Company,
    Department,
    Designation,
    DirectorMapping,
    ReportingManagerMapping,
    Site,
    SiteDepartmentMapping,
)


class CleanModelSerializer(serializers.ModelSerializer):
    """
    Run model clean/full_clean during serializer validation.
    """

    def validate(self, attrs):
        attrs = super().validate(attrs)

        model_instance = (
            copy.copy(self.instance)
            if self.instance is not None
            else self.Meta.model()
        )

        for attr, value in attrs.items():
            setattr(model_instance, attr, value)

        try:
            model_instance.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                getattr(exc, "message_dict", None)
                or exc.messages
            ) from exc

        return attrs


class UserBriefSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        read_only=True,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "employee_id",
            "full_name",
            "role",
            "is_active",
        ]


class UserDropdownSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        read_only=True,
    )
    label = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "employee_id",
            "full_name",
            "role",
            "label",
        ]

    def get_label(self, obj: User) -> str:
        return (
            f"{obj.employee_id} - {obj.full_name}"
        )


class CompanySerializer(CleanModelSerializer):
    class Meta:
        model = Company
        fields = [
            "id",
            "company_code",
            "company_name",
            "registered_name",
            "address",
            "contact_person",
            "contact_email",
            "contact_phone",
            "website",
            "time_zone",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class SiteSerializer(CleanModelSerializer):
    company_code = serializers.CharField(
        source="company.company_code",
        read_only=True,
    )
    company_name = serializers.CharField(
        source="company.company_name",
        read_only=True,
    )
    site_director_detail = UserBriefSerializer(
        source="site_director",
        read_only=True,
    )
    site_hod_detail = UserBriefSerializer(
        source="site_hod",
        read_only=True,
    )

    class Meta:
        model = Site
        fields = [
            "id",
            "company",
            "company_code",
            "company_name",
            "site_code",
            "site_name",
            "project_name",
            "state",
            "district",
            "address",
            "start_date",
            "end_date",
            "site_director",
            "site_director_detail",
            "site_hod",
            "site_hod_detail",
            "cost_centre",
            "erp_site_code",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class DepartmentSerializer(CleanModelSerializer):
    department_code = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    company_code = serializers.CharField(
        source="company.company_code",
        read_only=True,
    )
    company_name = serializers.CharField(
        source="company.company_name",
        read_only=True,
    )
    department_hod_detail = UserBriefSerializer(
        source="department_hod",
        read_only=True,
    )

    class Meta:
        model = Department
        fields = [
            "id",
            "company",
            "company_code",
            "company_name",
            "department_code",
            "department_name",
            "description",
            "department_hod",
            "department_hod_detail",
            "display_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]
        validators = []


class DesignationSerializer(CleanModelSerializer):
    designation_code = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = Designation
        fields = [
            "id",
            "designation_code",
            "designation_name",
            "level",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class SiteDepartmentMappingSerializer(CleanModelSerializer):
    site_code = serializers.CharField(
        source="site.site_code",
        read_only=True,
    )
    site_name = serializers.CharField(
        source="site.site_name",
        read_only=True,
    )
    department_code = serializers.CharField(
        source="department.department_code",
        read_only=True,
    )
    department_name = serializers.CharField(
        source="department.department_name",
        read_only=True,
    )
    site_hod_detail = UserBriefSerializer(
        source="site_hod",
        read_only=True,
    )
    department_hod_detail = UserBriefSerializer(
        source="department_hod",
        read_only=True,
    )

    class Meta:
        model = SiteDepartmentMapping
        fields = [
            "id",
            "site",
            "site_code",
            "site_name",
            "department",
            "department_code",
            "department_name",
            "site_hod",
            "site_hod_detail",
            "department_hod",
            "department_hod_detail",
            "effective_date",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class DirectorMappingSerializer(CleanModelSerializer):
    director_detail = UserBriefSerializer(
        source="director",
        read_only=True,
    )
    site_code = serializers.CharField(
        source="site.site_code",
        read_only=True,
    )
    site_name = serializers.CharField(
        source="site.site_name",
        read_only=True,
    )
    department_code = serializers.CharField(
        source="department.department_code",
        read_only=True,
    )
    department_name = serializers.CharField(
        source="department.department_name",
        read_only=True,
    )

    class Meta:
        model = DirectorMapping
        fields = [
            "id",
            "director",
            "director_detail",
            "site",
            "site_code",
            "site_name",
            "department",
            "department_code",
            "department_name",
            "effective_from",
            "effective_to",
            "authority_type",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class ReportingManagerMappingSerializer(
    CleanModelSerializer
):
    employee_detail = UserBriefSerializer(
        source="employee",
        read_only=True,
    )
    reporting_manager_detail = UserBriefSerializer(
        source="reporting_manager",
        read_only=True,
    )
    site_code = serializers.CharField(
        source="site.site_code",
        read_only=True,
    )
    site_name = serializers.CharField(
        source="site.site_name",
        read_only=True,
    )
    department_code = serializers.CharField(
        source="department.department_code",
        read_only=True,
    )
    department_name = serializers.CharField(
        source="department.department_name",
        read_only=True,
    )

    class Meta:
        model = ReportingManagerMapping
        fields = [
            "id",
            "employee",
            "employee_detail",
            "reporting_manager",
            "reporting_manager_detail",
            "site",
            "site_code",
            "site_name",
            "department",
            "department_code",
            "department_name",
            "effective_from",
            "effective_to",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]
