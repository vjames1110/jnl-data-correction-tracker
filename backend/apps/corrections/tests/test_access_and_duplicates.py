from django.test import TestCase

from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)
from apps.corrections.models import (
    CorrectionRequest,
    CorrectionRequestStatus,
)
from apps.corrections.services.access import (
    can_access_request,
)
from apps.corrections.services.duplicates import (
    find_duplicate_requests,
)
from apps.erp.models import (
    ErpModule,
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


def _create_user(employee_id, role):
    return User.objects.create_user(
        employee_id=employee_id,
        password="StrongPass123!",
        first_name=employee_id,
        role=role,
        account_status=AccountStatus.ACTIVE,
    )


class DirectorAccessWildcardTests(TestCase):
    """
    A DirectorMapping scoped to only one of site/department must not
    grant access to a request that matches neither - a bare
    Q(field=request.field) with a null request field previously
    matched any mapping whose own field was also null.
    """

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
        self.other_department = (
            Department.objects.create(
                company=self.company,
                department_name="HR",
            )
        )
        self.requester = _create_user(
            "ACCREQ001", UserRole.USER
        )
        self.director = _create_user(
            "ACCDIR001", UserRole.DIRECTOR
        )

    def test_department_only_mapping_does_not_grant_access_to_siteless_request(
        self,
    ):
        DirectorMapping.objects.create(
            director=self.director,
            department=self.other_department,
            authority_type=(
                ApprovalAuthorityType.PRIMARY
            ),
        )
        request = CorrectionRequest.objects.create(
            requester=self.requester,
            current_status=CorrectionRequestStatus.SUBMITTED,
        )

        self.assertFalse(
            can_access_request(
                request=request,
                user=self.director,
            )
        )

    def test_site_only_mapping_does_not_grant_access_to_departmentless_request(
        self,
    ):
        DirectorMapping.objects.create(
            director=self.director,
            site=self.site,
            authority_type=(
                ApprovalAuthorityType.PRIMARY
            ),
        )
        request = CorrectionRequest.objects.create(
            requester=self.requester,
            current_status=CorrectionRequestStatus.SUBMITTED,
        )

        self.assertFalse(
            can_access_request(
                request=request,
                user=self.director,
            )
        )

    def test_matching_site_mapping_still_grants_access(
        self,
    ):
        DirectorMapping.objects.create(
            director=self.director,
            site=self.site,
            authority_type=(
                ApprovalAuthorityType.PRIMARY
            ),
        )
        request = CorrectionRequest.objects.create(
            requester=self.requester,
            site=self.site,
            current_status=CorrectionRequestStatus.SUBMITTED,
        )

        self.assertTrue(
            can_access_request(
                request=request,
                user=self.director,
            )
        )


class DuplicateDetectionScoringTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            company_code="JNL",
            company_name="Jhajharia Nirman Limited",
        )
        self.module = ErpModule.objects.create(
            module_name="Finance",
        )
        self.voucher = VoucherType.objects.create(
            voucher_name="Journal Voucher",
            erp_module=self.module,
        )
        self.other_voucher = (
            VoucherType.objects.create(
                voucher_name="Payment Voucher",
                erp_module=self.module,
            )
        )
        self.work_type = WorkType.objects.create(
            work_type_name="Amount Correction",
            requires_approval=True,
        )
        self.requester = _create_user(
            "DUPREQ001", UserRole.USER
        )

    def test_voucher_type_reason_not_credited_when_request_has_none(
        self,
    ):
        request = CorrectionRequest.objects.create(
            requester=self.requester,
            work_type=self.work_type,
            current_status=CorrectionRequestStatus.SUBMITTED,
        )
        # A candidate with a different voucher type than the
        # (unset) request voucher type - previously always scored
        # "Same voucher type" regardless.
        CorrectionRequest.objects.create(
            requester=self.requester,
            voucher_type=self.other_voucher,
            work_type=self.work_type,
            current_status=CorrectionRequestStatus.SUBMITTED,
        )

        matches = find_duplicate_requests(
            request=request
        )

        for match in matches:
            self.assertNotIn(
                "Same voucher type",
                match["reasons"],
            )

    def test_voucher_type_reason_credited_when_it_matches(
        self,
    ):
        request = CorrectionRequest.objects.create(
            requester=self.requester,
            voucher_type=self.voucher,
            voucher_number="JV-0001",
            work_type=self.work_type,
            current_status=CorrectionRequestStatus.SUBMITTED,
        )
        CorrectionRequest.objects.create(
            requester=self.requester,
            voucher_type=self.voucher,
            voucher_number="JV-0001",
            work_type=self.work_type,
            current_status=CorrectionRequestStatus.SUBMITTED,
        )

        matches = find_duplicate_requests(
            request=request
        )

        self.assertTrue(matches)
        self.assertIn(
            "Same voucher type",
            matches[0]["reasons"],
        )
