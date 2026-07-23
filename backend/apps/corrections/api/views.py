from django.http import FileResponse
from rest_framework import (
    parsers,
    status,
    viewsets,
)
from rest_framework.decorators import action
from rest_framework.exceptions import (
    MethodNotAllowed,
    NotFound,
)

from apps.core.api.responses import success_response
from apps.corrections.api.permissions import (
    HasCorrectionRequestAccess,
)
from apps.corrections.api.serializers import (
    CorrectionRequestAttachmentSerializer,
    CorrectionRequestCancelSerializer,
    CorrectionRequestDraftSerializer,
    CorrectionRequestSubmitSerializer,
    CorrectionRequestTimelineSerializer,
)
from apps.corrections.models import (
    CorrectionRequest,
    CorrectionRequestAttachment,
    CorrectionRequestStatus,
    CorrectionRequestTimeline,
)
from apps.corrections.services.access import (
    visible_request_queryset,
)
from apps.corrections.services.attachments import (
    create_attachment,
    delete_attachment,
    get_accessible_request_or_404,
)
from apps.corrections.services.drafts import (
    create_draft,
    delete_draft,
    update_draft,
)
from apps.corrections.services.cancellation import (
    cancel_request,
)
from apps.corrections.services.submission import (
    preview_duplicates,
    submit_request,
)


def _request_queryset():
    return CorrectionRequest.objects.select_related(
        "requester",
        "current_owner",
        "site",
        "department",
        "voucher_type",
        "erp_module",
        "work_type",
        "reason_category",
        "priority",
    )


