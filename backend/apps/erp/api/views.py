from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import (
    MethodNotAllowed,
    ValidationError,
)

from apps.authentication.models import UserRole
from apps.core.api.responses import success_response
from apps.erp.api.permissions import HasErpMasterAccess
from apps.erp.api.serializers import (
    ErpModuleSerializer,
    PrioritySerializer,
    ReasonCategorySerializer,
    ResponsiblePersonMappingSerializer,
    RequestFieldConfigurationSerializer,
    VoucherTypeSerializer,
    WorkTypeSerializer,
)
from apps.erp.models import (
    ErpModule,
    Priority,
    ReasonCategory,
    ResponsiblePersonMapping,
    RequestFieldConfiguration,
    VoucherType,
    WorkType,
)


def _is_admin_user(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and user.role
        in {
            UserRole.SUPER_ADMIN,
            UserRole.ADMIN,
        }
    )


class ErpMasterViewSet(viewsets.ModelViewSet):
    permission_classes = [
        HasErpMasterAccess,
    ]
    lookup_field = "id"
    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
    ]
    select_related_fields: tuple[str, ...] = ()
    prefetch_related_fields: tuple[str, ...] = ()
    dropdown_code_field = ""
    dropdown_label_field = ""

    def get_queryset(self):
        queryset = self.queryset

        if self.select_related_fields:
            queryset = queryset.select_related(
                *self.select_related_fields
            )

        if self.prefetch_related_fields:
            queryset = queryset.prefetch_related(
                *self.prefetch_related_fields
            )

        if not _is_admin_user(self.request.user):
            queryset = queryset.filter(
                is_active=True,
            )

        return queryset

    def _message_prefix(self) -> str:
        return self.queryset.model._meta.verbose_name

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(
            self.get_queryset()
        )

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(
                page,
                many=True,
            )
            return self.get_paginated_response(
                serializer.data
            )

        serializer = self.get_serializer(
            queryset,
            many=True,
        )
        return success_response(
            message=(
                f"{self._message_prefix()} records "
                "retrieved successfully."
            ),
            data=serializer.data,
        )

    def retrieve(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            self.get_object()
        )
        return success_response(
            message=(
                f"{self._message_prefix()} retrieved "
                "successfully."
            ),
            data=serializer.data,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        self.perform_create(serializer)

        return success_response(
            message=(
                f"{self._message_prefix()} created "
                "successfully."
            ),
            data=serializer.data,
            status_code=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop(
            "partial",
            False,
        )
        serializer = self.get_serializer(
            self.get_object(),
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(
            raise_exception=True
        )
        self.perform_update(serializer)

        return success_response(
            message=(
                f"{self._message_prefix()} updated "
                "successfully."
            ),
            data=serializer.data,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(
            request,
            *args,
            **kwargs,
        )

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed(
            "DELETE",
            detail=(
                "Use the deactivate action instead."
            ),
        )

    def _set_active_state(self, instance, is_active):
        instance.is_active = is_active

        try:
            instance.save(
                update_fields=[
                    "is_active",
                    "updated_at",
                ]
            )
        except DjangoValidationError as exc:
            raise ValidationError(
                getattr(exc, "message_dict", None)
                or exc.messages
            ) from exc

        return instance

    @action(
        detail=True,
        methods=["post"],
    )
    def activate(self, request, *args, **kwargs):
        instance = self._set_active_state(
            self.get_object(),
            True,
        )
        return success_response(
            message=(
                f"{self._message_prefix()} activated "
                "successfully."
            ),
            data=self.get_serializer(instance).data,
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def deactivate(self, request, *args, **kwargs):
        instance = self._set_active_state(
            self.get_object(),
            False,
        )
        return success_response(
            message=(
                f"{self._message_prefix()} deactivated "
                "successfully."
            ),
            data=self.get_serializer(instance).data,
        )

    @action(
        detail=False,
        methods=["get"],
    )
    def dropdown(self, request, *args, **kwargs):
        queryset = self.filter_queryset(
            self.get_queryset()
        )
        data = []

        for item in queryset:
            data.append(
                {
                    "id": str(item.id),
                    "code": str(
                        getattr(
                            item,
                            self.dropdown_code_field,
                            "",
                        )
                    ),
                    "label": str(
                        getattr(
                            item,
                            self.dropdown_label_field,
                            str(item),
                        )
                    ),
                    "is_active": item.is_active,
                }
            )

        return success_response(
            message=(
                f"{self._message_prefix()} dropdown "
                "retrieved successfully."
            ),
            data=data,
        )

    @action(
        detail=False,
        methods=["get"],
    )
    def export(self, request, *args, **kwargs):
        queryset = self.filter_queryset(
            self.get_queryset()
        )
        serializer = self.get_serializer(
            queryset,
            many=True,
        )

        return success_response(
            message=(
                f"{self._message_prefix()} export "
                "retrieved successfully."
            ),
            data=serializer.data,
        )


class ErpModuleViewSet(ErpMasterViewSet):
    queryset = ErpModule.objects.all()
    serializer_class = ErpModuleSerializer
    prefetch_related_fields = (
        "departments",
    )
    search_fields = [
        "module_code",
        "module_name",
        "description",
        "departments__department_code",
        "departments__department_name",
    ]
    filterset_fields = [
        "departments",
        "is_active",
    ]
    ordering_fields = [
        "module_code",
        "module_name",
        "display_order",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "display_order",
        "module_name",
    ]
    dropdown_code_field = "module_code"
    dropdown_label_field = "module_name"

    def filter_queryset(self, queryset):
        return super().filter_queryset(queryset).distinct()


class VoucherTypeViewSet(ErpMasterViewSet):
    queryset = VoucherType.objects.all()
    serializer_class = VoucherTypeSerializer
    select_related_fields = (
        "erp_module",
        "department",
        "department__company",
    )
    search_fields = [
        "voucher_code",
        "voucher_name",
        "erp_module__module_code",
        "erp_module__module_name",
        "department__department_code",
        "department__department_name",
    ]
    filterset_fields = [
        "erp_module",
        "department",
        "requires_voucher_number",
        "requires_voucher_date",
        "requires_amount",
        "requires_quantity",
        "is_active",
    ]
    ordering_fields = [
        "voucher_code",
        "voucher_name",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "erp_module__module_name",
        "voucher_name",
    ]
    dropdown_code_field = "voucher_code"
    dropdown_label_field = "voucher_name"


class WorkTypeViewSet(ErpMasterViewSet):
    queryset = WorkType.objects.all()
    serializer_class = WorkTypeSerializer
    search_fields = [
        "work_type_code",
        "work_type_name",
        "description",
    ]
    filterset_fields = [
        "requires_approval",
        "is_active",
    ]
    ordering_fields = [
        "work_type_code",
        "work_type_name",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "work_type_name",
    ]
    dropdown_code_field = "work_type_code"
    dropdown_label_field = "work_type_name"


class ReasonCategoryViewSet(ErpMasterViewSet):
    queryset = ReasonCategory.objects.all()
    serializer_class = ReasonCategorySerializer
    prefetch_related_fields = (
        "voucher_types",
    )
    search_fields = [
        "reason_code",
        "reason_name",
        "description",
    ]
    filterset_fields = [
        "is_active",
    ]
    ordering_fields = [
        "reason_code",
        "reason_name",
        "display_order",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "display_order",
        "reason_name",
    ]
    dropdown_code_field = "reason_code"
    dropdown_label_field = "reason_name"


class PriorityViewSet(ErpMasterViewSet):
    queryset = Priority.objects.all()
    serializer_class = PrioritySerializer
    search_fields = [
        "priority_code",
        "priority_name",
    ]
    filterset_fields = [
        "is_active",
    ]
    ordering_fields = [
        "priority_code",
        "priority_name",
        "display_order",
        "sla_duration_hours",
        "escalation_duration_hours",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "display_order",
        "priority_name",
    ]
    dropdown_code_field = "priority_code"
    dropdown_label_field = "priority_name"


class ResponsiblePersonMappingViewSet(
    ErpMasterViewSet
):
    queryset = ResponsiblePersonMapping.objects.all()
    serializer_class = ResponsiblePersonMappingSerializer
    select_related_fields = (
        "erp_module",
        "voucher_type",
        "department",
        "department__company",
        "site",
        "site__company",
        "work_type",
        "priority",
        "responsible_person",
    )
    search_fields = [
        "erp_module__module_code",
        "erp_module__module_name",
        "voucher_type__voucher_code",
        "voucher_type__voucher_name",
        "department__department_code",
        "department__department_name",
        "site__site_code",
        "site__site_name",
        "work_type__work_type_code",
        "work_type__work_type_name",
        "priority__priority_code",
        "priority__priority_name",
        "responsible_person__employee_id",
        "responsible_person__first_name",
        "responsible_person__last_name",
    ]
    filterset_fields = [
        "erp_module",
        "voucher_type",
        "department",
        "site",
        "work_type",
        "priority",
        "responsible_person",
        "is_active",
    ]
    ordering_fields = [
        "display_order",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "display_order",
        "erp_module__module_name",
        "responsible_person__employee_id",
    ]
    dropdown_code_field = "id"
    dropdown_label_field = "responsible_person"


class RequestFieldConfigurationViewSet(
    ErpMasterViewSet
):
    queryset = RequestFieldConfiguration.objects.all()
    serializer_class = RequestFieldConfigurationSerializer
    select_related_fields = (
        "erp_module",
        "voucher_type",
        "work_type",
        "priority",
    )
    search_fields = [
        "field_key",
        "field_label",
        "help_text",
        "erp_module__module_code",
        "erp_module__module_name",
        "voucher_type__voucher_code",
        "voucher_type__voucher_name",
        "work_type__work_type_code",
        "work_type__work_type_name",
        "priority__priority_code",
        "priority__priority_name",
    ]
    filterset_fields = [
        "field_key",
        "field_state",
        "erp_module",
        "voucher_type",
        "work_type",
        "priority",
        "is_active",
    ]
    ordering_fields = [
        "field_key",
        "field_label",
        "field_state",
        "display_order",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "display_order",
        "field_label",
    ]
    dropdown_code_field = "field_key"
    dropdown_label_field = "field_label"
