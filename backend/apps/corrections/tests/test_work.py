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
    CorrectionRequestStatus,
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


class WorkStatusApiTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.client = APIClient()
        self.requester = self._create_user(
            "WRKREQ001",
            UserRole.USER,
        )
        self.director = self._create_user(
            "WRKDIR001",
            UserRole.DIRECTOR,
        )
        self.person_a = self._create_user(
            "WRKRP001",
            UserRole.RESPONSIBLE_PERSON,
        )
        self.person_b = self._create_user(
            "WRKRP002",
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

    def test_responsible_person_can_accept_assignment(
        self,
    ):
        assigned = self._assigned_request(
            "JV-WORK-001"
        )

        self.client.force_authenticate(
            self.person_a
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/accept/",
            {"comment": "Looking into this."},
            format="json",
        )
        assigned.refresh_from_db()

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            assigned.current_status,
            CorrectionRequestStatus.ACCEPTED,
        )
        timeline_entry = (
            assigned.timeline_entries.get(
                metadata__action="ACCEPT",
            )
        )
        self.assertEqual(
            timeline_entry.comment,
            "Looking into this.",
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.requester,
                event_type=(
                    NotificationEventType.ASSIGNMENT_ACCEPTED
                ),
                correction_request=assigned,
            ).exists()
        )

    def test_other_responsible_person_cannot_accept(
        self,
    ):
        # A responsible person who is not the assigned owner has no
        # visibility into the request at all, so the object lookup
        # itself resolves to a 404 before any action is attempted.
        assigned = self._assigned_request(
            "JV-WORK-002"
        )

        self.client.force_authenticate(
            self.person_b
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/accept/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_cannot_accept_twice(self):
        assigned = self._assigned_request(
            "JV-WORK-003"
        )

        self.client.force_authenticate(
            self.person_a
        )
        self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/accept/",
        )
        second_response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/accept/",
        )

        self.assertEqual(
            second_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_responsible_person_can_request_reassignment(
        self,
    ):
        assigned = self._assigned_request(
            "JV-WORK-004"
        )

        self.client.force_authenticate(
            self.person_a
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/request-reassignment/",
            {
                "reason": (
                    "I am on leave this week."
                )
            },
            format="json",
        )
        assigned.refresh_from_db()

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            assigned.current_status,
            CorrectionRequestStatus.APPROVED,
        )
        self.assertEqual(
            assigned.current_owner_id,
            self.requester.id,
        )
        self.assertTrue(
            assigned.timeline_entries.filter(
                metadata__action=(
                    "REASSIGNMENT_REQUESTED"
                ),
            ).exists()
        )

    def test_request_reassignment_requires_reason(
        self,
    ):
        assigned = self._assigned_request(
            "JV-WORK-005"
        )

        self.client.force_authenticate(
            self.person_a
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/request-reassignment/",
            {"reason": "   "},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_full_work_progress_flow(self):
        assigned = self._assigned_request(
            "JV-WORK-006"
        )
        self.client.force_authenticate(
            self.person_a
        )

        self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/accept/",
        )
        start_response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/start-progress/",
        )
        assigned.refresh_from_db()
        self.assertEqual(
            start_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            assigned.current_status,
            CorrectionRequestStatus.IN_PROGRESS,
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.requester,
                event_type=(
                    NotificationEventType.WORK_IN_PROGRESS
                ),
                correction_request=assigned,
            ).exists()
        )

        hold_response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/hold/",
            {
                "reason": "Waiting for ERP access window.",
                "expected_resume_date": (
                    timezone.localdate()
                    + timezone.timedelta(days=2)
                ).isoformat(),
            },
            format="json",
        )
        assigned.refresh_from_db()
        self.assertEqual(
            hold_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            assigned.current_status,
            CorrectionRequestStatus.ON_HOLD,
        )
        hold_entry = (
            assigned.timeline_entries.get(
                metadata__action="HOLD",
            )
        )
        self.assertEqual(
            hold_entry.metadata["reason"],
            "Waiting for ERP access window.",
        )
        self.assertTrue(
            hold_entry.metadata[
                "expected_resume_date"
            ]
        )

        resume_response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/resume/",
        )
        assigned.refresh_from_db()
        self.assertEqual(
            resume_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            assigned.current_status,
            CorrectionRequestStatus.IN_PROGRESS,
        )

    def test_cannot_start_progress_before_accepting(
        self,
    ):
        assigned = self._assigned_request(
            "JV-WORK-007"
        )

        self.client.force_authenticate(
            self.person_a
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/start-progress/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_hold_requires_reason(self):
        assigned = self._assigned_request(
            "JV-WORK-008"
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

        response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/hold/",
            {"reason": ""},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_cannot_hold_before_in_progress(self):
        assigned = self._assigned_request(
            "JV-WORK-009"
        )
        self.client.force_authenticate(
            self.person_a
        )
        self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/accept/",
        )

        response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/hold/",
            {"reason": "Too early."},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
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
                    f"Work status test for {voucher_number}"
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

    def _create_user(self, employee_id, role):
        return User.objects.create_user(
            employee_id=employee_id,
            password="StrongPass123!",
            first_name=employee_id,
            role=role,
            account_status=AccountStatus.ACTIVE,
        )
