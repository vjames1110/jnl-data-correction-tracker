from django.core.exceptions import ValidationError
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
    ClosureType,
    CorrectionAutoCloseSettings,
    CorrectionRequest,
    CorrectionRequestStatus,
    CorrectionTimelineEventType,
    SlaResult,
)
from apps.corrections.services.closure import (
    run_auto_close_reminder_sweep,
    run_auto_close_sweep,
)
from apps.corrections.services.drafts import (
    create_draft,
)
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


class CorrectionAutoCloseSettingsModelTests(
    TransactionTestCase
):
    def test_only_one_settings_row_may_exist(self):
        CorrectionAutoCloseSettings.objects.create()

        with self.assertRaises(ValidationError):
            CorrectionAutoCloseSettings.objects.create()

    def test_get_solo_reuses_the_same_row(self):
        first = (
            CorrectionAutoCloseSettings.get_solo()
        )
        second = (
            CorrectionAutoCloseSettings.get_solo()
        )

        self.assertEqual(first.id, second.id)
        self.assertEqual(
            CorrectionAutoCloseSettings.objects.count(),
            1,
        )

    def test_reminder_must_precede_auto_close_day(
        self,
    ):
        settings = CorrectionAutoCloseSettings(
            auto_close_after_days=3,
            reminder_before_days=3,
        )

        with self.assertRaises(ValidationError):
            settings.save()


class ClosureFixturesMixin:
    def setUp(self):
        self.client = APIClient()
        self.requester = self._create_user(
            "CLOREQ001",
            UserRole.USER,
        )
        self.director = self._create_user(
            "CLODIR001",
            UserRole.DIRECTOR,
        )
        self.admin = self._create_user(
            "CLOADM001",
            UserRole.ADMIN,
            is_staff=True,
        )
        self.person_a = self._create_user(
            "CLORP001",
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
            sla_duration_hours=800,
            escalation_duration_hours=4,
        )
        self.critical_priority = (
            Priority.objects.create(
                priority_name="Critical",
                sla_duration_hours=800,
                escalation_duration_hours=4,
            )
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
            responsible_person=self.person_a,
        )

    def _resolved_request(
        self,
        voucher_number,
        *,
        priority=None,
    ):
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
                    f"Closure test for {voucher_number}"
                ),
                "reason_category": self.reason,
                "priority": priority or self.priority,
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
        return submitted

    def _backdate(self, request, *, days):
        stale = timezone.now() - timezone.timedelta(
            days=days
        )
        CorrectionRequest.objects.filter(
            pk=request.pk
        ).update(updated_at=stale)
        request.refresh_from_db()
        return request

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


class ConfirmResolutionClosureFieldsTests(
    ClosureFixturesMixin,
    TransactionTestCase,
):
    reset_sequences = True

    def test_confirm_resolution_records_closure_audit_fields(
        self,
    ):
        resolved = self._resolved_request(
            "JV-CLO-001"
        )

        self.client.force_authenticate(
            self.requester
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{resolved.id}/confirm-resolution/",
            {"comment": "Confirmed."},
            format="json",
        )
        resolved.refresh_from_db()

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            resolved.current_status,
            CorrectionRequestStatus.CLOSED,
        )
        self.assertEqual(
            resolved.closure_type,
            ClosureType.CONFIRMED,
        )
        self.assertEqual(
            resolved.closed_by_id,
            self.requester.id,
        )
        self.assertIsNotNone(resolved.closed_at)
        self.assertIsNotNone(
            resolved.resolution_duration_hours
        )
        self.assertIn(
            resolved.final_sla_result,
            {
                SlaResult.MET,
                SlaResult.BREACHED,
                SlaResult.NOT_APPLICABLE,
            },
        )

        response_data = response.json()["data"]
        self.assertEqual(
            response_data["closure_type"],
            ClosureType.CONFIRMED,
        )
        self.assertEqual(
            response_data["closed_by_employee_id"],
            self.requester.employee_id,
        )


