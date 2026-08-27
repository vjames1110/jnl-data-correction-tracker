from django.test import TestCase
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
    ApprovalStepStatus,
    ApprovalWorkflowLevel,
    ApprovalWorkflowPolicy,
    CorrectionApprovalStep,
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
    VoucherType,
    WorkType,
)
from apps.notifications.models import (
    Notification,
    NotificationEventType,
)
from apps.organization.models import (
    ApprovalAuthorityType,
    Company,
    Department,
    DirectorMapping,
    Site,
)


class ApprovalApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.requester = self._create_user(
            "REQAPP001",
            UserRole.USER,
        )
        self.approver_one = self._create_user(
            "APRAPP001",
            UserRole.DIRECTOR,
        )
        self.approver_two = self._create_user(
            "APRAPP002",
            UserRole.DIRECTOR,
        )
        self.delegate = self._create_user(
            "DELAPP001",
            UserRole.DIRECTOR,
        )
        self.other_user = self._create_user(
            "OTHAPP001",
            UserRole.USER,
        )
        self.admin = self._create_user(
            "ADMAPP001",
            UserRole.ADMIN,
            is_staff=True,
        )
        self.company = Company.objects.create(
            company_code="JNL",
            company_name="Jhajharia Nirman Limited",
        )
        self.site = Site.objects.create(
            company=self.company,
            site_code="JPR",
            site_name="Jaipur Site",
            site_director=self.approver_one,
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
        EmployeeProfile.objects.create(
            user=self.delegate,
            employee_id=self.delegate.employee_id,
            first_name=self.delegate.first_name,
            role=self.delegate.role,
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
            policy_name="Finance two level approval",
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
            level_name="First approval",
            approver_type=ApprovalApproverType.CUSTOM,
            custom_approver=self.approver_one,
            sla_hours=4,
            escalation_hours=2,
        )
        ApprovalWorkflowLevel.objects.create(
            workflow_policy=self.policy,
            sequence=2,
            level_name="Final approval",
            approver_type=ApprovalApproverType.CUSTOM,
            custom_approver=self.approver_two,
        )

    def test_inbox_counts_comment_and_history_api(self):
        submitted = self._submit_request(
            "JV-INBOX-001"
        )
        step = submitted.approval_steps.get(
            sequence=1
        )
        self.client.force_authenticate(
            self.approver_one
        )

        inbox_response = self.client.get(
            "/api/v1/corrections/approvals/inbox/"
        )
        counts_response = self.client.get(
            "/api/v1/corrections/approvals/pending-counts/"
        )
        detail_response = self.client.get(
            f"/api/v1/corrections/approvals/{step.id}/"
        )
        comment_response = self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/comment/",
            {"comment": "Checking supporting documents."},
            format="json",
        )
        history_response = self.client.get(
            f"/api/v1/corrections/approvals/{step.id}/history/"
        )

        self.assertEqual(
            inbox_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            counts_response.data["data"]["total_pending"],
            1,
        )
        self.assertEqual(
            detail_response.data["id"],
            str(step.id),
        )
        self.assertEqual(
            comment_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertTrue(
            any(
                item["metadata"].get("action")
                == "COMMENT"
                for item in history_response.data["data"]
            )
        )

    def test_director_approval_closes_request_without_second_level(
        self,
    ):
        # This test exercises the default (no-matching-policy)
        # first-decision-wins route specifically - deactivate the
        # class-level two-level policy so it doesn't hijack routing
        # for this request, now that Phase 6 makes configured policy
        # levels actually take effect.
        self.policy.is_active = False
        self.policy.save(update_fields=["is_active"])

        submitted = self._submit_request(
            "JV-APPROVE-001"
        )
        step = submitted.approval_steps.get(
            sequence=1
        )

        self.client.force_authenticate(
            self.approver_one
        )
        response = self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/approve/",
            {"comment": "Director approved."},
            format="json",
        )
        submitted.refresh_from_db()

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.APPROVED,
        )
        self.assertEqual(
            submitted.approval_steps.count(),
            2,
        )
        self.assertEqual(
            submitted.approval_steps.get(
                approver_type=ApprovalApproverType.ADMIN_FINAL
            ).status,
            ApprovalStepStatus.SKIPPED,
        )

    def test_admin_can_approve_same_director_step_first(
        self,
    ):
        # Same reasoning as
        # test_director_approval_closes_request_without_second_level -
        # this test is about the default multi-approver route, not
        # the class-level policy's sequential levels.
        self.policy.is_active = False
        self.policy.save(update_fields=["is_active"])

        submitted = self._submit_request(
            "JV-ADMIN-FIRST-001"
        )
        step = submitted.approval_steps.get(
            sequence=1
        )

        self.client.force_authenticate(self.admin)
        admin_response = self.client.get(
            "/api/v1/corrections/approvals/inbox/"
        )
        approve_response = self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/approve/",
            {"comment": "Admin approved first."},
            format="json",
        )
        submitted.refresh_from_db()

        self.assertEqual(
            admin_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            approve_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.APPROVED,
        )

        self.client.force_authenticate(
            self.approver_one
        )
        director_response = self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/approve/",
            {"comment": "Director came later."},
            format="json",
        )
        self.assertEqual(
            director_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_mapped_director_can_see_and_approve_admin_fallback_step(
        self,
    ):
        admin_only_site = Site.objects.create(
            company=self.company,
            site_code="ADM",
            site_name="Admin Fallback Site",
        )
        draft = create_draft(
            requester=self.requester,
            data={
                "site": admin_only_site,
                "department": self.department,
                "erp_module": self.module,
                "voucher_type": self.voucher,
                "work_type": self.work_type,
                "voucher_number": "JV-LATE-DIR-001",
                "voucher_date": timezone.localdate(),
                "erp_email_date": timezone.localdate(),
                "description": (
                    "Approval should be visible after "
                    "director mapping is added."
                ),
                "reason_category": self.reason,
                "priority": self.priority,
            },
        )
        submitted = submit_request(
            draft=draft,
            user=self.requester,
            override_duplicates=True,
            duplicate_override_reason=(
                "Director mapping fallback regression test."
            ),
        )
        step = submitted.approval_steps.get()
        self.assertEqual(
            step.approver_type,
            ApprovalApproverType.ADMIN_FINAL,
        )

        DirectorMapping.objects.create(
            director=self.approver_one,
            site=admin_only_site,
            authority_type=ApprovalAuthorityType.PRIMARY,
        )

        self.client.force_authenticate(
            self.approver_one
        )
        inbox_response = self.client.get(
            "/api/v1/corrections/approvals/inbox/"
        )
        approve_response = self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/approve/",
            {"comment": "Mapped director approved."},
            format="json",
        )
        submitted.refresh_from_db()

        self.assertEqual(
            inbox_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            len(inbox_response.data["data"]),
            1,
        )
        self.assertEqual(
            approve_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.APPROVED,
        )
        self.assertEqual(
            submitted.current_owner,
            self.approver_one,
        )

    def test_unauthorized_and_repeat_approval_are_rejected(
        self,
    ):
        submitted = self._submit_request(
            "JV-SECURITY-001"
        )
        step = submitted.approval_steps.get(
            sequence=1
        )

        self.client.force_authenticate(self.other_user)
        unauthorized_response = self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/approve/",
            {"comment": "Trying to approve."},
            format="json",
        )

        self.assertEqual(
            unauthorized_response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.client.force_authenticate(
            self.approver_one
        )
        first_response = self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/approve/",
            {"comment": "Approved once."},
            format="json",
        )
        repeat_response = self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/approve/",
            {"comment": "Approved twice."},
            format="json",
        )

        self.assertEqual(
            first_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            repeat_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_delegate_then_delegated_user_can_approve(
        self,
    ):
        submitted = self._submit_request(
            "JV-DELEGATE-001"
        )
        step = submitted.approval_steps.get(
            sequence=1
        )
        self.client.force_authenticate(
            self.approver_one
        )

        delegate_response = self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/delegate/",
            {
                "delegate_to": str(self.delegate.id),
                "comment": "Delegating while on leave.",
            },
            format="json",
        )
        submitted.refresh_from_db()
        step.refresh_from_db()

        self.assertEqual(
            delegate_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(step.approver, self.delegate)
        self.assertEqual(
            submitted.current_owner,
            self.delegate,
        )
        # The audit-trail snapshot follows the live approver after a
        # delegation - it should show the delegate (DELAPP001), not
        # the original approver whose turn it no longer is.
        self.assertEqual(
            step.approver_employee_id_snapshot,
            "DELAPP001",
        )

        self.client.force_authenticate(self.delegate)
        approve_response = self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/approve/",
            {"comment": "Approved by delegate."},
            format="json",
        )

        self.assertEqual(
            approve_response.status_code,
            status.HTTP_200_OK,
        )

    def test_reject_return_escalation_reminder_and_admin_intervention(
        self,
    ):
        rejected = self._submit_request(
            "JV-REJECT-001"
        )
        rejected_step = rejected.approval_steps.get(
            sequence=1
        )
        self.client.force_authenticate(
            self.approver_one
        )

        reject_response = self.client.post(
            f"/api/v1/corrections/approvals/{rejected_step.id}/reject/",
            {"comment": "Voucher details are wrong."},
            format="json",
        )
        rejected.refresh_from_db()

        self.assertEqual(
            reject_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            rejected.current_status,
            CorrectionRequestStatus.REJECTED,
        )

        returned = self._submit_request(
            "JV-RETURN-001"
        )
        returned_step = returned.approval_steps.get(
            sequence=1
        )
        return_response = self.client.post(
            f"/api/v1/corrections/approvals/{returned_step.id}/return/",
            {"comment": "Clarify voucher reference."},
            format="json",
        )
        returned.refresh_from_db()

        self.assertEqual(
            return_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            returned.current_status,
            CorrectionRequestStatus.REOPENED,
        )

        escalated = self._submit_request(
            "JV-ESC-001"
        )
        escalated_step = escalated.approval_steps.get(
            sequence=1
        )
        reminder_response = self.client.post(
            f"/api/v1/corrections/approvals/{escalated_step.id}/reminder/",
            {"comment": "Please review today."},
            format="json",
        )
        escalate_response = self.client.post(
            f"/api/v1/corrections/approvals/{escalated_step.id}/escalate/",
            {
                "backup_approver": str(self.delegate.id),
                "comment": "Escalating to backup.",
            },
            format="json",
        )
        escalated.refresh_from_db()

        self.assertEqual(
            reminder_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            escalate_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            escalated.current_owner,
            self.delegate,
        )

        admin_case = self._submit_request(
            "JV-ADMIN-001"
        )
        admin_step = admin_case.approval_steps.get(
            sequence=1
        )
        self.client.force_authenticate(self.admin)
        admin_response = self.client.post(
            f"/api/v1/corrections/approvals/{admin_step.id}/admin-intervention/",
            {
                "action": "APPROVE",
                "comment": "Admin approved due to absence.",
            },
            format="json",
        )

        self.assertEqual(
            admin_response.status_code,
            status.HTTP_200_OK,
        )

    def test_admin_records_sla_breaches_once(self):
        submitted = self._submit_request(
            "JV-SLA-001"
        )
        step = submitted.approval_steps.get(
            sequence=1
        )
        step.due_at = timezone.now() - timezone.timedelta(
            hours=1
        )
        step.save(update_fields=["due_at"])
        self.client.force_authenticate(self.admin)

        first_response = self.client.post(
            "/api/v1/corrections/approvals/record-sla-breaches/"
        )
        second_response = self.client.post(
            "/api/v1/corrections/approvals/record-sla-breaches/"
        )

        self.assertEqual(
            first_response.data["data"]["recorded_breaches"],
            1,
        )
        self.assertEqual(
            second_response.data["data"]["recorded_breaches"],
            0,
        )

    def test_sequential_route_only_first_level_current_initially(
        self,
    ):
        # self.policy (set up above) configures two CUSTOM levels -
        # approver_one then approver_two - so submitting against it
        # exercises the real sequential chain, not the default
        # first-decision-wins route.
        # Notifications are dispatched via transaction.on_commit,
        # which this plain TestCase never actually fires (the outer
        # transaction is rolled back, not committed) - capture and
        # run those callbacks explicitly so the assertions below can
        # see the created rows.
        with self.captureOnCommitCallbacks(execute=True):
            submitted = self._submit_request(
                "JV-SEQ-INIT-001"
            )
        steps = list(
            submitted.approval_steps.order_by("sequence")
        )

        self.assertEqual(len(steps), 2)
        self.assertTrue(steps[0].is_sequential_route)
        self.assertTrue(steps[0].is_current)
        self.assertEqual(steps[0].approver, self.approver_one)
        self.assertFalse(steps[1].is_current)
        self.assertEqual(steps[1].approver, self.approver_two)
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.PENDING_APPROVAL,
        )
        self.assertEqual(
            submitted.current_owner,
            self.approver_one,
        )

        # Only the reachable first level was notified - the second
        # approver isn't actionable yet.
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.approver_one,
                event_type=(
                    NotificationEventType.APPROVAL_PENDING
                ),
            ).exists()
        )
        self.assertFalse(
            Notification.objects.filter(
                recipient=self.approver_two,
                event_type=(
                    NotificationEventType.APPROVAL_PENDING
                ),
            ).exists()
        )

    def test_sequential_approval_advances_to_next_level(
        self,
    ):
        submitted = self._submit_request(
            "JV-SEQ-ADV-001"
        )
        first_step = submitted.approval_steps.get(
            sequence=1
        )

        self.client.force_authenticate(
            self.approver_one
        )
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                f"/api/v1/corrections/approvals/{first_step.id}/approve/",
                {"comment": "First level approved."},
                format="json",
            )
        submitted.refresh_from_db()
        first_step.refresh_from_db()
        second_step = submitted.approval_steps.get(
            sequence=2
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            first_step.status,
            ApprovalStepStatus.APPROVED,
        )
        self.assertFalse(first_step.is_current)
        self.assertTrue(second_step.is_current)
        self.assertEqual(
            second_step.status,
            ApprovalStepStatus.PENDING,
        )
        # The class-level policy's second level ("Final approval")
        # has no sla_hours configured, so activation leaves due_at
        # unset - only a level with its own SLA config gets one.
        self.assertIsNone(second_step.due_at)
        # The request stays pending - the chain isn't finished until
        # the last level decides.
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.PENDING_APPROVAL,
        )
        self.assertEqual(
            submitted.current_owner,
            self.approver_two,
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.approver_two,
                event_type=(
                    NotificationEventType.APPROVAL_PENDING
                ),
            ).exists()
        )

        # The now-decided first level can't be acted on again.
        repeat_response = self.client.post(
            f"/api/v1/corrections/approvals/{first_step.id}/approve/",
            {"comment": "Trying again."},
            format="json",
        )
        self.assertEqual(
            repeat_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_sequential_final_approval_completes_request(
        self,
    ):
        submitted = self._submit_request(
            "JV-SEQ-FINAL-001"
        )
        first_step = submitted.approval_steps.get(
            sequence=1
        )
        self.client.force_authenticate(
            self.approver_one
        )
        self.client.post(
            f"/api/v1/corrections/approvals/{first_step.id}/approve/",
            {"comment": "First level approved."},
            format="json",
        )
        second_step = submitted.approval_steps.get(
            sequence=2
        )

        self.client.force_authenticate(
            self.approver_two
        )
        response = self.client.post(
            f"/api/v1/corrections/approvals/{second_step.id}/approve/",
            {"comment": "Final level approved."},
            format="json",
        )
        submitted.refresh_from_db()
        second_step.refresh_from_db()

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            second_step.status,
            ApprovalStepStatus.APPROVED,
        )
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.APPROVED,
        )
        self.assertEqual(
            submitted.current_owner,
            self.approver_two,
        )

    def test_sequential_reject_mid_chain_skips_remaining_steps(
        self,
    ):
        submitted = self._submit_request(
            "JV-SEQ-REJECT-001"
        )
        first_step = submitted.approval_steps.get(
            sequence=1
        )
        self.client.force_authenticate(
            self.approver_one
        )
        response = self.client.post(
            f"/api/v1/corrections/approvals/{first_step.id}/reject/",
            {"comment": "Voucher amount is wrong."},
            format="json",
        )
        submitted.refresh_from_db()
        second_step = submitted.approval_steps.get(
            sequence=2
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.REJECTED,
        )
        # Rejecting at any point in the chain kills the whole flow -
        # the not-yet-reached second level is skipped, not left
        # dangling as pending.
        self.assertEqual(
            second_step.status,
            ApprovalStepStatus.SKIPPED,
        )
        self.assertFalse(second_step.is_current)

    def _submit_request(self, voucher_number):
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
                    "Approval requested for "
                    f"{voucher_number}"
                ),
                "reason_category": self.reason,
                "priority": self.priority,
            },
        )
        return submit_request(
            draft=draft,
            user=self.requester,
            override_duplicates=True,
            duplicate_override_reason=(
                "Approval API regression test duplicate override."
            ),
        )

    def _create_user(
        self,
        employee_id,
        role,
        *,
        is_staff=False,
    ):
        return User.objects.create_user(
            employee_id=employee_id,
            password="StrongPass123!",
            first_name=employee_id,
            role=role,
            account_status=AccountStatus.ACTIVE,
            is_staff=is_staff,
        )
