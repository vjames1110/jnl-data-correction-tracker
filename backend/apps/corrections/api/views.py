from django.http import FileResponse
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import (
    parsers,
    status,
    viewsets,
)
from rest_framework.decorators import action
from rest_framework.exceptions import (
    MethodNotAllowed,
    NotFound,
    PermissionDenied,
)

from apps.authentication.models import UserRole
from apps.core.api.responses import success_response
from apps.corrections.api.permissions import (
    HasCorrectionRequestAccess,
)
from apps.corrections.api.serializers import (
    ApprovalActionSerializer,
    ApprovalAdminInterventionSerializer,
    ApprovalDelegateSerializer,
    ApprovalEscalationSerializer,
    CorrectionApprovalStepSerializer,
    CorrectionRequestAssignSerializer,
    CorrectionRequestAttachmentSerializer,
    CorrectionRequestCancelSerializer,
    CorrectionRequestCommentSerializer,
    CorrectionRequestDraftSerializer,
    CorrectionRequestHoldSerializer,
    CorrectionRequestReassignmentRequestSerializer,
    CorrectionRequestReassignSerializer,
    CorrectionRequestResolutionSerializer,
    CorrectionRequestResolveSerializer,
    CorrectionRequestSubmitSerializer,
    CorrectionRequestTimelineSerializer,
)
from apps.corrections.models import (
    ApprovalStepStatus,
    CorrectionApprovalStep,
    CorrectionRequest,
    CorrectionRequestAttachment,
    CorrectionRequestResolution,
    CorrectionRequestStatus,
    CorrectionRequestTimeline,
    CorrectionTimelineEventType,
)
from apps.corrections.services.access import (
    visible_request_queryset,
)
from apps.corrections.services.assignment import (
    assign_request,
    reassign_request,
)
from apps.corrections.services.closure import (
    run_auto_close_reminder_sweep,
    run_auto_close_sweep,
)
from apps.corrections.services.resolution import (
    resolve_work,
)
from apps.corrections.services.work import (
    accept_assignment,
    hold_work,
    request_reassignment,
    resume_work,
    start_work,
)
from apps.corrections.services.attachments import (
    create_attachment,
    delete_attachment,
    get_accessible_request_or_404,
)
from apps.corrections.services.approvals import (
    add_approval_comment,
    approve_step,
    delegate_step,
    escalate_step,
    record_sla_breaches,
    reject_step,
    return_step,
    send_approval_reminder,
)
from apps.corrections.services.drafts import (
    create_draft,
    delete_draft,
    update_draft,
)
from apps.corrections.services.cancellation import (
    cancel_request,
)
from apps.corrections.services.requester_actions import (
    add_request_comment,
    confirm_resolution,
    reopen_request,
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
        if self.action in {
            "comment",
            "confirm_resolution",
            "reopen",
            "accept",
            "start_progress",
            "resume",
        }:
            return CorrectionRequestCommentSerializer
        if self.action == "assign":
            return CorrectionRequestAssignSerializer
        if self.action == "request_reassignment":
            return (
                CorrectionRequestReassignmentRequestSerializer
            )
        if self.action == "reassign":
            return CorrectionRequestReassignSerializer
        if self.action == "hold":
            return CorrectionRequestHoldSerializer
        if self.action == "resolve":
            return CorrectionRequestResolveSerializer
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
        detail=False,
        methods=["get"],
        url_path="my-assignments",
    )
    def my_assignments(
        self,
        request,
        *args,
        **kwargs,
    ):
        queryset = self.filter_queryset(
            self.get_queryset().filter(
                current_owner=request.user
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
            message="Assignment inbox fetched successfully.",
            data=serializer.data,
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="assignment-counts",
    )
    def assignment_counts(
        self,
        request,
        *args,
        **kwargs,
    ):
        queryset = self.get_queryset().filter(
            current_owner=request.user
        )
        now = timezone.now()
        today = timezone.localdate()
        active_statuses = (
            CorrectionRequestStatus.ASSIGNED,
            CorrectionRequestStatus.ACCEPTED,
            CorrectionRequestStatus.IN_PROGRESS,
            CorrectionRequestStatus.ON_HOLD,
        )

        return success_response(
            message="Assignment counts fetched successfully.",
            data={
                "newly_assigned": queryset.filter(
                    current_status=(
                        CorrectionRequestStatus.ASSIGNED
                    ),
                ).count(),
                "accepted": queryset.filter(
                    current_status=(
                        CorrectionRequestStatus.ACCEPTED
                    ),
                ).count(),
                "in_progress": queryset.filter(
                    current_status=(
                        CorrectionRequestStatus.IN_PROGRESS
                    ),
                ).count(),
                "on_hold": queryset.filter(
                    current_status=(
                        CorrectionRequestStatus.ON_HOLD
                    ),
                ).count(),
                "overdue": queryset.filter(
                    current_status__in=active_statuses,
                    sla_deadline__isnull=False,
                    sla_deadline__lt=now,
                ).count(),
                "resolved_today": queryset.filter(
                    current_status=(
                        CorrectionRequestStatus.RESOLVED
                    ),
                    resolutions__created_at__date=(
                        today
                    ),
                ).distinct().count(),
            },
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

    @action(
        detail=True,
        methods=["post"],
        url_path="comment",
    )
    def comment(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        correction_request = add_request_comment(
            request=self.get_object(),
            user=request.user,
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
            response_type="REQUESTER_RESPONSE",
        )

        return success_response(
            message="Comment added successfully.",
            data=CorrectionRequestDraftSerializer(
                correction_request,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="confirm-resolution",
    )
    def confirm_resolution(
        self,
        request,
        *args,
        **kwargs,
    ):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        correction_request = confirm_resolution(
            request=self.get_object(),
            user=request.user,
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
        )

        return success_response(
            message="Resolution confirmed successfully.",
            data=CorrectionRequestDraftSerializer(
                correction_request,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="reopen",
    )
    def reopen(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        correction_request = reopen_request(
            request=self.get_object(),
            user=request.user,
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
        )

        return success_response(
            message="Correction request reopened successfully.",
            data=CorrectionRequestDraftSerializer(
                correction_request,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="assign",
    )
    def assign(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        assigned_request = assign_request(
            request=self.get_object(),
            responsible_person=serializer.validated_data[
                "responsible_person"
            ],
            actor=request.user,
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
        )

        return success_response(
            message="Correction request assigned successfully.",
            data=CorrectionRequestDraftSerializer(
                assigned_request,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="accept",
    )
    def accept(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        accepted_request = accept_assignment(
            request=self.get_object(),
            user=request.user,
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
        )

        return success_response(
            message="Assignment accepted successfully.",
            data=CorrectionRequestDraftSerializer(
                accepted_request,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="request-reassignment",
    )
    def request_reassignment(
        self,
        request,
        *args,
        **kwargs,
    ):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        returned_request = request_reassignment(
            request=self.get_object(),
            user=request.user,
            reason=serializer.validated_data[
                "reason"
            ],
        )

        return success_response(
            message="Reassignment requested successfully.",
            data=CorrectionRequestDraftSerializer(
                returned_request,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="start-progress",
    )
    def start_progress(
        self,
        request,
        *args,
        **kwargs,
    ):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        in_progress_request = start_work(
            request=self.get_object(),
            user=request.user,
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
        )

        return success_response(
            message="Work marked in progress successfully.",
            data=CorrectionRequestDraftSerializer(
                in_progress_request,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="hold",
    )
    def hold(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        held_request = hold_work(
            request=self.get_object(),
            user=request.user,
            reason=serializer.validated_data[
                "reason"
            ],
            expected_resume_date=serializer.validated_data.get(
                "expected_resume_date"
            ),
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
        )

        return success_response(
            message="Correction request placed on hold successfully.",
            data=CorrectionRequestDraftSerializer(
                held_request,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="resume",
    )
    def resume(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        resumed_request = resume_work(
            request=self.get_object(),
            user=request.user,
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
        )

        return success_response(
            message="Work resumed successfully.",
            data=CorrectionRequestDraftSerializer(
                resumed_request,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="reassign",
    )
    def reassign(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        reassigned_request = reassign_request(
            request=self.get_object(),
            responsible_person=serializer.validated_data[
                "responsible_person"
            ],
            actor=request.user,
            reason=serializer.validated_data[
                "reason"
            ],
        )

        return success_response(
            message="Correction request reassigned successfully.",
            data=CorrectionRequestDraftSerializer(
                reassigned_request,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="resolve",
    )
    def resolve(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        resolved_request = resolve_work(
            request=self.get_object(),
            user=request.user,
            erp_action_completed=serializer.validated_data[
                "erp_action_completed"
            ],
            completion_date=serializer.validated_data[
                "completion_date"
            ],
            erp_reference=serializer.validated_data.get(
                "erp_reference",
                "",
            ),
            access_window_start_used=serializer.validated_data.get(
                "access_window_start_used"
            ),
            access_window_end_used=serializer.validated_data.get(
                "access_window_end_used"
            ),
            actual_amount=serializer.validated_data.get(
                "actual_amount"
            ),
            actual_quantity=serializer.validated_data.get(
                "actual_quantity"
            ),
            final_comments=serializer.validated_data.get(
                "final_comments",
                "",
            ),
        )

        return success_response(
            message="Correction request resolved successfully.",
            data=CorrectionRequestDraftSerializer(
                resolved_request,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="run-auto-close",
    )
    def run_auto_close(
        self,
        request,
        *args,
        **kwargs,
    ):
        """
        Close resolved requests the requester never confirmed or
        reopened within the configured auto-close window, and send
        reminders for the ones approaching it.

        Intended to be triggered by a scheduled job (see the
        `run_auto_close` management command) or on demand by an
        admin; policy is configured through
        `CorrectionAutoCloseSettings` (Django Admin for now).
        """
        if not _is_admin_user(request.user):
            raise PermissionDenied(
                "The auto-close sweep requires admin access."
            )

        closed_summary = run_auto_close_sweep()
        reminder_summary = (
            run_auto_close_reminder_sweep()
        )

        return success_response(
            message="Auto-close sweep completed successfully.",
            data={
                "auto_close": closed_summary,
                "reminders": reminder_summary,
            },
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


class CorrectionRequestResolutionViewSet(
    viewsets.ReadOnlyModelViewSet
):
    serializer_class = (
        CorrectionRequestResolutionSerializer
    )
    permission_classes = [HasCorrectionRequestAccess]
    lookup_field = "id"
    filterset_fields = [
        "request",
        "resolved_by",
    ]
    ordering_fields = [
        "created_at",
        "completion_date",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = (
            CorrectionRequestResolution.objects.all()
            .select_related(
                "request",
                "resolved_by",
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


def _approval_step_queryset():
    return CorrectionApprovalStep.objects.select_related(
        "request",
        "request__requester",
        "request__current_owner",
        "request__site",
        "request__site__site_director",
        "request__site__site_hod",
        "request__department",
        "request__department__department_hod",
        "request__voucher_type",
        "request__erp_module",
        "request__work_type",
        "request__priority",
        "workflow_policy",
        "approver",
    )


def _is_admin_user(user) -> bool:
    return bool(
        user
        and (
            user.is_staff
            or user.has_role(
                UserRole.SUPER_ADMIN,
                UserRole.ADMIN,
            )
        )
    )


class CorrectionApprovalStepViewSet(
    viewsets.ReadOnlyModelViewSet
):
    serializer_class = CorrectionApprovalStepSerializer
    permission_classes = [HasCorrectionRequestAccess]
    parser_classes = [
        parsers.MultiPartParser,
        parsers.FormParser,
        parsers.JSONParser,
    ]
    lookup_field = "id"
    filterset_fields = [
        "request",
        "approver",
        "status",
        "is_current",
        "approver_type",
        "workflow_policy",
    ]
    ordering_fields = [
        "sequence",
        "due_at",
        "escalates_at",
        "created_at",
        "updated_at",
    ]
    ordering = ["due_at", "created_at"]

    def get_serializer_class(self):
        if self.action in {
            "approve",
            "reject",
            "return_request",
            "comment",
            "reminder",
        }:
            return ApprovalActionSerializer
        if self.action == "delegate":
            return ApprovalDelegateSerializer
        if self.action == "escalate":
            return ApprovalEscalationSerializer
        if self.action == "admin_intervention":
            return ApprovalAdminInterventionSerializer
        if self.action == "upload_attachment":
            return CorrectionRequestAttachmentSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        queryset = _approval_step_queryset()
        user = self.request.user

        if _is_admin_user(user):
            return queryset

        return queryset.filter(
            approver=user,
            request__is_deleted=False,
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="inbox",
    )
    def inbox(self, request, *args, **kwargs):
        queryset = self.filter_queryset(
            self.get_queryset().filter(
                status=ApprovalStepStatus.PENDING,
                is_current=True,
                request__current_status=(
                    CorrectionRequestStatus.PENDING_APPROVAL
                ),
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
            message="Approval inbox retrieved successfully.",
            data=serializer.data,
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="pending-counts",
    )
    def pending_counts(self, request, *args, **kwargs):
        queryset = self.get_queryset().filter(
            status=ApprovalStepStatus.PENDING,
            is_current=True,
            request__current_status=(
                CorrectionRequestStatus.PENDING_APPROVAL
            ),
        )
        now = timezone.now()
        grouped = queryset.values(
            "approver_type"
        ).annotate(count=Count("id"))

        return success_response(
            message="Approval pending counts retrieved successfully.",
            data={
                "total_pending": queryset.count(),
                "overdue": queryset.filter(
                    due_at__isnull=False,
                    due_at__lt=now,
                ).count(),
                "due_for_escalation": queryset.filter(
                    escalates_at__isnull=False,
                    escalates_at__lt=now,
                ).count(),
                "by_approver_type": {
                    item["approver_type"]: item["count"]
                    for item in grouped
                },
            },
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="approve",
    )
    def approve(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        step = approve_step(
            step=self.get_object(),
            user=request.user,
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
            allow_admin=_is_admin_user(request.user),
        )
        return success_response(
            message="Approval step approved successfully.",
            data=CorrectionApprovalStepSerializer(
                step,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
    )
    def reject(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        step = reject_step(
            step=self.get_object(),
            user=request.user,
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
            allow_admin=_is_admin_user(request.user),
        )
        return success_response(
            message="Approval step rejected successfully.",
            data=CorrectionApprovalStepSerializer(
                step,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="return",
    )
    def return_request(
        self,
        request,
        *args,
        **kwargs,
    ):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        step = return_step(
            step=self.get_object(),
            user=request.user,
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
            allow_admin=_is_admin_user(request.user),
        )
        return success_response(
            message="Approval step returned for clarification successfully.",
            data=CorrectionApprovalStepSerializer(
                step,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="delegate",
    )
    def delegate(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        step = delegate_step(
            step=self.get_object(),
            user=request.user,
            delegate_to=serializer.validated_data[
                "delegate_to"
            ],
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
            allow_admin=_is_admin_user(request.user),
        )
        return success_response(
            message="Approval step delegated successfully.",
            data=CorrectionApprovalStepSerializer(
                step,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="comment",
    )
    def comment(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        step = add_approval_comment(
            step=self.get_object(),
            user=request.user,
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
            allow_admin=_is_admin_user(request.user),
        )
        return success_response(
            message="Approval comment added successfully.",
            data=CorrectionApprovalStepSerializer(
                step,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="attachment",
    )
    def upload_attachment(
        self,
        request,
        *args,
        **kwargs,
    ):
        step = self.get_object()
        payload = request.data.copy()
        payload["request"] = step.request_id
        serializer = self.get_serializer(
            data=payload
        )
        serializer.is_valid(
            raise_exception=True
        )
        attachment = create_attachment(
            request=step.request,
            user=request.user,
            file=serializer.validated_data["file"],
            attachment_type=serializer.validated_data[
                "attachment_type"
            ],
        )
        add_approval_comment(
            step=step,
            user=request.user,
            comment="Approval attachment added.",
            allow_admin=_is_admin_user(request.user),
        )
        return success_response(
            message="Approval attachment uploaded successfully.",
            data=CorrectionRequestAttachmentSerializer(
                attachment,
                context=self.get_serializer_context(),
            ).data,
            status_code=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="history",
    )
    def history(self, request, *args, **kwargs):
        step = self.get_object()
        queryset = step.request.timeline_entries.filter(
            Q(event_type=CorrectionTimelineEventType.APPROVAL_ACTION)
            | Q(event_type=CorrectionTimelineEventType.SUBMITTED)
        ).select_related("actor")
        serializer = CorrectionRequestTimelineSerializer(
            queryset,
            many=True,
            context=self.get_serializer_context(),
        )
        return success_response(
            message="Approval history retrieved successfully.",
            data=serializer.data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="reminder",
    )
    def reminder(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        step = send_approval_reminder(
            step=self.get_object(),
            user=request.user,
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
            allow_admin=_is_admin_user(request.user),
        )
        return success_response(
            message="Approval reminder recorded successfully.",
            data=CorrectionApprovalStepSerializer(
                step,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="escalate",
    )
    def escalate(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        step = escalate_step(
            step=self.get_object(),
            user=request.user,
            backup_approver=serializer.validated_data.get(
                "backup_approver"
            ),
            comment=serializer.validated_data.get(
                "comment",
                "",
            ),
            allow_admin=_is_admin_user(request.user),
        )
        return success_response(
            message="Approval step escalated successfully.",
            data=CorrectionApprovalStepSerializer(
                step,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="admin-intervention",
    )
    def admin_intervention(
        self,
        request,
        *args,
        **kwargs,
    ):
        if not _is_admin_user(request.user):
            raise PermissionDenied(
                "Admin intervention requires admin access."
            )

        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        step = self.get_object()
        decision = serializer.validated_data["action"]
        comment = serializer.validated_data.get(
            "comment",
            "",
        )

        if decision == "APPROVE":
            step = approve_step(
                step=step,
                user=request.user,
                comment=comment,
                allow_admin=True,
            )
        elif decision == "REJECT":
            step = reject_step(
                step=step,
                user=request.user,
                comment=comment,
                allow_admin=True,
            )
        elif decision == "RETURN":
            step = return_step(
                step=step,
                user=request.user,
                comment=comment,
                allow_admin=True,
            )
        elif decision == "DELEGATE":
            step = delegate_step(
                step=step,
                user=request.user,
                delegate_to=serializer.validated_data.get(
                    "delegate_to"
                ),
                comment=comment,
                allow_admin=True,
            )
        elif decision == "REMINDER":
            step = send_approval_reminder(
                step=step,
                user=request.user,
                comment=comment,
                allow_admin=True,
            )
        elif decision == "ESCALATE":
            step = escalate_step(
                step=step,
                user=request.user,
                backup_approver=serializer.validated_data.get(
                    "backup_approver"
                ),
                comment=comment,
                allow_admin=True,
            )

        return success_response(
            message="Admin approval intervention completed successfully.",
            data=CorrectionApprovalStepSerializer(
                step,
                context=self.get_serializer_context(),
            ).data,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="record-sla-breaches",
    )
    def record_sla_breach_events(
        self,
        request,
        *args,
        **kwargs,
    ):
        if not _is_admin_user(request.user):
            raise PermissionDenied(
                "SLA breach recording requires admin access."
            )

        count = record_sla_breaches()
        return success_response(
            message="Approval SLA breach scan completed successfully.",
            data={
                "recorded_breaches": count,
            },
        )
