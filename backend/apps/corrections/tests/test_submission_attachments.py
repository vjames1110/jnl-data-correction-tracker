import shutil
import tempfile
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
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
    CorrectionRequestStatus,
    CorrectionTimelineEventType,
)
from apps.corrections.services.attachments import (
    create_attachment,
    delete_attachment,
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
    ApprovalAuthorityType,
    Company,
    Department,
    DirectorMapping,
    Site,
)


TEST_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class CorrectionSubmissionAttachmentTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(
            TEST_MEDIA_ROOT,
            ignore_errors=True,
        )

    def setUp(self):
        self.client = APIClient()
        self.requester = User.objects.create_user(
            employee_id="REQSUB001",
            password="StrongPass123!",
            first_name="Request",
            last_name="User",
            role=UserRole.USER,
            account_status=AccountStatus.ACTIVE,
        )
        self.director = User.objects.create_user(
            employee_id="DIRSUB001",
            password="StrongPass123!",
            first_name="Director",
            last_name="User",
            role=UserRole.DIRECTOR,
            account_status=AccountStatus.ACTIVE,
        )
        self.responsible_person = User.objects.create_user(
            employee_id="RPSUB001",
            password="StrongPass123!",
            first_name="Responsible",
            last_name="User",
            role=UserRole.RESPONSIBLE_PERSON,
            account_status=AccountStatus.ACTIVE,
        )
        self.admin = User.objects.create_user(
            employee_id="ADMSUB001",
            password="StrongPass123!",
            first_name="Admin",
            last_name="User",
            role=UserRole.ADMIN,
            account_status=AccountStatus.ACTIVE,
            is_staff=True,
        )
        self.custom_approver = User.objects.create_user(
            employee_id="CUSSUB001",
            password="StrongPass123!",
            first_name="Custom",
            last_name="Approver",
            role=UserRole.DIRECTOR,
            account_status=AccountStatus.ACTIVE,
        )
        self.company = Company.objects.create(
            company_code="JNL",
            company_name="Jhajharia Nirman Limited",
        )
        self.site = Site.objects.create(
            company=self.company,
            site_code="JPR",
            site_name="Jaipur Site",
        )
        self.remote_site = Site.objects.create(
            company=self.company,
            site_code="BFB",
            site_name="Bengaluru FOB",
        )
        self.department = Department.objects.create(
            company=self.company,
            department_name="Finance",
        )
        EmployeeProfile.objects.create(
            user=self.requester,
            employee_id=self.requester.employee_id,
            first_name=self.requester.first_name,
            last_name=self.requester.last_name,
            role=self.requester.role,
            site=self.site,
            department=self.department,
        )
        self.module = ErpModule.objects.create(
            module_name="Finance",
        )
        self.work_type = WorkType.objects.create(
            work_type_name="Amount Correction",
        )
        self.reason = ReasonCategory.objects.create(
            reason_name="Data Entry Error",
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
            requires_amount=True,
        )
        DirectorMapping.objects.create(
            director=self.director,
            site=self.site,
            authority_type=ApprovalAuthorityType.PRIMARY,
        )
        ResponsiblePersonMapping.objects.create(
            erp_module=self.module,
            voucher_type=self.voucher,
            department=self.department,
            site=self.site,
            work_type=self.work_type,
            priority=self.priority,
            responsible_person=self.responsible_person,
        )
        DirectorMapping.objects.create(
            director=self.director,
            site=self.remote_site,
            authority_type=ApprovalAuthorityType.PRIMARY,
        )
        ResponsiblePersonMapping.objects.create(
            erp_module=self.module,
            voucher_type=self.voucher,
            department=self.department,
            site=self.remote_site,
            work_type=self.work_type,
            priority=self.priority,
            responsible_person=self.responsible_person,
        )

    def test_submit_request_validates_and_moves_to_pending_approval(
        self,
    ):
        draft = self._create_complete_draft("JV-SUB-001")

        submitted = submit_request(
            draft=draft,
            user=self.requester,
        )

        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.PENDING_APPROVAL,
        )
        self.assertEqual(
            submitted.current_owner,
            self.director,
        )
        self.assertIsNotNone(submitted.submitted_at)
        self.assertIsNotNone(submitted.sla_deadline)
        self.assertGreater(
            submitted.sla_deadline,
            timezone.now(),
        )
        self.assertEqual(
            list(
                submitted.timeline_entries.values_list(
                    "event_type",
                    flat=True,
                )
            ),
            [
                CorrectionTimelineEventType.DRAFT_CREATED,
                CorrectionTimelineEventType.SUBMITTED,
            ],
        )
        self.assertEqual(
            submitted.approval_steps.count(),
            2,
        )
        self.assertEqual(
            submitted.approval_steps.get(
                approver_type=ApprovalApproverType.DIRECTOR
            ).approver,
            self.director,
        )
        self.assertEqual(
            submitted.approval_steps.get(
                approver_type=ApprovalApproverType.ADMIN_FINAL
            ).approver,
            self.admin,
        )

    def test_duplicate_open_request_requires_override_reason(
        self,
    ):
        first = self._create_complete_draft("JV-DUP-001")
        submit_request(
            draft=first,
            user=self.requester,
        )
        second = self._create_complete_draft("JV-DUP-001")

        with self.assertRaises(ValidationError):
            submit_request(
                draft=second,
                user=self.requester,
            )

        submitted = submit_request(
            draft=second,
            user=self.requester,
            override_duplicates=True,
            duplicate_override_reason=(
                "Business team confirmed second correction."
            ),
        )

        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.PENDING_APPROVAL,
        )
        self.assertIn(
            "Business team",
            submitted.duplicate_override_reason,
        )

    def test_requester_can_submit_for_different_site(
        self,
    ):
        draft = self._create_complete_draft(
            "JV-REMOTE-001",
            site=self.remote_site,
        )

        submitted = submit_request(
            draft=draft,
            user=self.requester,
        )

        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.PENDING_APPROVAL,
        )
        self.assertEqual(
            submitted.site,
            self.remote_site,
        )

    def test_approval_submit_can_fall_back_to_admin_without_director(
        self,
    ):
        ResponsiblePersonMapping.objects.all().delete()
        DirectorMapping.objects.all().delete()
        draft = self._create_complete_draft(
            "JV-HOD-001",
            site=self.remote_site,
        )

        submitted = submit_request(
            draft=draft,
            user=self.requester,
        )

        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.PENDING_APPROVAL,
        )
        self.assertEqual(
            submitted.current_owner,
            self.admin,
        )

    def test_submit_snapshots_configured_approval_route(
        self,
    ):
        policy = ApprovalWorkflowPolicy.objects.create(
            policy_name="High Amount Finance Approval",
            department=self.department,
            erp_module=self.module,
            voucher_type=self.voucher,
            work_type=self.work_type,
            priority=self.priority,
            amount_min=Decimal("50.00"),
        )
        ApprovalWorkflowLevel.objects.create(
            workflow_policy=policy,
            sequence=1,
            level_name="Custom review",
            approver_type=ApprovalApproverType.CUSTOM,
            custom_approver=self.custom_approver,
            sla_hours=6,
            escalation_hours=3,
        )
        ApprovalWorkflowLevel.objects.create(
            workflow_policy=policy,
            sequence=2,
            level_name="Director signoff",
            approver_type=ApprovalApproverType.DIRECTOR,
        )
        draft = self._create_complete_draft(
            "JV-POLICY-001"
        )

        submitted = submit_request(
            draft=draft,
            user=self.requester,
        )
        steps = list(
            submitted.approval_steps.order_by(
                "sequence"
            )
        )

        # A two-level policy now actually drives a sequential route:
        # step 1 is the configured CUSTOM approver, and step 2 (the
        # DIRECTOR level) only becomes current once step 1 is
        # decided - it isn't reachable yet, so its SLA clock hasn't
        # started.
        self.assertEqual(len(steps), 2)
        self.assertEqual(
            submitted.current_owner,
            self.custom_approver,
        )
        self.assertEqual(
            steps[0].status,
            ApprovalStepStatus.PENDING,
        )
        self.assertTrue(steps[0].is_current)
        self.assertFalse(steps[1].is_current)
        self.assertEqual(
            steps[0].policy_name_snapshot,
            "High Amount Finance Approval",
        )
        self.assertEqual(
            steps[0].approver_employee_id_snapshot,
            "CUSSUB001",
        )
        self.assertEqual(
            steps[1].approver_employee_id_snapshot,
            "DIRSUB001",
        )
        self.assertIsNotNone(steps[0].due_at)
        self.assertIsNotNone(steps[0].escalates_at)
        self.assertIsNone(steps[1].due_at)
        self.assertIsNone(steps[1].escalates_at)

        policy.policy_name = "Renamed Policy"
        policy.save()
        self.custom_approver.first_name = "Changed"
        self.custom_approver.save()
        steps[0].refresh_from_db()

        self.assertEqual(
            steps[0].policy_name_snapshot,
            "High Amount Finance Approval",
        )
        self.assertEqual(
            steps[0].approver_name_snapshot,
            "Custom Approver",
        )

    def test_attachment_upload_validation_and_download_api(
        self,
    ):
        draft = self._create_complete_draft("JV-ATT-001")
        pdf = SimpleUploadedFile(
            "proof.pdf",
            b"%PDF-1.4 test",
            content_type="application/pdf",
        )

        attachment = create_attachment(
            request=draft,
            user=self.requester,
            file=pdf,
            attachment_type="SUPPORTING_DOCUMENT",
        )

        self.assertEqual(
            attachment.original_name,
            "proof.pdf",
        )
        self.assertTrue(
            draft.timeline_entries.filter(
                event_type=(
                    CorrectionTimelineEventType.ATTACHMENT_ADDED
                )
            ).exists()
        )

        with self.assertRaises(ValidationError):
            create_attachment(
                request=draft,
                user=self.requester,
                file=SimpleUploadedFile(
                    "script.exe",
                    b"bad",
                    content_type="application/octet-stream",
                ),
                attachment_type="SUPPORTING_DOCUMENT",
            )

        self.client.force_authenticate(self.requester)
        download_response = self.client.get(
            f"/api/v1/corrections/attachments/{attachment.id}/download/",
        )

        self.assertEqual(
            download_response.status_code,
            status.HTTP_200_OK,
        )

    def test_attachment_cannot_be_added_to_a_closed_request(
        self,
    ):
        draft = self._create_complete_draft(
            "JV-ATT-002"
        )
        draft.current_status = (
            CorrectionRequestStatus.CLOSED
        )
        draft.save(
            update_fields=["current_status"]
        )

        with self.assertRaises(ValidationError):
            create_attachment(
                request=draft,
                user=self.requester,
                file=SimpleUploadedFile(
                    "proof.pdf",
                    b"%PDF-1.4 test",
                    content_type="application/pdf",
                ),
                attachment_type="SUPPORTING_DOCUMENT",
            )

    def test_attachment_cannot_be_deleted_from_a_closed_request(
        self,
    ):
        draft = self._create_complete_draft(
            "JV-ATT-003"
        )
        attachment = create_attachment(
            request=draft,
            user=self.requester,
            file=SimpleUploadedFile(
                "proof.pdf",
                b"%PDF-1.4 test",
                content_type="application/pdf",
            ),
            attachment_type="SUPPORTING_DOCUMENT",
        )
        draft.current_status = (
            CorrectionRequestStatus.CLOSED
        )
        draft.save(
            update_fields=["current_status"]
        )

        with self.assertRaises(ValidationError):
            delete_attachment(
                attachment=attachment,
                user=self.requester,
            )

    def test_submit_rejects_inactive_work_type(
        self,
    ):
        self.work_type.is_active = False
        self.work_type.save(
            update_fields=["is_active"]
        )
        draft = self._create_complete_draft(
            "JV-ATT-004"
        )

        with self.assertRaises(ValidationError) as ctx:
            submit_request(
                draft=draft,
                user=self.requester,
            )

        self.assertIn(
            "work_type", ctx.exception.detail
        )

    def _create_complete_draft(
        self,
        voucher_number: str,
        site=None,
    ):
        return create_draft(
            requester=self.requester,
            data={
                "site": site or self.site,
                "department": self.department,
                "erp_module": self.module,
                "voucher_type": self.voucher,
                "work_type": self.work_type,
                "voucher_number": voucher_number,
                "voucher_date": timezone.localdate(),
                "erp_email_date": timezone.localdate(),
                "description": (
                    "Amount correction requested for "
                    f"{voucher_number}"
                ),
                "reason_category": self.reason,
                "priority": self.priority,
                "amount": "100.00",
            },
        )
