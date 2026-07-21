import csv
import io
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import (
    SimpleUploadedFile,
)
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
)

from apps.authentication.api.tokens import (
    ApplicationTokenSerializer,
)
from apps.authentication.models import (
    AccountStatus,
    LoginEventType,
    LoginHistory,
    UserRole,
)
from apps.authentication.tests.factories import (
    AdminUserFactory,
    UserFactory,
)
from apps.employees.models import EmployeeProfile
from apps.organization.models import (
    Company,
    Department,
    Designation,
    Site,
)


@pytest.fixture
def admin_client():
    user = AdminUserFactory()
    client = APIClient()
    client.force_authenticate(user=user)

    return client


@pytest.fixture
def organization_context():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    site = Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )
    department = Department.objects.create(
        company=company,
        department_code="FIN",
        department_name="Finance",
    )
    designation = Designation.objects.create(
        designation_code="HOD",
        designation_name="Head of Department",
    )

    return {
        "company": company,
        "site": site,
        "department": department,
        "designation": designation,
    }


def csv_upload(rows, filename="employees.csv"):
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
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
        ],
    )
    writer.writeheader()
    writer.writerows(rows)

    return SimpleUploadedFile(
        filename,
        output.getvalue().encode("utf-8"),
        content_type="text/csv",
    )


def employee_row(**overrides):
    row = {
        "employee_id": "EMP001",
        "first_name": "Asha",
        "last_name": "Sharma",
        "email": "asha.sharma@jnl.com",
        "mobile": "9876543210",
        "gender": "FEMALE",
        "date_of_joining": "2026-07-21",
        "employment_status": "CONFIRMED",
        "site_code": "BKN",
        "department_code": "FIN",
        "designation_code": "HOD",
        "reporting_manager_employee_id": "",
        "role": "USER",
        "is_active": "true",
        "erp_user_id": "ERP001",
        "last_working_date": "",
    }
    row.update(overrides)

    return row


@pytest.mark.django_db
def test_employee_csv_template_downloads(admin_client):
    response = admin_client.get(
        reverse(
            "employees-api:profiles-import-template"
        )
    )

    assert response.status_code == status.HTTP_200_OK
    assert response["Content-Type"] == "text/csv"
    assert b"employee_id" in response.content


