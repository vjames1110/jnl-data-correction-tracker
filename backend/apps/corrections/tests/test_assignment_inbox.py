from datetime import timedelta

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
from apps.organization.models import (
    Company,
    Department,
    Site,
)


class AssignmentInboxApiTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.client = APIClient()
        self.requester = self._create_user(
            "INBREQ001",
            UserRole.USER,
        )
        self.director = self._create_user(
            "INBDIR001",
            UserRole.DIRECTOR,
        )
        self.person_a = self._create_user(
            "INBRP001",
            UserRole.RESPONSIBLE_PERSON,
        )
        self.person_b = self._create_user(
            "INBRP002",
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

    def test_my_assignments_only_returns_owned_requests(
        self,
    ):
        assigned = self._assigned_request(
            "JV-INBOX-001"
        )

        self.client.force_authenticate(
            self.person_a
        )
        owner_response = self.client.get(
            "/api/v1/corrections/requests/my-assignments/"
        )

        self.client.force_authenticate(
            self.person_b
        )
        other_response = self.client.get(
            "/api/v1/corrections/requests/my-assignments/"
        )

        self.assertEqual(
            owner_response.status_code,
            status.HTTP_200_OK,
        )
        owner_ids = [
            item["id"]
            for item in owner_response.data["data"]
        ]
        self.assertIn(
            str(assigned.id),
            owner_ids,
        )
        other_ids = [
            item["id"]
            for item in other_response.data["data"]
        ]
        self.assertNotIn(
            str(assigned.id),
            other_ids,
        )

    def test_assignment_counts_reflect_status_buckets(
        self,
    ):
        assigned = self._assigned_request(
            "JV-INBOX-002"
        )
        self.client.force_authenticate(
            self.person_a
        )

        first_counts = self.client.get(
            "/api/v1/corrections/requests/assignment-counts/"
        ).data["data"]
        self.assertEqual(
            first_counts["newly_assigned"],
            1,
        )
        self.assertEqual(
            first_counts["accepted"],
            0,
        )

        self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/accept/",
        )
        second_counts = self.client.get(
            "/api/v1/corrections/requests/assignment-counts/"
        ).data["data"]
        self.assertEqual(
            second_counts["newly_assigned"],
            0,
        )
        self.assertEqual(
            second_counts["accepted"],
            1,
        )

        self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/start-progress/",
        )
        third_counts = self.client.get(
            "/api/v1/corrections/requests/assignment-counts/"
        ).data["data"]
        self.assertEqual(
            third_counts["in_progress"],
            1,
        )

        resolve_response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/resolve/",
            {
                "erp_action_completed": "Corrected.",
                "completion_date": (
                    timezone.localdate().isoformat()
                ),
            },
            format="json",
        )
        self.assertEqual(
            resolve_response.status_code,
            status.HTTP_200_OK,
        )
        final_counts = self.client.get(
            "/api/v1/corrections/requests/assignment-counts/"
        ).data["data"]
        self.assertEqual(
            final_counts["resolved_today"],
            1,
        )
        self.assertEqual(
            final_counts["in_progress"],
            0,
        )

    def test_assignment_counts_flag_overdue_work(self):
        assigned = self._assigned_request(
            "JV-INBOX-003"
        )
        assigned.sla_deadline = (
            timezone.now() - timedelta(hours=1)
        )
        assigned.save(
            update_fields=["sla_deadline"]
        )

        self.client.force_authenticate(
            self.person_a
        )
        counts = self.client.get(
            "/api/v1/corrections/requests/assignment-counts/"
        ).data["data"]

        self.assertEqual(counts["overdue"], 1)

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
                    f"Assignment inbox test for {voucher_number}"
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
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.ASSIGNED,
        )
        return submitted

    def _create_user(self, employee_id, role):
        return User.objects.create_user(
            employee_id=employee_id,
            password="StrongPass123!",
            first_name=employee_id,
            role=role,
            account_status=AccountStatus.ACTIVE,
        )