class CorrectionRequestDraftViewSet(
    viewsets.ModelViewSet
):
    serializer_class = CorrectionRequestDraftSerializer
    permission_classes = [HasCorrectionRequestAccess]
    lookup_field = "id"
    http_method_names = [
        "get",
        "post",
        "patch",
        "delete",
        "head",
        "options",
    ]
    search_fields = [
        "reference",
        "voucher_number",
        "description",
        "site__site_code",
        "site__site_name",
        "department__department_code",
        "department__department_name",
        "erp_module__module_code",
        "erp_module__module_name",
        "voucher_type__voucher_code",
        "voucher_type__voucher_name",
    ]
    filterset_fields = [
        "site",
        "department",
        "erp_module",
        "voucher_type",
        "work_type",
        "reason_category",
        "priority",
    ]
    ordering_fields = [
        "reference",
        "voucher_date",
        "created_at",
        "updated_at",
    ]
    ordering = ["-updated_at"]

    def get_serializer_class(self):
        if self.action == "submit":
            return CorrectionRequestSubmitSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        return (
            _request_queryset().filter(
                requester=self.request.user,
                current_status=CorrectionRequestStatus.DRAFT,
                is_deleted=False,
            )
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        draft = create_draft(
            requester=request.user,
            data=serializer.validated_data,
        )

        return success_response(
            message="Draft correction request created successfully.",
            data=self.get_serializer(draft).data,
            status_code=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        raise MethodNotAllowed(
            "PUT",
            detail="Use PATCH to update a draft.",
        )

    def partial_update(
        self,
        request,
        *args,
        **kwargs,
    ):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(
            raise_exception=True
        )
        draft = update_draft(
            draft=instance,
            user=request.user,
            data=serializer.validated_data,
        )

        return success_response(
            message="Draft correction request updated successfully.",
            data=self.get_serializer(draft).data,
        )

    def destroy(self, request, *args, **kwargs):
        draft = delete_draft(
            draft=self.get_object(),
            user=request.user,
        )

        return success_response(
            message="Draft correction request deleted successfully.",
            data=self.get_serializer(draft).data,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="duplicates",
    )
    def duplicates(self, request, *args, **kwargs):
        duplicates = preview_duplicates(
            draft=self.get_object(),
            user=request.user,
        )

        return success_response(
            message="Duplicate check completed successfully.",
            data=duplicates,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="submit",
    )
    def submit(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        submitted_request = submit_request(
            draft=self.get_object(),
            user=request.user,
            override_duplicates=serializer.validated_data.get(
                "override_duplicates",
                False,
            ),
            duplicate_override_reason=serializer.validated_data.get(
                "duplicate_override_reason",
                "",
            ),
        )

        return success_response(
            message="Correction request submitted successfully.",
            data=CorrectionRequestDraftSerializer(
                submitted_request,
                context=self.get_serializer_context(),
            ).data,
        )


class CorrectionRequestViewSet(viewsets.ModelViewSet):
    serializer_class = CorrectionRequestDraftSerializer
    permission_classes = [HasCorrectionRequestAccess]
    lookup_field = "id"
    http_method_names = [
        "get",
        "post",
        "patch",
        "head",
        "options",
    ]
    search_fields = [
        "reference",
        "voucher_number",
        "description",
        "requester__employee_id",
        "requester__first_name",
        "requester__last_name",
        "current_owner__employee_id",
        "site__site_code",
        "site__site_name",
        "department__department_code",
        "department__department_name",
        "erp_module__module_code",
        "erp_module__module_name",
        "voucher_type__voucher_code",
        "voucher_type__voucher_name",
        "work_type__work_type_code",
        "work_type__work_type_name",
        "reason_category__reason_code",
        "reason_category__reason_name",
        "priority__priority_code",
        "priority__priority_name",
    ]
    filterset_fields = [
        "requester",
        "current_owner",
        "current_status",
        "site",
        "department",
        "erp_module",
        "voucher_type",
        "work_type",
        "reason_category",
        "priority",
    ]
    ordering_fields = [
        "reference",
        "voucher_date",
        "submitted_at",
        "sla_deadline",
        "created_at",
        "updated_at",
    ]
    ordering = ["-updated_at"]

    def get_serializer_class(self):
        if self.action == "submit":
            return CorrectionRequestSubmitSerializer
        if self.action == "cancel":
            return CorrectionRequestCancelSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        return _request_queryset().filter(
            pk__in=visible_request_queryset(
                self.request.user
            ).values("pk")
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        draft = create_draft(
            requester=request.user,
            data=serializer.validated_data,
        )

        return success_response(
            message="Correction request draft created successfully.",
            data=self.get_serializer(draft).data,
            status_code=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        raise MethodNotAllowed(
            "PUT",
            detail="Use PATCH to update a draft.",
        )

    def partial_update(
        self,
        request,
        *args,
        **kwargs,
    ):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(
            raise_exception=True
        )
        draft = update_draft(
            draft=instance,
            user=request.user,
            data=serializer.validated_data,
        )

        return success_response(
            message="Correction request draft updated successfully.",
            data=self.get_serializer(draft).data,
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="my",
    )
    def my(self, request, *args, **kwargs):
        queryset = self.filter_queryset(
            self.get_queryset().filter(
                requester=request.user
            )
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
            message="My correction requests fetched successfully.",
            data=serializer.data,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="duplicates",
    )
    def duplicates(self, request, *args, **kwargs):
        duplicates = preview_duplicates(
            draft=self.get_object(),
            user=request.user,
        )

        return success_response(
            message="Duplicate check completed successfully.",
            data=duplicates,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="submit",
    )
    def submit(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        submitted_request = submit_request(
            draft=self.get_object(),
            user=request.user,
            override_duplicates=serializer.validated_data.get(
                "override_duplicates",
                False,
            ),
            duplicate_override_reason=serializer.validated_data.get(
                "duplicate_override_reason",
                "",
            ),
        )

        return success_response(
            message="Correction request submitted successfully.",
            data=CorrectionRequestDraftSerializer(
                submitted_request,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
    )
    def cancel(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        cancelled_request = cancel_request(
            request=self.get_object(),
            user=request.user,
            reason=serializer.validated_data.get(
                "reason",
                "",
            ),
        )

        return success_response(
            message="Correction request cancelled successfully.",
            data=CorrectionRequestDraftSerializer(
                cancelled_request,
                context=self.get_serializer_context(),
            ).data,
        )


class CorrectionRequestAttachmentViewSet(
    viewsets.ModelViewSet
):
    serializer_class = CorrectionRequestAttachmentSerializer
    permission_classes = [HasCorrectionRequestAccess]
    parser_classes = [
        parsers.MultiPartParser,
        parsers.FormParser,
        parsers.JSONParser,
    ]
    lookup_field = "id"
    http_method_names = [
        "get",
        "post",
        "delete",
        "head",
        "options",
    ]
    filterset_fields = [
        "request",
        "attachment_type",
    ]
    ordering_fields = [
        "created_at",
        "original_name",
        "size_bytes",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = (
            CorrectionRequestAttachment.objects.filter(
                is_deleted=False,
            )
            .select_related(
                "request",
                "uploaded_by",
            )
        )

        queryset = queryset.filter(
            request_id__in=visible_request_queryset(
                self.request.user
            ).values("pk")
        )

        request_id = self.request.query_params.get(
            "request"
        )
        if request_id:
            queryset = queryset.filter(
                request_id=request_id
            )

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        correction_request = get_accessible_request_or_404(
            request_id=serializer.validated_data["request"].id,
            user=request.user,
        )
        attachment = create_attachment(
            request=correction_request,
            user=request.user,
            file=serializer.validated_data["file"],
            attachment_type=serializer.validated_data[
                "attachment_type"
            ],
        )

        return success_response(
            message="Attachment uploaded successfully.",
            data=self.get_serializer(attachment).data,
            status_code=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        attachment = delete_attachment(
            attachment=self.get_object(),
            user=request.user,
        )

        return success_response(
            message="Attachment deleted successfully.",
            data=self.get_serializer(attachment).data,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="download",
    )
    def download(self, request, *args, **kwargs):
        attachment = self.get_object()

        if not attachment.file:
            raise NotFound(
                "Attachment file was not found."
            )

        try:
            file_handle = attachment.file.open("rb")
        except FileNotFoundError as exc:
            raise NotFound(
                "Attachment file was not found."
            ) from exc

        return FileResponse(
            file_handle,
            as_attachment=True,
            filename=attachment.original_name,
            content_type=(
                attachment.content_type
                or "application/octet-stream"
            ),
        )


class CorrectionRequestTimelineViewSet(
    viewsets.ReadOnlyModelViewSet
):
    serializer_class = CorrectionRequestTimelineSerializer
    permission_classes = [HasCorrectionRequestAccess]
    lookup_field = "id"
    filterset_fields = [
        "request",
        "event_type",
        "actor",
    ]
    ordering_fields = [
        "created_at",
        "event_type",
    ]
    ordering = ["created_at"]

    def get_queryset(self):
        queryset = (
            CorrectionRequestTimeline.objects.all()
            .select_related(
                "request",
                "actor",
            )
        )

        queryset = queryset.filter(
            request_id__in=visible_request_queryset(
                self.request.user
            ).values("pk")
        )

        request_id = self.request.query_params.get(
            "request"
        )
        if request_id:
            queryset = queryset.filter(
                request_id=request_id
            )

        return queryset