class AutoCloseSweepTests(
    ClosureFixturesMixin,
    TransactionTestCase,
):
    reset_sequences = True

    def test_sweep_does_nothing_when_disabled(self):
        resolved = self._resolved_request(
            "JV-CLO-002"
        )
        self._backdate(resolved, days=10)

        summary = run_auto_close_sweep()
        resolved.refresh_from_db()

        self.assertFalse(summary["enabled"])
        self.assertEqual(summary["closed"], [])
        self.assertEqual(
            resolved.current_status,
            CorrectionRequestStatus.RESOLVED,
        )

    def test_sweep_closes_stale_resolved_requests(
        self,
    ):
        resolved = self._resolved_request(
            "JV-CLO-003"
        )
        self._backdate(resolved, days=10)
        CorrectionAutoCloseSettings.objects.create(
            is_enabled=True,
            auto_close_after_days=7,
            reminder_before_days=2,
        )

        summary = run_auto_close_sweep()
        resolved.refresh_from_db()

        self.assertTrue(summary["enabled"])
        self.assertIn(
            resolved.reference,
            summary["closed"],
        )
        self.assertEqual(
            resolved.current_status,
            CorrectionRequestStatus.CLOSED,
        )
        self.assertEqual(
            resolved.closure_type,
            ClosureType.AUTO_CLOSED,
        )
        self.assertIsNone(resolved.closed_by_id)
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.requester,
                event_type=(
                    NotificationEventType.REQUEST_AUTO_CLOSED
                ),
                correction_request=resolved,
            ).exists()
        )

    def test_sweep_leaves_recently_resolved_requests_alone(
        self,
    ):
        resolved = self._resolved_request(
            "JV-CLO-004"
        )
        CorrectionAutoCloseSettings.objects.create(
            is_enabled=True,
            auto_close_after_days=7,
            reminder_before_days=2,
        )

        summary = run_auto_close_sweep()
        resolved.refresh_from_db()

        self.assertNotIn(
            resolved.reference,
            summary["closed"],
        )
        self.assertEqual(
            resolved.current_status,
            CorrectionRequestStatus.RESOLVED,
        )

    def test_sweep_excludes_critical_priority_by_default(
        self,
    ):
        resolved = self._resolved_request(
            "JV-CLO-005",
            priority=self.critical_priority,
        )
        self._backdate(resolved, days=10)
        CorrectionAutoCloseSettings.objects.create(
            is_enabled=True,
            auto_close_after_days=7,
            reminder_before_days=2,
            exclude_critical_priority=True,
        )

        summary = run_auto_close_sweep()
        resolved.refresh_from_db()

        self.assertNotIn(
            resolved.reference,
            summary["closed"],
        )
        self.assertEqual(
            resolved.current_status,
            CorrectionRequestStatus.RESOLVED,
        )

    def test_reminder_sweep_sends_only_one_reminder(
        self,
    ):
        resolved = self._resolved_request(
            "JV-CLO-006"
        )
        self._backdate(resolved, days=6)
        CorrectionAutoCloseSettings.objects.create(
            is_enabled=True,
            auto_close_after_days=7,
            reminder_before_days=2,
        )

        first_summary = (
            run_auto_close_reminder_sweep()
        )
        second_summary = (
            run_auto_close_reminder_sweep()
        )

        self.assertIn(
            resolved.reference,
            first_summary["reminded"],
        )
        self.assertEqual(
            second_summary["reminded"],
            [],
        )
        self.assertEqual(
            Notification.objects.filter(
                recipient=self.requester,
                event_type=(
                    NotificationEventType.AUTO_CLOSE_REMINDER
                ),
                correction_request=resolved,
            ).count(),
            1,
        )


class RunAutoCloseApiTests(
    ClosureFixturesMixin,
    TransactionTestCase,
):
    reset_sequences = True

    def test_non_admin_cannot_trigger_sweep(self):
        self.client.force_authenticate(
            self.requester
        )
        response = self.client.post(
            "/api/v1/corrections/requests/run-auto-close/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_can_trigger_sweep(self):
        resolved = self._resolved_request(
            "JV-CLO-007"
        )
        self._backdate(resolved, days=10)
        CorrectionAutoCloseSettings.objects.create(
            is_enabled=True,
            auto_close_after_days=7,
            reminder_before_days=2,
        )

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/v1/corrections/requests/run-auto-close/",
        )
        resolved.refresh_from_db()

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            resolved.current_status,
            CorrectionRequestStatus.CLOSED,
        )
        data = response.json()["data"]
        self.assertIn(
            resolved.reference,
            data["auto_close"]["closed"],
        )
