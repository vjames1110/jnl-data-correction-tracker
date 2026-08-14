from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)
from apps.organization.models import (
    Company,
    Department,
    Site,
)


def _create_user(employee_id, role, **extra):
    return User.objects.create_user(
        employee_id=employee_id,
        password="StrongPass123!",
        first_name=employee_id,
        role=role,
        account_status=AccountStatus.ACTIVE,
        **extra,
    )


class SitePmFieldTests(TestCase):
    def setUp(self):
        self.requester = _create_user(
            "SPMREQ001",
            UserRole.USER,
        )
        self.site_pm = _create_user(
            "SPMPM001",
            UserRole.USER,
        )
        self.company = Company.objects.create(
            company_code="JNL",
            company_name="Jhajharia Nirman Limited",
        )
        self.site = Site.objects.create(
            company=self.company,
            site_code="JPR",
            site_name="Jaipur Site",
            site_hod=self.site_pm,
        )
        self.department = Department.objects.create(
            company=self.company,
            department_name="Finance",
        )

    def test_draft_api_exposes_site_pm_from_site_hod(
        self,
    ):
        client = APIClient()
        client.force_authenticate(self.requester)

        response = client.post(
            "/api/v1/corrections/requests/",
            {
                "site": str(self.site.id),
                "department": str(self.department.id),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )
        data = response.json()["data"]
        self.assertEqual(
            data["site_pm_employee_id"],
            self.site_pm.employee_id,
        )
        self.assertEqual(
            data["site_pm_name"],
            self.site_pm.full_name,
        )
