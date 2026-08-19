import copy

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.authentication.models import User
from apps.erp.models import (
    ErpModule,
    Priority,
    ReasonCategory,
    ResponsiblePersonMapping,
    RequestFieldConfiguration,
    VoucherType,
    WorkType,
)


class ErpCleanModelSerializer(serializers.ModelSerializer):
    """
    Run model validation while leaving many-to-many fields to DRF.
    """

    def validate(self, attrs):
        attrs = super().validate(attrs)
        model_instance = (
            copy.copy(self.instance)
            if self.instance is not None
            else self.Meta.model()
        )
        many_to_many_fields = {
            field.name
            for field in model_instance._meta.many_to_many
        }

        for attr, value in attrs.items():
            if attr not in many_to_many_fields:
                setattr(model_instance, attr, value)

        try:
            model_instance.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                getattr(exc, "message_dict", None)
                or exc.messages
            ) from exc

        return attrs


class ErpModuleSerializer(ErpCleanModelSerializer):
    module_code = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    department_details = serializers.SerializerMethodField()

    class Meta:
        model = ErpModule
        fields = [
            "id",
            "module_code",
            "module_name",
            "description",
            "departments",
            "department_details",
            "display_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "department_details",
            "created_at",
            "updated_at",
        ]

    def get_department_details(
        self,
        obj: ErpModule,
    ) -> list[dict[str, str]]:
        return [
            {
                "id": str(department.id),
                "code": department.department_code,
                "label": department.department_name,
            }
            for department in obj.departments.all()
        ]


