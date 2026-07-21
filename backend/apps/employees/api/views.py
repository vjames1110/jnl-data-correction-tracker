import csv
import io

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import (
    MethodNotAllowed,
    ValidationError,
)
from rest_framework.parsers import (
    FormParser,
    JSONParser,
    MultiPartParser,
)

from apps.authentication.models import (
    LoginHistory,
    UserRole,
)
from apps.core.api.responses import success_response
from apps.employees.api.permissions import (
    HasEmployeeAccess,
)
from apps.employees.api.serializers import (
    EmployeeChangeRoleSerializer,
    EmployeeCreateAccountSerializer,
    EmployeeFailedRowsExportSerializer,
    EmployeeImportFileSerializer,
    EmployeeProfileSerializer,
    LoginHistorySerializer,
    UserAccountSerializer,
)
from apps.employees.models import EmployeeProfile
from apps.employees.services.accounts import (
    change_account_role,
    create_account_for_employee,
    reactivate_account,
    reset_temporary_password,
    revoke_user_sessions,
    suspend_account,
    unlock_account,
)
from apps.employees.services.imports import (
    EMPLOYEE_IMPORT_COLUMNS,
    build_csv_template,
    build_xlsx_template,
    import_employee_rows,
    preview_employee_import,
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


class EmployeeProfileViewSet(viewsets.ModelViewSet):
    queryset = EmployeeProfile.objects.all()
    serializer_class = EmployeeProfileSerializer
    permission_classes = [HasEmployeeAccess]
    parser_classes = [
        JSONParser,
        MultiPartParser,
        FormParser,
    ]
    lookup_field = "id"
    search_fields = [
        "employee_id",
        "first_name",
        "last_name",
        "email",
        "mobile",
        "erp_user_id",
        "user__employee_id",
    ]
    filterset_fields = [
        "is_active",
        "employment_status",
        "gender",
        "role",
        "site",
        "department",
        "designation",
        "user",
    ]
    ordering_fields = [
        "employee_id",
        "first_name",
        "last_name",
        "date_of_joining",
        "last_working_date",
        "created_at",
        "updated_at",
    ]
    ordering = ["employee_id"]

    def get_queryset(self):
        queryset = (
            self.queryset.select_related(
                "user",
                "site",
                "department",
                "designation",
                "reporting_manager",
            )
        )

        if not _is_admin_user(self.request.user):
            queryset = queryset.filter(
                is_active=True,
            )

        return queryset

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
                "Employee profile records retrieved successfully."
            ),
            data=serializer.data,
        )

    def retrieve(self, request, *args, **kwargs):
        return success_response(
            message=(
                "Employee profile retrieved successfully."
            ),
            data=self.get_serializer(
                self.get_object()
            ).data,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        return success_response(
            message=(
                "Employee profile created successfully."
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
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return success_response(
            message=(
                "Employee profile updated successfully."
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
                "Use deactivate account or inactive status instead."
            ),
        )

    def perform_create(self, serializer):
        try:
            serializer.save()
        except DjangoValidationError as exc:
            raise ValidationError(
                getattr(exc, "message_dict", None)
                or exc.messages
            ) from exc

    def perform_update(self, serializer):
        try:
            serializer.save()
        except DjangoValidationError as exc:
            raise ValidationError(
                getattr(exc, "message_dict", None)
                or exc.messages
            ) from exc

    @action(
        detail=False,
        methods=["get"],
        url_path="import-template",
    )
    def import_template(
        self,
        request,
        *args,
        **kwargs,
    ):
        template_format = request.query_params.get(
            "format",
            "csv",
        ).lower()

        if template_format == "xlsx":
            response = HttpResponse(
                build_xlsx_template(),
                content_type=(
                    "application/vnd.openxmlformats-officedocument."
                    "spreadsheetml.sheet"
                ),
            )
            response[
                "Content-Disposition"
            ] = (
                "attachment; filename=employee-import-template.xlsx"
            )
            return response

        if template_format != "csv":
            raise ValidationError(
                {
                    "format": [
                        "Template format must be csv or xlsx."
                    ]
                }
            )

        response = HttpResponse(
            build_csv_template(),
            content_type="text/csv",
        )
        response[
            "Content-Disposition"
        ] = (
            "attachment; filename=employee-import-template.csv"
        )
        return response

    @action(
        detail=False,
        methods=["get"],
        url_path="import-columns",
    )
    def import_columns(
        self,
        request,
        *args,
        **kwargs,
    ):
        return success_response(
            message=(
                "Employee import columns retrieved successfully."
            ),
            data={
                "columns": EMPLOYEE_IMPORT_COLUMNS,
                "required_columns": [
                    "employee_id",
                    "first_name",
                ],
            },
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="import-preview",
        serializer_class=EmployeeImportFileSerializer,
    )
    def import_preview(
        self,
        request,
        *args,
        **kwargs,
    ):
        serializer = EmployeeImportFileSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        return success_response(
            message=(
                "Employee import preview generated successfully."
            ),
            data=preview_employee_import(
                serializer.validated_data["file"]
            ),
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="import",
        url_name="import",
        serializer_class=EmployeeImportFileSerializer,
    )
    def import_file(
        self,
        request,
        *args,
        **kwargs,
    ):
        serializer = EmployeeImportFileSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        return success_response(
            message=(
                "Employee import completed successfully."
            ),
            data=import_employee_rows(
                serializer.validated_data["file"]
            ),
            status_code=status.HTTP_201_CREATED,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="failed-rows-export",
        serializer_class=EmployeeFailedRowsExportSerializer,
    )
    def failed_rows_export(
        self,
        request,
        *args,
        **kwargs,
    ):
        serializer = EmployeeFailedRowsExportSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "row_number",
                *EMPLOYEE_IMPORT_COLUMNS,
                "errors",
            ]
        )

        for failed_row in serializer.validated_data[
            "failed_rows"
        ]:
            row_data = failed_row.get("row", {})
            writer.writerow(
                [
                    failed_row.get("row_number", ""),
                    *[
                        row_data.get(column, "")
                        for column in EMPLOYEE_IMPORT_COLUMNS
                    ],
                    "; ".join(
                        failed_row.get("errors", [])
                    ),
                ]
            )

        response = HttpResponse(
            output.getvalue(),
            content_type="text/csv",
        )
        response[
            "Content-Disposition"
        ] = (
            "attachment; filename=employee-import-failed-rows.csv"
        )
        return response

    @action(
        detail=True,
        methods=["post"],
        url_path="create-account",
        serializer_class=EmployeeCreateAccountSerializer,
    )
    def create_account(
        self,
        request,
        *args,
        **kwargs,
    ):
        profile = self.get_object()
        serializer = EmployeeCreateAccountSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        result = create_account_for_employee(
            profile=profile,
            role=serializer.validated_data.get(
                "role",
                profile.role,
            ),
            send_notification=serializer.validated_data[
                "send_notification"
            ],
        )

        return success_response(
            message=(
                "Employee account created successfully."
            ),
            data={
                "user": UserAccountSerializer(
                    result["user"]
                ).data,
                "temporary_password": result[
                    "temporary_password"
                ],
                "notification": result[
                    "notification"
                ],
            },
            status_code=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="reset-temporary-password",
    )
    def reset_password(
        self,
        request,
        *args,
        **kwargs,
    ):
        user = self._get_profile_user()
        result = reset_temporary_password(user)

        return success_response(
            message=(
                "Temporary password reset successfully."
            ),
            data={
                "user": UserAccountSerializer(
                    user
                ).data,
                "temporary_password": result[
                    "temporary_password"
                ],
            },
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="unlock-account",
    )
    def unlock(self, request, *args, **kwargs):
        user = unlock_account(
            self._get_profile_user()
        )

        return success_response(
            message="Account unlocked successfully.",
            data={
                "user": UserAccountSerializer(
                    user
                ).data
            },
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="suspend-account",
    )
    def suspend(self, request, *args, **kwargs):
        user = suspend_account(
            self._get_profile_user()
        )

        return success_response(
            message="Account suspended successfully.",
            data={
                "user": UserAccountSerializer(
                    user
                ).data
            },
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="reactivate-account",
    )
    def reactivate(self, request, *args, **kwargs):
        user = reactivate_account(
            self._get_profile_user()
        )

        return success_response(
            message="Account reactivated successfully.",
            data={
                "user": UserAccountSerializer(
                    user
                ).data
            },
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="change-role",
        serializer_class=EmployeeChangeRoleSerializer,
    )
    def change_role(
        self,
        request,
        *args,
        **kwargs,
    ):
        profile = self.get_object()
        serializer = EmployeeChangeRoleSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        user = change_account_role(
            profile=profile,
            role=serializer.validated_data["role"],
        )

        return success_response(
            message="Account role changed successfully.",
            data={
                "user": UserAccountSerializer(
                    user
                ).data
            },
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="revoke-sessions",
    )
    def revoke_sessions(
        self,
        request,
        *args,
        **kwargs,
    ):
        user = self._get_profile_user()
        revoked_count = revoke_user_sessions(user)

        return success_response(
            message="Account sessions revoked successfully.",
            data={
                "user": UserAccountSerializer(
                    user
                ).data,
                "revoked_sessions": revoked_count,
            },
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="login-history",
    )
    def login_history(
        self,
        request,
        *args,
        **kwargs,
    ):
        user = self._get_profile_user()
        history = LoginHistory.objects.filter(
            user=user
        ).order_by("-created_at")[:50]

        return success_response(
            message="Login history retrieved successfully.",
            data=LoginHistorySerializer(
                history,
                many=True,
            ).data,
        )

    def _get_profile_user(self):
        profile = self.get_object()

        if not profile.user_id:
            raise ValidationError(
                {
                    "user": [
                        "Employee does not have a user account."
                    ]
                }
            )

        return profile.user
