"""
The Director manages users and organisation setup like an Admin does,
with one hard line: a Director can never create, promote or touch a
Super Admin account (otherwise a Director could take over the system).
"""

import csv
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.models import (
    AccountStatus,
    UserRole,
)
from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ProjectManagerUserFactory,
    SuperAdminUserFactory,
    UserFactory,
)
from apps.employees.models import EmployeeProfile
from apps.organization.models import (
    Company,
    Department,
    Designation,
    Site,
)

FORBIDDEN = status.HTTP_403_FORBIDDEN


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def profile_with_account(role, employee_id):
    user = UserFactory(
        employee_id=employee_id,
        first_name="Some",
        last_name="Person",
        role=role,
    )
    return EmployeeProfile.objects.create(
        user=user,
        employee_id=employee_id,
        first_name="Some",
        last_name="Person",
        role=role,
    )


def profile_without_account(employee_id="EMP-NEW"):
    return EmployeeProfile.objects.create(
        employee_id=employee_id,
        first_name="New",
        last_name="Joiner",
        email="new.joiner@jnl.com",
        role=UserRole.USER,
    )


def action_url(name, profile):
    return reverse(
        f"employees-api:profiles-{name}", args=[profile.id]
    )


@pytest.mark.django_db
class TestDirectorManagesUsers:
    def test_director_creates_an_employee_profile(self):
        response = client_for(DirectorUserFactory()).post(
            reverse("employees-api:profiles-list"),
            {
                "employee_id": "EMP-D1",
                "first_name": "Made",
                "last_name": "ByDirector",
                "email": "made.bydirector@jnl.com",
                "role": UserRole.USER,
                "employment_status": "CONFIRMED",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED

    def test_director_sees_inactive_employees_like_an_admin(self):
        profile = profile_without_account("EMP-INACTIVE")
        profile.is_active = False
        profile.save()

        response = client_for(DirectorUserFactory()).get(
            reverse("employees-api:profiles-list")
        )

        ids = {row["employee_id"] for row in response.data["data"]}
        assert "EMP-INACTIVE" in ids

    def test_director_creates_an_account_and_runs_the_account_actions(
        self,
    ):
        client = client_for(DirectorUserFactory())
        profile = profile_without_account()

        created = client.post(
            action_url("create-account", profile),
            {
                "role": UserRole.PROJECT_INCHARGE,
                "send_notification": False,
            },
            format="json",
        )
        assert created.status_code == status.HTTP_201_CREATED
        profile.refresh_from_db()
        assert profile.user.role == UserRole.PROJECT_INCHARGE
        user = profile.user

        for name in ("reset-password", "unlock", "revoke-sessions"):
            response = client.post(action_url(name, profile))
            assert response.status_code == status.HTTP_200_OK, name

        assert (
            client.post(action_url("suspend", profile)).status_code
            == status.HTTP_200_OK
        )
        user.refresh_from_db()
        assert user.account_status == AccountStatus.SUSPENDED

        assert (
            client.post(action_url("reactivate", profile)).status_code
            == status.HTTP_200_OK
        )
        changed = client.post(
            action_url("change-role", profile),
            {"role": UserRole.PROJECT_MANAGER},
            format="json",
        )
        assert changed.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.role == UserRole.PROJECT_MANAGER


@pytest.mark.django_db
class TestDirectorCannotTouchSuperAdmins:
    def test_cannot_create_a_super_admin_profile(self):
        response = client_for(DirectorUserFactory()).post(
            reverse("employees-api:profiles-list"),
            {
                "employee_id": "EMP-SA",
                "first_name": "Sneaky",
                "last_name": "Promotion",
                "email": "sneaky@jnl.com",
                "role": UserRole.SUPER_ADMIN,
                "employment_status": "CONFIRMED",
            },
            format="json",
        )

        assert response.status_code == FORBIDDEN
        assert not EmployeeProfile.objects.filter(
            employee_id="EMP-SA"
        ).exists()

    def test_cannot_create_a_super_admin_account(self):
        profile = profile_without_account()

        response = client_for(DirectorUserFactory()).post(
            action_url("create-account", profile),
            {
                "role": UserRole.SUPER_ADMIN,
                "send_notification": False,
            },
            format="json",
        )

        assert response.status_code == FORBIDDEN
        profile.refresh_from_db()
        assert profile.user_id is None

    def test_cannot_promote_someone_to_super_admin(self):
        profile = profile_with_account(UserRole.USER, "EMP-PROMO")

        response = client_for(DirectorUserFactory()).post(
            action_url("change-role", profile),
            {"role": UserRole.SUPER_ADMIN},
            format="json",
        )

        assert response.status_code == FORBIDDEN
        profile.user.refresh_from_db()
        assert profile.user.role == UserRole.USER

    def test_cannot_promote_through_a_profile_edit(self):
        profile = profile_with_account(UserRole.USER, "EMP-EDIT")

        response = client_for(DirectorUserFactory()).patch(
            reverse(
                "employees-api:profiles-detail", args=[profile.id]
            ),
            {"role": UserRole.SUPER_ADMIN},
            format="json",
        )

        assert response.status_code == FORBIDDEN
        profile.refresh_from_db()
        assert profile.role == UserRole.USER

    def test_cannot_edit_a_super_admins_profile(self):
        profile = profile_with_account(
            UserRole.SUPER_ADMIN, "EMP-ROOT"
        )

        response = client_for(DirectorUserFactory()).patch(
            reverse(
                "employees-api:profiles-detail", args=[profile.id]
            ),
            {"last_name": "Renamed"},
            format="json",
        )

        assert response.status_code == FORBIDDEN
        profile.refresh_from_db()
        assert profile.last_name == "Person"

    @pytest.mark.parametrize(
        "name",
        [
            "reset-password",
            "unlock",
            "suspend",
            "reactivate",
            "revoke-sessions",
            "deactivate",
            "activate",
        ],
    )
    def test_cannot_run_account_actions_on_a_super_admin(self, name):
        profile = profile_with_account(
            UserRole.SUPER_ADMIN, "EMP-ROOT2"
        )
        password_before = profile.user.password

        response = client_for(DirectorUserFactory()).post(
            action_url(name, profile)
        )

        assert response.status_code == FORBIDDEN
        profile.user.refresh_from_db()
        assert profile.user.password == password_before
        assert profile.user.is_active is True
        assert profile.user.account_status == AccountStatus.ACTIVE

    def test_cannot_demote_a_super_admin(self):
        profile = profile_with_account(
            UserRole.SUPER_ADMIN, "EMP-ROOT3"
        )

        response = client_for(DirectorUserFactory()).post(
            action_url("change-role", profile),
            {"role": UserRole.USER},
            format="json",
        )

        assert response.status_code == FORBIDDEN
        profile.user.refresh_from_db()
        assert profile.user.role == UserRole.SUPER_ADMIN


IMPORT_COLUMNS = [
    "employee_id",
    "first_name",
    "last_name",
    "email",
    "mobile",
    "gender",
    "date_of_joining",
    "employment_status",
    "site_code",
    "department_code",
    "designation_code",
    "reporting_manager_employee_id",
    "role",
    "is_active",
    "erp_user_id",
    "last_working_date",
]


def import_file(rows):
    company = Company.objects.create(
        company_code="JNL", company_name="Jhajharia Nirman Limited"
    )
    Site.objects.create(
        company=company, site_code="BKN", site_name="Bikaner Site"
    )
    Department.objects.create(
        company=company,
        department_code="FIN",
        department_name="Finance",
    )
    Designation.objects.create(
        designation_code="HOD", designation_name="Head"
    )

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=IMPORT_COLUMNS)
    writer.writeheader()
    for index, role in enumerate(rows, start=1):
        writer.writerow(
            {
                "employee_id": f"IMP{index:03d}",
                "first_name": "Imported",
                "last_name": f"Person{index}",
                "email": f"imported{index}@jnl.com",
                "mobile": "",
                "gender": "FEMALE",
                "date_of_joining": "2026-07-21",
                "employment_status": "CONFIRMED",
                "site_code": "BKN",
                "department_code": "FIN",
                "designation_code": "HOD",
                "reporting_manager_employee_id": "",
                "role": role,
                "is_active": "true",
                "erp_user_id": "",
                "last_working_date": "",
            }
        )
    return SimpleUploadedFile(
        "employees.csv",
        output.getvalue().encode("utf-8"),
        content_type="text/csv",
    )


@pytest.mark.django_db
class TestBulkImport:
    def test_director_cannot_import_a_super_admin_profile(self):
        client = client_for(DirectorUserFactory())

        response = client.post(
            reverse("employees-api:profiles-import"),
            {"file": import_file([UserRole.USER, UserRole.SUPER_ADMIN])},
            format="multipart",
        )

        assert response.status_code == status.HTTP_201_CREATED
        summary = response.data["data"]["summary"]
        assert summary["created_rows"] == 1
        assert summary["failed_rows"] == 1
        assert EmployeeProfile.objects.filter(
            employee_id="IMP001"
        ).exists()
        assert not EmployeeProfile.objects.filter(
            employee_id="IMP002"
        ).exists()

    def test_the_preview_flags_the_same_row(self):
        client = client_for(DirectorUserFactory())

        response = client.post(
            reverse("employees-api:profiles-import-preview"),
            {"file": import_file([UserRole.SUPER_ADMIN])},
            format="multipart",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["summary"]["failed_rows"] == 1

    def test_a_super_admin_can_still_import_any_role(self):
        client = client_for(SuperAdminUserFactory())

        response = client.post(
            reverse("employees-api:profiles-import"),
            {"file": import_file([UserRole.USER, UserRole.SUPER_ADMIN])},
            format="multipart",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["data"]["summary"]["created_rows"] == 2


@pytest.mark.django_db
class TestOtherRolesAreUnchanged:
    def test_a_super_admin_manages_super_admin_accounts(self):
        profile = profile_without_account()

        response = client_for(SuperAdminUserFactory()).post(
            action_url("create-account", profile),
            {
                "role": UserRole.SUPER_ADMIN,
                "send_notification": False,
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED

    def test_an_admin_keeps_the_rights_it_had(self):
        target = profile_with_account(UserRole.USER, "EMP-ADM")

        response = client_for(AdminUserFactory()).post(
            action_url("change-role", target),
            {"role": UserRole.DIRECTOR},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.parametrize(
        "factory", [UserFactory, ProjectManagerUserFactory]
    )
    def test_other_roles_still_cannot_manage_users(self, factory):
        profile = profile_without_account()
        client = client_for(factory())

        assert (
            client.post(
                reverse("employees-api:profiles-list"),
                {"employee_id": "EMP-X", "first_name": "X"},
                format="json",
            ).status_code
            == FORBIDDEN
        )
        assert (
            client.post(
                action_url("create-account", profile),
                {"role": UserRole.USER},
                format="json",
            ).status_code
            == FORBIDDEN
        )