class VoucherTypeSerializer(ErpCleanModelSerializer):
    voucher_code = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    erp_module_code = serializers.CharField(
        source="erp_module.module_code",
        read_only=True,
    )
    erp_module_name = serializers.CharField(
        source="erp_module.module_name",
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
        model = VoucherType
        fields = [
            "id",
            "voucher_code",
            "voucher_name",
            "erp_module",
            "erp_module_code",
            "erp_module_name",
            "department",
            "department_code",
            "department_name",
            "requires_voucher_number",
            "requires_voucher_date",
            "requires_amount",
            "requires_quantity",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "erp_module_code",
            "erp_module_name",
            "department_code",
            "department_name",
            "created_at",
            "updated_at",
        ]
        validators = []


class WorkTypeSerializer(ErpCleanModelSerializer):
    work_type_code = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = WorkType
        fields = [
            "id",
            "work_type_code",
            "work_type_name",
            "description",
            "requires_approval",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class ReasonCategorySerializer(ErpCleanModelSerializer):
    reason_code = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    voucher_types = serializers.PrimaryKeyRelatedField(
        queryset=VoucherType.objects.all(),
        many=True,
        required=False,
    )
    voucher_type_details = serializers.SerializerMethodField()

    class Meta:
        model = ReasonCategory
        fields = [
            "id",
            "reason_code",
            "reason_name",
            "description",
            "display_order",
            "voucher_types",
            "voucher_type_details",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "voucher_type_details",
            "created_at",
            "updated_at",
        ]

    def get_voucher_type_details(
        self,
        obj: ReasonCategory,
    ) -> list[dict[str, str]]:
        return [
            {
                "id": str(voucher_type.id),
                "code": voucher_type.voucher_code,
                "label": voucher_type.voucher_name,
            }
            for voucher_type in obj.voucher_types.all()
        ]


class PrioritySerializer(ErpCleanModelSerializer):
    priority_code = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = Priority
        fields = [
            "id",
            "priority_code",
            "priority_name",
            "sla_duration_hours",
            "escalation_duration_hours",
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


class ResponsiblePersonBriefSerializer(serializers.ModelSerializer):
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
        ]


class ResponsiblePersonMappingSerializer(
    ErpCleanModelSerializer
):
    erp_module_code = serializers.CharField(
        source="erp_module.module_code",
        read_only=True,
    )
    erp_module_name = serializers.CharField(
        source="erp_module.module_name",
        read_only=True,
    )
    voucher_code = serializers.SerializerMethodField()
    voucher_name = serializers.SerializerMethodField()
    department_code = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    site_code = serializers.SerializerMethodField()
    site_name = serializers.SerializerMethodField()
    work_type_code = serializers.SerializerMethodField()
    work_type_name = serializers.SerializerMethodField()
    priority_code = serializers.SerializerMethodField()
    priority_name = serializers.SerializerMethodField()
    responsible_person_detail = (
        ResponsiblePersonBriefSerializer(
            source="responsible_person",
            read_only=True,
        )
    )

    class Meta:
        model = ResponsiblePersonMapping
        fields = [
            "id",
            "erp_module",
            "erp_module_code",
            "erp_module_name",
            "voucher_type",
            "voucher_code",
            "voucher_name",
            "department",
            "department_code",
            "department_name",
            "site",
            "site_code",
            "site_name",
            "work_type",
            "work_type_code",
            "work_type_name",
            "priority",
            "priority_code",
            "priority_name",
            "responsible_person",
            "responsible_person_detail",
            "display_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "erp_module_code",
            "erp_module_name",
            "voucher_code",
            "voucher_name",
            "department_code",
            "department_name",
            "site_code",
            "site_name",
            "work_type_code",
            "work_type_name",
            "priority_code",
            "priority_name",
            "responsible_person_detail",
            "created_at",
            "updated_at",
        ]

    def get_voucher_code(
        self,
        obj: ResponsiblePersonMapping,
    ) -> str:
        return (
            obj.voucher_type.voucher_code
            if obj.voucher_type_id
            else ""
        )

    def get_voucher_name(
        self,
        obj: ResponsiblePersonMapping,
    ) -> str:
        return (
            obj.voucher_type.voucher_name
            if obj.voucher_type_id
            else ""
        )

    def get_department_code(
        self,
        obj: ResponsiblePersonMapping,
    ) -> str:
        return (
            obj.department.department_code
            if obj.department_id
            else ""
        )

    def get_department_name(
        self,
        obj: ResponsiblePersonMapping,
    ) -> str:
        return (
            obj.department.department_name
            if obj.department_id
            else ""
        )

    def get_site_code(
        self,
        obj: ResponsiblePersonMapping,
    ) -> str:
        return (
            obj.site.site_code
            if obj.site_id
            else ""
        )

    def get_site_name(
        self,
        obj: ResponsiblePersonMapping,
    ) -> str:
        return (
            obj.site.site_name
            if obj.site_id
            else ""
        )

    def get_work_type_code(
        self,
        obj: ResponsiblePersonMapping,
    ) -> str:
        return (
            obj.work_type.work_type_code
            if obj.work_type_id
            else ""
        )

    def get_work_type_name(
        self,
        obj: ResponsiblePersonMapping,
    ) -> str:
        return (
            obj.work_type.work_type_name
            if obj.work_type_id
            else ""
        )

    def get_priority_code(
        self,
        obj: ResponsiblePersonMapping,
    ) -> str:
        return (
            obj.priority.priority_code
            if obj.priority_id
            else ""
        )

    def get_priority_name(
        self,
        obj: ResponsiblePersonMapping,
    ) -> str:
        return (
            obj.priority.priority_name
            if obj.priority_id
            else ""
        )


class RequestFieldConfigurationSerializer(
    ErpCleanModelSerializer
):
    field_key = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    erp_module_code = serializers.SerializerMethodField()
    erp_module_name = serializers.SerializerMethodField()
    voucher_code = serializers.SerializerMethodField()
    voucher_name = serializers.SerializerMethodField()
    work_type_code = serializers.SerializerMethodField()
    work_type_name = serializers.SerializerMethodField()
    priority_code = serializers.SerializerMethodField()
    priority_name = serializers.SerializerMethodField()

    class Meta:
        model = RequestFieldConfiguration
        fields = [
            "id",
            "field_key",
            "field_label",
            "field_state",
            "erp_module",
            "erp_module_code",
            "erp_module_name",
            "voucher_type",
            "voucher_code",
            "voucher_name",
            "work_type",
            "work_type_code",
            "work_type_name",
            "priority",
            "priority_code",
            "priority_name",
            "help_text",
            "display_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "erp_module_code",
            "erp_module_name",
            "voucher_code",
            "voucher_name",
            "work_type_code",
            "work_type_name",
            "priority_code",
            "priority_name",
            "created_at",
            "updated_at",
        ]

    def get_erp_module_code(
        self,
        obj: RequestFieldConfiguration,
    ) -> str:
        return (
            obj.erp_module.module_code
            if obj.erp_module_id
            else ""
        )

    def get_erp_module_name(
        self,
        obj: RequestFieldConfiguration,
    ) -> str:
        return (
            obj.erp_module.module_name
            if obj.erp_module_id
            else ""
        )

    def get_voucher_code(
        self,
        obj: RequestFieldConfiguration,
    ) -> str:
        return (
            obj.voucher_type.voucher_code
            if obj.voucher_type_id
            else ""
        )

    def get_voucher_name(
        self,
        obj: RequestFieldConfiguration,
    ) -> str:
        return (
            obj.voucher_type.voucher_name
            if obj.voucher_type_id
            else ""
        )

    def get_work_type_code(
        self,
        obj: RequestFieldConfiguration,
    ) -> str:
        return (
            obj.work_type.work_type_code
            if obj.work_type_id
            else ""
        )

    def get_work_type_name(
        self,
        obj: RequestFieldConfiguration,
    ) -> str:
        return (
            obj.work_type.work_type_name
            if obj.work_type_id
            else ""
        )

    def get_priority_code(
        self,
        obj: RequestFieldConfiguration,
    ) -> str:
        return (
            obj.priority.priority_code
            if obj.priority_id
            else ""
        )

    def get_priority_name(
        self,
        obj: RequestFieldConfiguration,
    ) -> str:
        return (
            obj.priority.priority_name
            if obj.priority_id
            else ""
        )
