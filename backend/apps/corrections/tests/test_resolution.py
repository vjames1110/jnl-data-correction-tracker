from decimal import Decimal

from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)
from apps.corrections.models import (
    ApprovalApproverType,
    ApprovalWorkflowLevel,
    ApprovalWorkflowPolicy,
    CorrectionRequestResolution,
    CorrectionRequestStatus,
    CorrectionTimelineEventType,
)
from apps.corrections.services.drafts import create_draft
from apps.corrections.services.submission import (
    submit_request,
)
from apps.employees.models import EmployeeProfile
from apps.erp.models import (
    ErpModule,
    Priority,
    ReasonCategory,
    ResponsiblePersonMapping,
    VoucherType,
    WorkType,
)
from apps.notifications.models import (
    Notification,
    NotificationEventType,
)
from apps.organization.models import (
    Company,
    Department,
    Site,
)


class ResolutionApiTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.client = APIClient()
        self.requester = self._create_user(
            "RESREQ001",
            UserRole.USER,
        )
        self.director = self._create_user(
            "RESDIR001",
            UserRole.DIRECTOR,
        )
        self.person_a = self._create_user(
            "RESRP001",
            UserRole.RESPONSIBLE_PERSON,
        )
        self.person_b = self._create_user(
            "RESRP002",
            UserRole.RESPONSIBLE_PERSON,
        )
        self.company = Company.objects.create(
            company_code="JNL",
            company_name="Jhajharia Nirman Limited",
        )
        self.site = Site.objects.create(
            company=self.company,
            site_code="JPR",
            site_name="Jaipur Site",
            site_director=self.director,
        )
        self.department = Department.objects.create(
            company=self.company,
            department_name="Finance",
        )
        EmployeeProfile.objects.create(
            user=self.requester,
            employee_id=self.requester.employee_id,
            first_name=self.requester.first_name,
            role=self.requester.role,
            site=self.site,
            department=self.department,
        )
        self.module = ErpModule.objects.create(
            module_name="Finance",
        )
        self.work_type = WorkType.objects.create(
            work_type_name="Delete Voucher",
            requires_approval=True,
        )
        self.reason = ReasonCategory.objects.create(
            reason_name="Wrong Voucher",
        )
        self.priority = Priority.objects.create(
            priority_name="High",
            sla_duration_hours=8,
            escalation_duration_hours=4,
        )
        self.voucher = VoucherType.objects.create(
            voucher_name="Journal Voucher",
            erp_module=self.module,
            department=self.department,
        )
        self.policy = ApprovalWorkflowPolicy.objects.create(
            policy_name="Finance single level approval",
            site=self.site,
            department=self.department,
            erp_module=self.module,
            voucher_type=self.voucher,
            work_type=self.work_type,
            priority=self.priority,
        )
        ApprovalWorkflowLevel.objects.create(
            workflow_policy=self.policy,
            sequence=1,
            level_name="Director approval",
            approver_type=ApprovalApproverType.CUSTOM,
            custom_approver=self.director,
        )
        ResponsiblePersonMapping.objects.create(
            erp_module=self.module,
            voucher_type=self.voucher,
            department=self.department,
            site=self.site,
            work_type=self.work_type,
            priority=self.priority,
            responsible_person=self.person_a,
        )

    def test_responsible_person_can_resolve_in_progress_request(
        self,
    ):
        in_progress = self._in_progress_request(
            "JV-RES-001"
        )

        self.client.force_authenticate(
            self.person_a
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{in_progress.id}/resolve/",
            {
                "erp_action_completed": (
                    "Voucher deleted and re-entered "
                    "with corrected amount."
                ),
                "completion_date": (
                    timezone.localdate().isoformat()
                ),
                "erp_reference": "ERP-CORR-9001",
                "actual_amount": "1250.50",
                "final_comments": "Verified with accounts team.",
            },
            format="json",
        )
        in_progress.refresh_from_db()

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            in_progress.current_status,
            CorrectionRequestStatus.RESOLVED,
        )

        resolution = (
            CorrectionRequestResolution.objects.get(
                request=in_progress
            )
        )
        self.assertEqual(
            resolution.resolved_by_id,
            self.person_a.id,
        )
        self.assertEqual(
            resolution.erp_reference,
            "ERP-CORR-9001",
        )
        self.assertEqual(
            resolution.actual_amount,
            Decimal("1250.50"),
        )

        self.assertTrue(
            in_progress.timeline_entries.filter(
                event_type=(
                    CorrectionTimelineEventType.RESOLVED
                ),
                to_status=(
                    CorrectionRequestStatus.RESOLVED
                ),
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.requester,
                event_type=(
                    NotificationEventType.REQUEST_RESOLVED
                ),
                correction_request=in_progress,
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.requester,
                event_type=(
                    NotificationEventType.CONFIRMATION_PENDING
                ),
                correction_request=in_progress,
            ).exists()
        )

    def test_resolve_requires_erp_action_completed(
        self,
    ):
        in_progress = self._in_progress_request(
            "JV-RES-002"
        )

        self.client.force_authenticate(
            self.person_a
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{in_progress.id}/resolve/",
            {
                "completion_date": (
                    timezone.localdate().isoformat()
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_cannot_resolve_before_in_progress(self):
        assigned = self._assigned_request(
            "JV-RES-003"
        )

        self.client.force_authenticate(
            self.person_a
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/resolve/",
            {
                "erp_action_completed": "Done.",
                "completion_date": (
                    timezone.localdate().isoformat()
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_other_responsible_person_cannot_resolve(
        self,
    ):
        in_progress = self._in_progress_request(
            "JV-RES-004"
        )

        self.client.force_authenticate(
            self.person_b
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{in_progress.id}/resolve/",
            {
                "erp_action_completed": "Done.",
                "completion_date": (
                    timezone.localdate().isoformat()
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_completion_date_cannot_be_in_the_future(
        self,
    ):
        in_progress = self._in_progress_request(
            "JV-RES-005"
        )

        self.client.force_authenticate(
            self.person_a
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{in_progress.id}/resolve/",
            {
                "erp_action_completed": "Done.",
                "completion_date": (
                    timezone.localdate()
                    + timezone.timedelta(days=3)
                ).isoformat(),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_full_lifecycle_from_submission_to_closure(
        self,
    ):
        """
        End-to-end regression covering the whole Phase 12 engine
        together with the Phase 14 confirmation it feeds: submit,
        auto-approve, auto-assign, hold and resume, resolve, and
        finally requester confirmation to CLOSED.
        """
        draft = create_draft(
            requester=self.requester,
            data={
                "site": self.site,
                "department": self.department,
                "erp_module": self.module,
                "voucher_type": self.voucher,
                "work_type": self.work_type,
                "voucher_number": "JV-LIFECYCLE-001",
                "voucher_date": timezone.localdate(),
                "erp_email_date": timezone.localdate(),
                "description": "Full lifecycle regression.",
                "reason_category": self.reason,
                "priority": self.priority,
            },
        )
        submitted = submit_request(
            draft=draft,
            user=self.requester,
        )
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.PENDING_APPROVAL,
        )
        step = submitted.approval_steps.get(
            sequence=1
        )

        self.client.force_authenticate(
            self.director
        )
        self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/approve/",
            {"comment": "Approved."},
            format="json",
        )
        submitted.refresh_from_db()
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.ASSIGNED,
        )
        self.assertEqual(
            submitted.current_owner_id,
            self.person_a.id,
        )

        self.client.force_authenticate(
            self.person_a
        )
        self.client.post(
            f"/api/v1/corrections/requests/{submitted.id}/accept/",
        )
        self.client.post(
            f"/api/v1/corrections/requests/{submitted.id}/start-progress/",
        )
        self.client.post(
            f"/api/v1/corrections/requests/{submitted.id}/hold/",
            {
                "reason": "Waiting for ERP access window."
            },
            format="json",
        )
        submitted.refresh_from_db()
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.ON_HOLD,
        )

        self.client.post(
            f"/api/v1/corrections/requests/{submitted.id}/resume/",
        )
        resolve_response = self.client.post(
            f"/api/v1/corrections/requests/{submitted.id}/resolve/",
            {
                "erp_action_completed": (
                    "Voucher corrected in ERP."
                ),
                "completion_date": (
                    timezone.localdate().isoformat()
                ),
            },
            format="json",
        )
        submitted.refresh_from_db()
        self.assertEqual(
            resolve_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.RESOLVED,
        )

        self.client.force_authenticate(
            self.requester
        )
        confirm_response = self.client.post(
            f"/api/v1/corrections/requests/{submitted.id}/confirm-resolution/",
            {
                "comment": "Confirmed, thank you."
            },
            format="json",
        )
        submitted.refresh_from_db()

        self.assertEqual(
            confirm_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.CLOSED,
        )
        self.assertEqual(
            submitted.current_owner_id,
            self.requester.id,
        )

        recorded_events = list(
            submitted.timeline_entries.values_list(
                "event_type", flat=True
            )
        )
        for expected_event in (
            CorrectionTimelineEventType.SUBMITTED,
            CorrectionTimelineEventType.APPROVAL_ACTION,
            CorrectionTimelineEventType.ASSIGNED,
            CorrectionTimelineEventType.STATUS_CHANGED,
            CorrectionTimelineEventType.RESOLVED,
            CorrectionTimelineEventType.CLOSED,
        ):
            self.assertIn(
                expected_event, recorded_events
            )

    def _assigned_request(self, voucher_number):
        draft = create_draft(
            requester=self.requester,
            data={
                "site": self.site,
                "department": self.department,
                "erp_module": self.module,
                "voucher_type": self.voucher,
                "work_type": self.work_type,
                "voucher_number": voucher_number,
                "voucher_date": timezone.localdate(),
                "erp_email_date": timezone.localdate(),
                "description": (
                    f"Resolution test for {voucher_number}"
                ),
                "reason_category": self.reason,
                "priority": self.priority,
            },
        )
        submitted = submit_request(
            draft=draft,
            user=self.requester,
        )
        step = submitted.approval_steps.get(
            sequence=1
        )

        self.client.force_authenticate(
            self.director
        )
        self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/approve/",
            {"comment": "Approved."},
            format="json",
        )
        submitted.refresh_from_db()
        return submitted

    def _in_progress_request(self, voucher_number):
        assigned = self._assigned_request(
            voucher_number
        )

        self.client.force_authenticate(
            self.person_a
        )
        self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/accept/",
        )
        self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/start-progress/",
        )
        assigned.refresh_from_db()
        return assigned

    def _create_user(self, employee_id, role):
        return User.objects.create_user(
            employee_id=employee_id,
            password="StrongPass123!",
            first_name=employee_id,
            role=role,
            account_status=AccountStatus.ACTIVE,
        )
