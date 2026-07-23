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
from apps.organization.models import (
    ApprovalAuthorityType,
    Company,
    Department,
    DirectorMapping,
    Site,
)


class CorrectionRequestAPIPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = Company.objects.create(
            company_code="JNL",
            company_name="Jhajharia Nirman Limited",
        )
        self.site = Site.objects.create(
            company=self.company,
            site_code="JPR",
            site_name="Jaipur Site",
        )
        self.department = Department.objects.create(
            company=self.company,
            department_name="Finance",
        )
        self.module = ErpModule.objects.create(
            module_name="Finance",
        )
        self.approval_work_type = WorkType.objects.create(
            work_type_name="Amount Correction",
            requires_approval=True,
        )
        self.assignment_work_type = WorkType.objects.create(
            work_type_name="Master Update",
            requires_approval=False,
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
        )
        self.requester = self._create_user(
            employee_id="REQPERM001",
            role=UserRole.USER,
        )
        self.other_user = self._create_user(
            employee_id="REQPERM002",
            role=UserRole.USER,
        )
        self.admin = self._create_user(
            employee_id="ADMPERM001",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.director = self._create_user(
            employee_id="DIRPERM001",
            role=UserRole.DIRECTOR,
        )
        self.responsible_person = self._create_user(
            employee_id="RPPERM001",
            role=UserRole.RESPONSIBLE_PERSON,
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
            work_type=self.approval_work_type,
            priority=self.priority,
            responsible_person=self.responsible_person,
        )
        ResponsiblePersonMapping.objects.create(
            erp_module=self.module,
            voucher_type=self.voucher,
            department=self.department,
            site=self.site,
            work_type=self.assignment_work_type,
            priority=self.priority,
            responsible_person=self.responsible_person,
        )

    def test_request_api_supports_create_detail_my_search_and_filter(
        self,
    ):
        self.client.force_authenticate(self.requester)

        create_response = self.client.post(
            "/api/v1/corrections/requests/",
            {
                "voucher_number": "JV-REQ-001",
                "description": "Filterable draft request",
            },
            format="json",
        )

        self.assertEqual(
            create_response.status_code,
            status.HTTP_201_CREATED,
        )
        request_id = create_response.data["data"]["id"]

        detail_response = self.client.get(
            f"/api/v1/corrections/requests/{request_id}/",
        )
        self.assertEqual(
            detail_response.status_code,
            status.HTTP_200_OK,
        )

        my_response = self.client.get(
            "/api/v1/corrections/requests/my/",
        )
        self.assertEqual(
            my_response.status_code,
            status.HTTP_200_OK,
        )

        search_response = self.client.get(
            "/api/v1/corrections/requests/?search=Filterable",
        )
        self.assertEqual(
            search_response.status_code,
            status.HTTP_200_OK,
        )

        filter_response = self.client.get(
            "/api/v1/corrections/requests/?current_status=DRAFT",
        )
        self.assertEqual(
            filter_response.status_code,
            status.HTTP_200_OK,
        )

    def test_user_cannot_view_or_cancel_other_request(
        self,
    ):
        draft = self._create_complete_draft(
            requester=self.other_user,
            voucher_number="JV-PRIVATE-001",
            work_type=self.approval_work_type,
        )
        self.client.force_authenticate(self.requester)

        detail_response = self.client.get(
            f"/api/v1/corrections/requests/{draft.id}/",
        )
        cancel_response = self.client.post(
            f"/api/v1/corrections/requests/{draft.id}/cancel/",
            {"reason": "Trying to cancel another request"},
            format="json",
        )

        self.assertEqual(
            detail_response.status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            cancel_response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_admin_can_view_all_requests(self):
        first = self._create_complete_draft(
            requester=self.requester,
            voucher_number="JV-ADMIN-001",
            work_type=self.approval_work_type,
        )
        second = self._create_complete_draft(
            requester=self.other_user,
            voucher_number="JV-ADMIN-002",
            work_type=self.approval_work_type,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.get(
            "/api/v1/corrections/requests/",
        )

        references = {
            item["reference"]
            for item in response.data["data"]
        }
        self.assertIn(first.reference, references)
        self.assertIn(second.reference, references)

    def test_director_can_view_authorized_site_request(
        self,
    ):
        submitted = submit_request(
            draft=self._create_complete_draft(
                requester=self.requester,
                voucher_number="JV-DIR-001",
                work_type=self.approval_work_type,
            ),
            user=self.requester,
        )
        self.client.force_authenticate(self.director)

        response = self.client.get(
            f"/api/v1/corrections/requests/{submitted.id}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

    def test_director_cannot_view_unsubmitted_draft(
        self,
    ):
        draft = self._create_complete_draft(
            requester=self.requester,
            voucher_number="JV-DIR-DRAFT-001",
            work_type=self.approval_work_type,
        )
        self.client.force_authenticate(self.director)

        response = self.client.get(
            f"/api/v1/corrections/requests/{draft.id}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_responsible_person_can_view_assignment(
        self,
    ):
        assigned = submit_request(
            draft=self._create_complete_draft(
                requester=self.requester,
                voucher_number="JV-RP-001",
                work_type=self.assignment_work_type,
            ),
            user=self.requester,
        )
        self.client.force_authenticate(
            self.responsible_person
        )

        response = self.client.get(
            f"/api/v1/corrections/requests/{assigned.id}/",
        )

        self.assertEqual(
            assigned.current_status,
            CorrectionRequestStatus.ASSIGNED,
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

    def test_submitted_request_cannot_be_patched_freely(
        self,
    ):
        submitted = submit_request(
            draft=self._create_complete_draft(
                requester=self.requester,
                voucher_number="JV-PATCH-001",
                work_type=self.approval_work_type,
            ),
            user=self.requester,
        )
        self.client.force_authenticate(self.requester)

        response = self.client.patch(
            f"/api/v1/corrections/requests/{submitted.id}/",
            {"description": "Edited after submit"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_requester_can_cancel_and_timeline_records_status_change(
        self,
    ):
        submitted = submit_request(
            draft=self._create_complete_draft(
                requester=self.requester,
                voucher_number="JV-CANCEL-001",
                work_type=self.approval_work_type,
            ),
            user=self.requester,
        )
        self.client.force_authenticate(self.requester)

        response = self.client.post(
            f"/api/v1/corrections/requests/{submitted.id}/cancel/",
            {"reason": "Created by mistake"},
            format="json",
        )
        submitted.refresh_from_db()

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            submitted.current_status,
            CorrectionRequestStatus.CANCELLED,
        )
        self.assertTrue(
            submitted.timeline_entries.filter(
                event_type=(
                    CorrectionTimelineEventType.STATUS_CHANGED
                ),
                to_status=CorrectionRequestStatus.CANCELLED,
            ).exists()
        )

    def _create_user(
        self,
        *,
        employee_id: str,
        role: str,
        is_staff: bool = False,
    ):
        user = User.objects.create_user(
            employee_id=employee_id,
            password="StrongPass123!",
            first_name=employee_id,
            role=role,
            account_status=AccountStatus.ACTIVE,
            is_staff=is_staff,
        )
        EmployeeProfile.objects.create(
            user=user,
            employee_id=user.employee_id,
            first_name=user.first_name,
            role=user.role,
            site=self.site,
            department=self.department,
        )
        return user

    def _create_complete_draft(
        self,
        *,
        requester,
        voucher_number: str,
        work_type,
    ):
        return create_draft(
            requester=requester,
            data={
                "site": self.site,
                "department": self.department,
                "erp_module": self.module,
                "voucher_type": self.voucher,
                "work_type": work_type,
                "voucher_number": voucher_number,
                "voucher_date": timezone.localdate(),
                "erp_email_date": timezone.localdate(),
                "description": (
                    "Correction requested for "
                    f"{voucher_number}"
                ),
                "reason_category": self.reason,
                "priority": self.priority,
            },
        )
