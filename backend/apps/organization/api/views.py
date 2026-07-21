from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import (
    MethodNotAllowed,
    ValidationError,
)
from rest_framework.views import APIView
from drf_spectacular.utils import (
    OpenApiResponse,
    OpenApiTypes,
    extend_schema,
)

from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)
from apps.core.api.responses import success_response
from apps.organization.api.permissions import (
    HasOrganizationAccess,
)
from apps.organization.api.serializers import (
    CompanySerializer,
    DepartmentSerializer,
    DesignationSerializer,
    DirectorMappingSerializer,
    ReportingManagerMappingSerializer,
    SiteDepartmentMappingSerializer,
    SiteSerializer,
    UserDropdownSerializer,
)
from apps.organization.models import (
    Company,
    Department,
    Designation,
    DirectorMapping,
    ReportingManagerMapping,
    Site,
    SiteDepartmentMapping,
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


class OrganizationModelViewSet(viewsets.ModelViewSet):
    permission_classes = [
        HasOrganizationAccess,
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
    dropdown_code_field = ""
    dropdown_label_field = ""
    super_admin_only_writes = False

    def get_queryset(self):
        queryset = self.queryset

        if self.select_related_fields:
            queryset = queryset.select_related(
                *self.select_related_fields
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
            code_value = getattr(
                item,
                self.dropdown_code_field,
                "",
            )
            label_value = getattr(
                item,
                self.dropdown_label_field,
                str(item),
            )

            data.append(
                {
                    "id": str(item.id),
                    "code": str(code_value),
                    "label": str(label_value),
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


class CompanyViewSet(OrganizationModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    search_fields = [
        "company_code",
        "company_name",
        "registered_name",
        "contact_person",
        "contact_email",
        "contact_phone",
    ]
    filterset_fields = [
        "is_active",
        "time_zone",
    ]
    ordering_fields = [
        "company_code",
        "company_name",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "company_name",
    ]
    dropdown_code_field = "company_code"
    dropdown_label_field = "company_name"
    super_admin_only_writes = True


class SiteViewSet(OrganizationModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer
    select_related_fields = (
        "company",
        "site_director",
        "site_hod",
    )
    search_fields = [
        "site_code",
        "site_name",
        "project_name",
        "state",
        "district",
        "cost_centre",
        "erp_site_code",
    ]
    filterset_fields = [
        "company",
        "state",
        "district",
        "is_active",
        "site_director",
        "site_hod",
    ]
    ordering_fields = [
        "site_code",
        "site_name",
        "state",
        "district",
        "start_date",
        "end_date",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "site_name",
    ]
    dropdown_code_field = "site_code"
    dropdown_label_field = "site_name"


class DepartmentViewSet(OrganizationModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    select_related_fields = (
        "company",
        "department_hod",
    )
    search_fields = [
        "department_code",
        "department_name",
        "description",
    ]
    filterset_fields = [
        "company",
        "is_active",
        "department_hod",
    ]
    ordering_fields = [
        "department_code",
        "department_name",
        "display_order",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "display_order",
        "department_name",
    ]
    dropdown_code_field = "department_code"
    dropdown_label_field = "department_name"


class DesignationViewSet(OrganizationModelViewSet):
    queryset = Designation.objects.all()
    serializer_class = DesignationSerializer
    search_fields = [
        "designation_code",
        "designation_name",
    ]
    filterset_fields = [
        "level",
        "is_active",
    ]
    ordering_fields = [
        "designation_code",
        "designation_name",
        "level",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "level",
        "designation_name",
    ]
    dropdown_code_field = "designation_code"
    dropdown_label_field = "designation_name"


class SiteDepartmentMappingViewSet(
    OrganizationModelViewSet
):
    queryset = SiteDepartmentMapping.objects.all()
    serializer_class = SiteDepartmentMappingSerializer
    select_related_fields = (
        "site",
        "site__company",
        "department",
        "department__company",
        "site_hod",
        "department_hod",
    )
    search_fields = [
        "site__site_code",
        "site__site_name",
        "department__department_code",
        "department__department_name",
        "site_hod__employee_id",
        "department_hod__employee_id",
    ]
    filterset_fields = [
        "site",
        "site__company",
        "department",
        "is_active",
        "site_hod",
        "department_hod",
    ]
    ordering_fields = [
        "effective_date",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "site__site_name",
        "department__department_name",
    ]
    dropdown_code_field = "id"
    dropdown_label_field = "department"


class DirectorMappingViewSet(OrganizationModelViewSet):
    queryset = DirectorMapping.objects.all()
    serializer_class = DirectorMappingSerializer
    select_related_fields = (
        "director",
        "site",
        "site__company",
        "department",
        "department__company",
    )
    search_fields = [
        "director__employee_id",
        "director__first_name",
        "director__last_name",
        "site__site_code",
        "site__site_name",
        "department__department_code",
        "department__department_name",
    ]
    filterset_fields = [
        "director",
        "site",
        "site__company",
        "department",
        "authority_type",
        "is_active",
    ]
    ordering_fields = [
        "effective_from",
        "effective_to",
        "authority_type",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "director__employee_id",
        "-effective_from",
    ]
    dropdown_code_field = "authority_type"
    dropdown_label_field = "director"


class ReportingManagerMappingViewSet(
    OrganizationModelViewSet
):
    queryset = ReportingManagerMapping.objects.all()
    serializer_class = ReportingManagerMappingSerializer
    select_related_fields = (
        "employee",
        "reporting_manager",
        "site",
        "site__company",
        "department",
        "department__company",
    )
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
    filterset_fields = [
        "employee",
        "reporting_manager",
        "site",
        "site__company",
        "department",
        "is_active",
    ]
    ordering_fields = [
        "effective_from",
        "effective_to",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "employee__employee_id",
        "-effective_from",
    ]
    dropdown_code_field = "id"
    dropdown_label_field = "employee"


class OrganizationHierarchyAPIView(APIView):
    permission_classes = [
        HasOrganizationAccess,
    ]

    @extend_schema(
        tags=["Organization"],
        summary="Retrieve organization hierarchy",
        responses={
            200: OpenApiResponse(
                response=OpenApiTypes.OBJECT,
                description=(
                    "Organization hierarchy retrieved."
                ),
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description=(
                    "Organization access required."
                )
            ),
        },
    )
    def get(self, request):
        active_only = not _is_admin_user(
            request.user
        )

        companies = Company.objects.all().order_by(
            "company_name"
        )

        if active_only:
            companies = companies.filter(
                is_active=True
            )

        tree = []

        for company in companies:
            sites = Site.objects.filter(
                company=company
            ).order_by("site_name")
            departments = Department.objects.filter(
                company=company
            ).order_by(
                "display_order",
                "department_name",
            )

            if active_only:
                sites = sites.filter(is_active=True)
                departments = departments.filter(
                    is_active=True
                )

            department_nodes = []
            for department in departments:
                designations = (
                    Designation.objects.all().order_by(
                        "level",
                        "designation_name",
                    )
                )
                if active_only:
                    designations = designations.filter(
                        is_active=True
                    )

                department_nodes.append(
                    {
                        "id": str(department.id),
                        "code": department.department_code,
                        "name": department.department_name,
                        "is_active": department.is_active,
                        "designations": [
                            {
                                "id": str(designation.id),
                                "code": (
                                    designation.designation_code
                                ),
                                "name": (
                                    designation.designation_name
                                ),
                                "level": designation.level,
                                "is_active": (
                                    designation.is_active
                                ),
                            }
                            for designation in designations
                        ],
                    }
                )

            site_nodes = []
            for site in sites:
                mappings = (
                    SiteDepartmentMapping.objects.filter(
                        site=site
                    )
                    .select_related("department")
                    .order_by(
                        "department__department_name"
                    )
                )
                if active_only:
                    mappings = mappings.filter(
                        is_active=True,
                        department__is_active=True,
                    )

                site_nodes.append(
                    {
                        "id": str(site.id),
                        "code": site.site_code,
                        "name": site.site_name,
                        "is_active": site.is_active,
                        "departments": [
                            {
                                "id": str(
                                    mapping.department.id
                                ),
                                "code": (
                                    mapping.department
                                    .department_code
                                ),
                                "name": (
                                    mapping.department
                                    .department_name
                                ),
                                "mapping_id": str(mapping.id),
                                "is_active": mapping.is_active,
                            }
                            for mapping in mappings
                        ],
                    }
                )

            tree.append(
                {
                    "id": str(company.id),
                    "code": company.company_code,
                    "name": company.company_name,
                    "is_active": company.is_active,
                    "sites": site_nodes,
                    "departments": department_nodes,
                }
            )

        return success_response(
            message=(
                "Organization hierarchy retrieved "
                "successfully."
            ),
            data=tree,
        )


class OrganizationUserDropdownAPIView(APIView):
    permission_classes = [
        HasOrganizationAccess,
    ]

    @extend_schema(
        tags=["Organization"],
        summary="Retrieve organization user dropdown",
        responses={
            200: OpenApiResponse(
                response=OpenApiTypes.OBJECT,
                description=(
                    "Organization users retrieved."
                ),
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description=(
                    "Organization access required."
                )
            ),
        },
    )
    def get(self, request):
        users = (
            User.objects.filter(
                is_active=True,
                account_status=AccountStatus.ACTIVE,
            )
            .order_by(
                "employee_id",
                "first_name",
            )
        )

        return success_response(
            message=(
                "Organization user dropdown "
                "retrieved successfully."
            ),
            data=UserDropdownSerializer(
                users,
                many=True,
            ).data,
        )