@pytest.mark.django_db
def test_employee_import_preview_reports_duplicates_and_mapping_errors(
    admin_client,
    organization_context,
):
    upload = csv_upload(
        [
            employee_row(employee_id="EMP001"),
            employee_row(
                employee_id="EMP001",
                site_code="UNKNOWN",
            ),
        ]
    )

    response = admin_client.post(
        reverse(
            "employees-api:profiles-import-preview"
        ),
        {"file": upload},
        format="multipart",
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.data["data"]
    assert data["summary"]["total_rows"] == 2
    assert data["summary"]["failed_rows"] == 2
    assert any(
        "Duplicate Employee ID" in error
        for failed_row in data["failed_rows"]
        for error in failed_row["errors"]
    )
    assert any(
        "Site mapping not found" in error
        for failed_row in data["failed_rows"]
        for error in failed_row["errors"]
    )


@pytest.mark.django_db
def test_employee_import_creates_valid_profiles(
    admin_client,
    organization_context,
):
    upload = csv_upload([employee_row()])

    response = admin_client.post(
        reverse("employees-api:profiles-import"),
        {"file": upload},
        format="multipart",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert (
        response.data["data"]["summary"][
            "created_rows"
        ]
        == 1
    )
    profile = EmployeeProfile.objects.get(
        employee_id="EMP001"
    )
    assert profile.site == organization_context["site"]
    assert (
        profile.department
        == organization_context["department"]
    )
    assert (
        profile.designation
        == organization_context["designation"]
    )


@pytest.mark.django_db
def test_failed_row_export_returns_csv(admin_client):
    response = admin_client.post(
        reverse(
            "employees-api:profiles-failed-rows-export"
        ),
        {
            "failed_rows": [
                {
                    "row_number": 2,
                    "row": employee_row(),
                    "errors": ["Invalid mapping"],
                }
            ]
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response["Content-Type"] == "text/csv"
    assert b"Invalid mapping" in response.content


@pytest.mark.django_db
def test_admin_can_create_employee_user_account(
    admin_client,
):
    profile = EmployeeProfile.objects.create(
        employee_id="EMP002",
        first_name="Ravi",
        last_name="Verma",
        email="ravi.verma@jnl.com",
        role=UserRole.USER,
    )

    response = admin_client.post(
        reverse(
            "employees-api:profiles-create-account",
            args=[profile.id],
        ),
        {
            "role": UserRole.RESPONSIBLE_PERSON,
            "send_notification": True,
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    profile.refresh_from_db()
    assert profile.user is not None
    assert (
        profile.user.role
        == UserRole.RESPONSIBLE_PERSON
    )
    assert profile.user.must_change_password is True
    assert response.data["data"]["temporary_password"]
    assert (
        response.data["data"]["notification"]["sent"]
        is True
    )


@pytest.mark.django_db
def test_account_actions_update_existing_user(
    admin_client,
):
    user = UserFactory(
        employee_id="EMP003",
        first_name="Neha",
        last_name="Singh",
        email="neha.singh@jnl.com",
        role=UserRole.USER,
    )
    profile = EmployeeProfile.objects.create(
        user=user,
        employee_id="EMP003",
        first_name="Neha",
        last_name="Singh",
        email="neha.singh@jnl.com",
        role=UserRole.USER,
    )
    user.account_status = AccountStatus.LOCKED
    user.locked_until = (
        timezone.now() + timedelta(minutes=10)
    )
    user.failed_login_attempts = 5
    user.save()

    reset_response = admin_client.post(
        reverse(
            "employees-api:profiles-reset-password",
            args=[profile.id],
        )
    )
    assert reset_response.status_code == status.HTTP_200_OK
    assert reset_response.data["data"][
        "temporary_password"
    ]

    unlock_response = admin_client.post(
        reverse(
            "employees-api:profiles-unlock",
            args=[profile.id],
        )
    )
    assert unlock_response.status_code == status.HTTP_200_OK
    user.refresh_from_db()
    assert user.failed_login_attempts == 0
    assert user.locked_until is None

    suspend_response = admin_client.post(
        reverse(
            "employees-api:profiles-suspend",
            args=[profile.id],
        )
    )
    assert suspend_response.status_code == status.HTTP_200_OK
    user.refresh_from_db()
    assert (
        user.account_status
        == AccountStatus.SUSPENDED
    )
    assert user.is_active is False

    reactivate_response = admin_client.post(
        reverse(
            "employees-api:profiles-reactivate",
            args=[profile.id],
        )
    )
    assert (
        reactivate_response.status_code
        == status.HTTP_200_OK
    )
    user.refresh_from_db()
    assert user.account_status == AccountStatus.ACTIVE
    assert user.is_active is True

    role_response = admin_client.post(
        reverse(
            "employees-api:profiles-change-role",
            args=[profile.id],
        ),
        {"role": UserRole.ADMIN},
        format="json",
    )
    assert role_response.status_code == status.HTTP_200_OK
    user.refresh_from_db()
    profile.refresh_from_db()
    assert user.role == UserRole.ADMIN
    assert profile.role == UserRole.ADMIN
    assert user.is_staff is True


@pytest.mark.django_db
def test_revoke_sessions_blacklists_outstanding_tokens(
    admin_client,
):
    user = UserFactory(
        employee_id="EMP004",
        first_name="Token",
        last_name="User",
    )
    profile = EmployeeProfile.objects.create(
        user=user,
        employee_id="EMP004",
        first_name="Token",
        last_name="User",
    )
    refresh = ApplicationTokenSerializer.get_token(
        user
    )
    str(refresh)

    response = admin_client.post(
        reverse(
            "employees-api:profiles-revoke-sessions",
            args=[profile.id],
        )
    )

    assert response.status_code == status.HTTP_200_OK
    assert (
        response.data["data"]["revoked_sessions"]
        >= 1
    )
    assert BlacklistedToken.objects.filter(
        token__user=user
    ).exists()


@pytest.mark.django_db
def test_login_history_action_returns_user_events(
    admin_client,
):
    user = UserFactory(
        employee_id="EMP005",
        first_name="History",
        last_name="User",
    )
    profile = EmployeeProfile.objects.create(
        user=user,
        employee_id="EMP005",
        first_name="History",
        last_name="User",
    )
    LoginHistory.objects.create(
        user=user,
        employee_id_attempted=user.employee_id,
        event_type=LoginEventType.LOGIN_SUCCESS,
        was_successful=True,
    )

    response = admin_client.get(
        reverse(
            "employees-api:profiles-login-history",
            args=[profile.id],
        )
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["data"][0]["event_type"] == (
        LoginEventType.LOGIN_SUCCESS
    )
