from django.test import TestCase, TransactionTestCase
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
    CorrectionRequest,
    CorrectionRequestStatus,
    CorrectionTimelineEventType,
)
from apps.corrections.services.assignment import (
    _active_workload,
    resolve_responsible_person,
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
    ApprovalAuthorityType,
    Company,
    Department,
    DirectorMapping,
    Site,
)


class AssignmentResolutionTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            company_code="JNL",
            company_name="Jhajharia Nirman Limited",
        )
        self.site = Site.objects.create(
            company=self.company,
            site_code="JPR",
            site_name="Jaipur Site",
        )
        self.other_site = Site.objects.create(
            company=self.company,
            site_code="UDR",
            site_name="Udaipur Site",
        )
        self.department = Department.objects.create(
            company=self.company,
            department_name="Finance",
        )
        self.module = ErpModule.objects.create(
            module_name="Finance",
        )
        self.work_type = WorkType.objects.create(
            work_type_name="Amount Correction",
            requires_approval=True,
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
        self.requester = self._create_user(
            "ASGREQ001",
            UserRole.USER,
        )
        self.person_a = self._create_user(
            "ASGRP001",
            UserRole.RESPONSIBLE_PERSON,
        )
        self.person_b = self._create_user(
            "ASGRP002",
            UserRole.RESPONSIBLE_PERSON,
        )
        self.request = CorrectionRequest.objects.create(
            requester=self.requester,
            site=self.site,
            department=self.department,
            erp_module=self.module,
            voucher_type=self.voucher,
            work_type=self.work_type,
            priority=self.priority,
        )

    def test_returns_none_when_no_mapping_matches(self):
        self.assertIsNone(
            resolve_responsible_person(self.request)
        )

    def test_prefers_the_most_specific_mapping(self):
        broad = ResponsiblePersonMapping.objects.create(
            erp_module=self.module,
            responsible_person=self.person_a,
        )
        specific = (
            ResponsiblePersonMapping.objects.create(
                erp_module=self.module,
                site=self.site,
                department=self.department,
                voucher_type=self.voucher,
                work_type=self.work_type,
                priority=self.priority,
                responsible_person=self.person_b,
            )
        )

        resolved = resolve_responsible_person(
            self.request
        )

        self.assertEqual(resolved.id, specific.id)
        self.assertNotEqual(resolved.id, broad.id)

    def test_breaks_specificity_ties_using_lowest_workload(
        self,
    ):
        ResponsiblePersonMapping.objects.create(
            erp_module=self.module,
            department=self.department,
            responsible_person=self.person_a,
        )
        ResponsiblePersonMapping.objects.create(
            erp_module=self.module,
            site=self.site,
            responsible_person=self.person_b,
        )
        CorrectionRequest.objects.create(
            requester=self.requester,
            current_owner=self.person_a,
            current_status=(
                CorrectionRequestStatus.ASSIGNED
            ),
        )
        CorrectionRequest.objects.create(
            requester=self.requester,
            current_owner=self.person_a,
            current_status=(
                CorrectionRequestStatus.IN_PROGRESS
            ),
        )

        resolved = resolve_responsible_person(
            self.request
        )

        self.assertEqual(
            resolved.responsible_person_id,
            self.person_b.id,
        )

    def test_breaks_remaining_ties_using_display_order(
        self,
    ):
        ResponsiblePersonMapping.objects.create(
            erp_module=self.module,
            voucher_type=self.voucher,
            responsible_person=self.person_a,
            display_order=5,
        )
        preferred = (
            ResponsiblePersonMapping.objects.create(
                erp_module=self.module,
                work_type=self.work_type,
                responsible_person=self.person_b,
                display_order=1,
            )
        )

        resolved = resolve_responsible_person(
            self.request
        )

        self.assertEqual(resolved.id, preferred.id)

    def test_only_active_work_counts_towards_workload(
        self,
    ):
        CorrectionRequest.objects.create(
            requester=self.requester,
            current_owner=self.person_a,
            current_status=(
                CorrectionRequestStatus.CLOSED
            ),
        )
        CorrectionRequest.objects.create(
            requester=self.requester,
            current_owner=self.person_a,
            current_status=(
                CorrectionRequestStatus.REJECTED
            ),
        )

        workload = _active_workload(
            {self.person_a.id, self.person_b.id}
        )

        self.assertEqual(workload, {})

    def _create_user(self, employee_id, role):
        return User.objects.create_user(
            employee_id=employee_id,
            password="StrongPass123!",
            first_name=employee_id,
            role=role,
            account_status=AccountStatus.ACTIVE,
        )


class ManualAssignmentApiTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.client = APIClient()
        self.requester = self._create_user(
            "ASGMAN001",
            UserRole.USER,
        )
        self.director = self._create_user(
            "ASGMAN002",
            UserRole.DIRECTOR,
        )
        self.other_director = self._create_user(
            "ASGMAN003",
            UserRole.DIRECTOR,
        )
        self.admin = self._create_user(
            "ASGMAN004",
            UserRole.ADMIN,
            is_staff=True,
        )
        self.person_a = self._create_user(
            "ASGMAN005",
            UserRole.RESPONSIBLE_PERSON,
        )
        self.person_b = self._create_user(
            "ASGMAN006",
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
        DirectorMapping.objects.create(
            director=self.director,
            site=self.site,
            authority_type=(
                ApprovalAuthorityType.PRIMARY
            ),
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

    def test_admin_can_manually_assign_approved_request(
        self,
    ):
        approved = self._approve_request(
            "JV-MANUAL-001"
        )
        self.assertEqual(
            approved.current_status,
            CorrectionRequestStatus.APPROVED,
        )

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/v1/corrections/requests/{approved.id}/assign/",
            {
                "responsible_person": str(
                    self.person_a.id
                ),
                "comment": "Assigning to Person A.",
            },
            format="json",
        )
        approved.refresh_from_db()

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            approved.current_status,
            CorrectionRequestStatus.ASSIGNED,
        )
        self.assertEqual(
            approved.current_owner_id,
            self.person_a.id,
        )
        timeline_entry = (
            approved.timeline_entries.get(
                event_type=(
                    CorrectionTimelineEventType.ASSIGNED
                ),
            )
        )
        self.assertTrue(
            timeline_entry.metadata.get("manual")
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.person_a,
                event_type=(
                    NotificationEventType.REQUEST_ASSIGNED
                ),
                correction_request=approved,
            ).exists()
        )

    def test_admin_can_override_existing_assignment(
        self,
    ):
        ResponsiblePersonMapping.objects.create(
            erp_module=self.module,
            voucher_type=self.voucher,
            department=self.department,
            site=self.site,
            work_type=self.work_type,
            priority=self.priority,
            responsible_person=self.person_a,
        )
        assigned = self._approve_request(
            "JV-MANUAL-002"
        )
        self.assertEqual(
            assigned.current_owner_id,
            self.person_a.id,
        )

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/assign/",
            {
                "responsible_person": str(
                    self.person_b.id
                ),
            },
            format="json",
        )
        assigned.refresh_from_db()

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            assigned.current_owner_id,
            self.person_b.id,
        )
        timeline_entry = (
            assigned.timeline_entries.filter(
                event_type=(
                    CorrectionTimelineEventType.ASSIGNED
                ),
                metadata__manual=True,
            ).latest("created_at")
        )
        self.assertEqual(
            timeline_entry.metadata.get(
                "previous_owner"
            ),
            str(self.person_a.id),
        )

    def test_authorized_director_can_manually_assign(
        self,
    ):
        approved = self._approve_request(
            "JV-MANUAL-003"
        )

        self.client.force_authenticate(
            self.director
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{approved.id}/assign/",
            {
                "responsible_person": str(
                    self.person_a.id
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

    def test_unauthorized_director_cannot_manually_assign(
        self,
    ):
        approved = self._approve_request(
            "JV-MANUAL-004"
        )

        self.client.force_authenticate(
            self.other_director
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{approved.id}/assign/",
            {
                "responsible_person": str(
                    self.person_a.id
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_requester_cannot_manually_assign(self):
        approved = self._approve_request(
            "JV-MANUAL-005"
        )

        self.client.force_authenticate(
            self.requester
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{approved.id}/assign/",
            {
                "responsible_person": str(
                    self.person_a.id
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_cannot_assign_a_non_responsible_person_user(
        self,
    ):
        approved = self._approve_request(
            "JV-MANUAL-006"
        )

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/v1/corrections/requests/{approved.id}/assign/",
            {
                "responsible_person": str(
                    self.requester.id
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_cannot_assign_a_request_pending_approval(
        self,
    ):
        draft = create_draft(
            requester=self.requester,
            data={
                "site": self.site,
                "department": self.department,
                "erp_module": self.module,
                "voucher_type": self.voucher,
                "work_type": self.work_type,
                "voucher_number": "JV-MANUAL-007",
                "voucher_date": timezone.localdate(),
                "erp_email_date": timezone.localdate(),
                "description": "Pending approval request.",
                "reason_category": self.reason,
                "priority": self.priority,
            },
        )
        pending = submit_request(
            draft=draft,
            user=self.requester,
        )

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/v1/corrections/requests/{pending.id}/assign/",
            {
                "responsible_person": str(
                    self.person_a.id
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def _approve_request(self, voucher_number):
        submitted = self._submit_request(
            voucher_number
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
                    f"Manual assignment test for {voucher_number}"
                ),
                "reason_category": self.reason,
                "priority": self.priority,
            },
        )
        return submit_request(
            draft=draft,
            user=self.requester,
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


class ApprovalAutoAssignmentTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.client = APIClient()
        self.requester = self._create_user(
            "ASGAPP001",
            UserRole.USER,
        )
        self.approver = self._create_user(
            "ASGAPP002",
            UserRole.DIRECTOR,
        )
        self.responsible_person = self._create_user(
            "ASGAPP003",
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
            site_director=self.approver,
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
            custom_approver=self.approver,
        )

    def test_approval_assigns_responsible_person_when_mapping_exists(
        self,
    ):
        ResponsiblePersonMapping.objects.create(
            erp_module=self.module,
            voucher_type=self.voucher,
            department=self.department,
            site=self.site,
            work_type=self.work_type,
            priority=self.priority,
            responsible_person=self.responsible_person,
        )
        submitted = self._submit_request(
            "JV-ASSIGN-001"
        )
        step = submitted.approval_steps.get(
            sequence=1
        )

        self.client.force_authenticate(self.approver)
        response = self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/approve/",
            {"comment": "Approved."},
            format="json",
        )
        submitted.refresh_from_db()

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.ASSIGNED,
        )
        self.assertEqual(
            submitted.current_owner_id,
            self.responsible_person.id,
        )
        self.assertTrue(
            submitted.timeline_entries.filter(
                event_type=(
                    CorrectionTimelineEventType.ASSIGNED
                ),
                to_status=(
                    CorrectionRequestStatus.ASSIGNED
                ),
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.responsible_person,
                event_type=(
                    NotificationEventType.REQUEST_ASSIGNED
                ),
                correction_request=submitted,
            ).exists()
        )

    def test_approval_leaves_request_approved_when_no_mapping_exists(
        self,
    ):
        submitted = self._submit_request(
            "JV-ASSIGN-002"
        )
        step = submitted.approval_steps.get(
            sequence=1
        )

        self.client.force_authenticate(self.approver)
        response = self.client.post(
            f"/api/v1/corrections/approvals/{step.id}/approve/",
            {"comment": "Approved."},
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
                    f"Assignment test for {voucher_number}"
                ),
                "reason_category": self.reason,
                "priority": self.priority,
            },
        )
        return submit_request(
            draft=draft,
            user=self.requester,
        )

    def _create_user(self, employee_id, role):
        return User.objects.create_user(
            employee_id=employee_id,
            password="StrongPass123!",
            first_name=employee_id,
            role=role,
            account_status=AccountStatus.ACTIVE,
        )


class ReassignmentApiTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.client = APIClient()
        self.requester = self._create_user(
            "REASREQ001",
            UserRole.USER,
        )
        self.director = self._create_user(
            "REASDIR001",
            UserRole.DIRECTOR,
        )
        self.admin = self._create_user(
            "REASADM001",
            UserRole.ADMIN,
            is_staff=True,
        )
        self.person_a = self._create_user(
            "REASRP001",
            UserRole.RESPONSIBLE_PERSON,
        )
        self.person_b = self._create_user(
            "REASRP002",
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

    def test_admin_can_reassign_in_progress_request(
        self,
    ):
        in_progress = self._in_progress_request(
            "JV-REAS-001"
        )
        self.assertEqual(
            in_progress.current_owner_id,
            self.person_a.id,
        )

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/v1/corrections/requests/{in_progress.id}/reassign/",
            {
                "responsible_person": str(
                    self.person_b.id
                ),
                "reason": (
                    "Person A is on unplanned leave."
                ),
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
            CorrectionRequestStatus.ASSIGNED,
        )
        self.assertEqual(
            in_progress.current_owner_id,
            self.person_b.id,
        )
        timeline_entry = (
            in_progress.timeline_entries.filter(
                metadata__reassigned=True,
            ).latest("created_at")
        )
        self.assertEqual(
            timeline_entry.metadata[
                "previous_owner"
            ],
            str(self.person_a.id),
        )
        self.assertEqual(
            timeline_entry.metadata["reason"],
            "Person A is on unplanned leave.",
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.person_b,
                event_type=(
                    NotificationEventType.REQUEST_ASSIGNED
                ),
                correction_request=in_progress,
            ).exists()
        )

    def test_reassign_requires_a_reason(self):
        in_progress = self._in_progress_request(
            "JV-REAS-002"
        )

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/v1/corrections/requests/{in_progress.id}/reassign/",
            {
                "responsible_person": str(
                    self.person_b.id
                ),
                "reason": "   ",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_cannot_reassign_a_request_not_yet_accepted(
        self,
    ):
        assigned = self._assigned_request(
            "JV-REAS-003"
        )

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/v1/corrections/requests/{assigned.id}/reassign/",
            {
                "responsible_person": str(
                    self.person_b.id
                ),
                "reason": "Too soon.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_requester_cannot_reassign(self):
        in_progress = self._in_progress_request(
            "JV-REAS-004"
        )

        self.client.force_authenticate(
            self.requester
        )
        response = self.client.post(
            f"/api/v1/corrections/requests/{in_progress.id}/reassign/",
            {
                "responsible_person": str(
                    self.person_b.id
                ),
                "reason": "Not authorized.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
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
                    f"Reassignment test for {voucher_number}"
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
