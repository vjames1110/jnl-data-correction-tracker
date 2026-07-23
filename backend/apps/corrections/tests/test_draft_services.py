from datetime import timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import (
    PermissionDenied,
    ValidationError as DrfValidationError,
)

from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)
from apps.corrections.models import (
    CorrectionRequest,
    CorrectionRequestStatus,
)
from apps.corrections.services.drafts import (
    create_draft,
    delete_draft,
    update_draft,
)
from apps.corrections.services.references import (
    generate_request_reference,
)
from apps.erp.models import (
    ErpModule,
    VoucherType,
)
from apps.organization.models import (
    Company,
    Department,
)


class CorrectionDraftServiceTests(TestCase):
    def setUp(self):
        self.requester = User.objects.create_user(
            employee_id="REQ001",
            password="StrongPass123!",
            first_name="Request",
            last_name="User",
            role=UserRole.USER,
            account_status=AccountStatus.ACTIVE,
        )
        self.other_user = User.objects.create_user(
            employee_id="REQ002",
            password="StrongPass123!",
            first_name="Other",
            last_name="User",
            role=UserRole.USER,
            account_status=AccountStatus.ACTIVE,
        )
        self.company = Company.objects.create(
            company_code="JNL",
            company_name="Jhajharia Nirman Limited",
        )
        self.department = Department.objects.create(
            company=self.company,
            department_name="Finance",
        )
        self.module = ErpModule.objects.create(
            module_name="Finance",
        )
        self.voucher = VoucherType.objects.create(
            voucher_name="Journal Voucher",
            erp_module=self.module,
            department=self.department,
        )

    def test_reference_generation_is_year_based_and_sequential(
        self,
    ):
        self.assertEqual(
            generate_request_reference(year=2026),
            "DCT-2026-000001",
        )
        self.assertEqual(
            generate_request_reference(year=2026),
            "DCT-2026-000002",
        )
        self.assertEqual(
            generate_request_reference(year=2027),
            "DCT-2027-000001",
        )

    def test_create_draft_generates_reference_and_owner(
        self,
    ):
        draft = create_draft(
            requester=self.requester,
            data={
                "erp_module": self.module,
                "voucher_type": self.voucher,
                "department": self.department,
                "voucher_number": "JV-001",
                "description": "Amount correction",
            },
        )

        self.assertTrue(
            draft.reference.startswith("DCT-")
        )
        self.assertEqual(
            draft.current_status,
            CorrectionRequestStatus.DRAFT,
        )
        self.assertEqual(
            draft.requester,
            self.requester,
        )
        self.assertEqual(
            draft.current_owner,
            self.requester,
        )
        self.assertFalse(draft.is_deleted)

    def test_update_draft_rejects_non_owner(self):
        draft = create_draft(
            requester=self.requester,
            data={"description": "Initial draft"},
        )

        with self.assertRaises(PermissionDenied):
            update_draft(
                draft=draft,
                user=self.other_user,
                data={"description": "Updated"},
            )

    def test_update_draft_rejects_non_draft_status(
        self,
    ):
        draft = create_draft(
            requester=self.requester,
            data={"description": "Initial draft"},
        )
        draft.current_status = (
            CorrectionRequestStatus.SUBMITTED
        )
        draft.save(update_fields=["current_status"])

        with self.assertRaises(DrfValidationError):
            update_draft(
                draft=draft,
                user=self.requester,
                data={"description": "Updated"},
            )

    def test_delete_draft_soft_deletes_record(self):
        draft = create_draft(
            requester=self.requester,
            data={"description": "Draft to delete"},
        )

        deleted = delete_draft(
            draft=draft,
            user=self.requester,
        )

        self.assertTrue(deleted.is_deleted)
        self.assertEqual(
            deleted.deleted_by,
            self.requester,
        )
        self.assertTrue(
            CorrectionRequest.objects.filter(
                pk=draft.pk
            ).exists()
        )

    def test_model_validates_requested_window_order(
        self,
    ):
        now = timezone.now()
        draft = CorrectionRequest(
            requester=self.requester,
            requested_window_start=now,
            requested_window_end=now
            - timedelta(hours=1),
        )

        with self.assertRaises(ValidationError):
            draft.full_clean()
