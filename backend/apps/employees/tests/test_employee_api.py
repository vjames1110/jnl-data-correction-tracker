import csv
import io
from datetime import date, timedelta

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
    DirectorUserFactory,
    UserFactory,
)
from apps.employees.models import EmployeeProfile
from apps.organization.models import (
    Company,
    Department,
    Designation,
    DirectorMapping,
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


def response_ids(response):
    return {
        item["employee_id"]
        for item in response.data["data"]
    }


@pytest.mark.django_db
def test_employee_list_detail_create_update_activate_deactivate(
    admin_client,
    organization_context,
):
    create_response = admin_client.post(
        reverse("employees-api:profiles-list"),
        {
            "employee_id": "EMP_LIST_001",
            "first_name": "List",
            "last_name": "User",
            "email": "list.user@jnl.com",
            "site": str(
                organization_context["site"].id
            ),
            "department": str(
                organization_context[
                    "department"
                ].id
            ),
            "designation": str(
                organization_context[
                    "designation"
                ].id
            ),
            "role": UserRole.USER,
            "employment_status": "CONFIRMED",
        },
        format="json",
    )

    assert (
        create_response.status_code
        == status.HTTP_201_CREATED
    )
    profile_id = create_response.data["data"]["id"]

    detail_response = admin_client.get(
        reverse(
            "employees-api:profiles-detail",
            args=[profile_id],
        )
    )
    assert detail_response.status_code == status.HTTP_200_OK
    assert (
        detail_response.data["data"]["employee_id"]
        == "EMP_LIST_001"
    )

    update_response = admin_client.patch(
        reverse(
            "employees-api:profiles-detail",
            args=[profile_id],
        ),
        {"last_name": "Updated"},
        format="json",
    )
    assert update_response.status_code == status.HTTP_200_OK
    assert (
        update_response.data["data"]["last_name"]
        == "Updated"
    )

    deactivate_response = admin_client.post(
        reverse(
            "employees-api:profiles-deactivate",
            args=[profile_id],
        )
    )
    assert (
        deactivate_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        deactivate_response.data["data"]["is_active"]
        is False
    )

    activate_response = admin_client.post(
        reverse(
            "employees-api:profiles-activate",
            args=[profile_id],
        )
    )
    assert activate_response.status_code == status.HTTP_200_OK
    assert (
        activate_response.data["data"]["is_active"]
        is True
    )


@pytest.mark.django_db
def test_employee_filters_selectors_and_exports(
    admin_client,
    organization_context,
):
    manager = EmployeeProfile.objects.create(
        employee_id="MGR001",
        first_name="Reporting",
        last_name="Manager",
    )
    user = UserFactory(
        employee_id="EMP_FILTER_001",
        first_name="Filter",
        last_name="Match",
        email="filter.match@jnl.com",
        role=UserRole.USER,
    )
    match = EmployeeProfile.objects.create(
        user=user,
        employee_id="EMP_FILTER_001",
        first_name="Filter",
        last_name="Match",
        email="filter.match@jnl.com",
        site=organization_context["site"],
        department=organization_context["department"],
        designation=organization_context["designation"],
        reporting_manager=manager,
        role=UserRole.USER,
        employment_status="CONFIRMED",
    )
    suspended_user = UserFactory(
        employee_id="EMP_FILTER_002",
        first_name="Suspended",
        last_name="User",
        email="suspended.user@jnl.com",
        role=UserRole.ADMIN,
        account_status=AccountStatus.SUSPENDED,
        is_active=False,
    )
    suspended = EmployeeProfile.objects.create(
        user=suspended_user,
        employee_id="EMP_FILTER_002",
        first_name="Suspended",
        last_name="User",
        email="suspended.user@jnl.com",
        role=UserRole.ADMIN,
        employment_status="RELIEVED",
    )
    director = DirectorUserFactory(
        employee_id="DIR_FILTER",
        first_name="Director",
        last_name="Filter",
    )
    mapping = DirectorMapping.objects.create(
        director=director,
        site=organization_context["site"],
        department=organization_context[
            "department"
        ],
        effective_from=date(2026, 7, 21),
    )

    filter_cases = [
        (
            {"site": str(organization_context["site"].id)},
            {"EMP_FILTER_001"},
        ),
        (
            {
                "department": str(
                    organization_context[
                        "department"
                    ].id
                )
            },
            {"EMP_FILTER_001"},
        ),
        (
            {
                "designation": str(
                    organization_context[
                        "designation"
                    ].id
                )
            },
            {"EMP_FILTER_001"},
        ),
        ({"role": UserRole.ADMIN}, {"EMP_FILTER_002"}),
        (
            {
                "account_status": (
                    AccountStatus.SUSPENDED
                )
            },
            {"EMP_FILTER_002"},
        ),
        (
            {"employment_status": "CONFIRMED"},
            {"EMP_FILTER_001", "MGR001"},
        ),
        (
            {"reporting_manager": str(manager.id)},
            {"EMP_FILTER_001"},
        ),
        (
            {"director_mapping": str(mapping.id)},
            {"EMP_FILTER_001"},
        ),
    ]

    for params, expected_ids in filter_cases:
        response = admin_client.get(
            reverse(
                "employees-api:profiles-list"
            ),
            params,
        )
        assert response.status_code == status.HTTP_200_OK
        assert response_ids(response) == expected_ids

    dropdown_response = admin_client.get(
        reverse("employees-api:profiles-dropdown")
    )
    assert dropdown_response.status_code == status.HTTP_200_OK
    assert any(
        item["employee_id"] == match.employee_id
        for item in dropdown_response.data["data"]
    )

    options_response = admin_client.get(
        reverse(
            "employees-api:profiles-filter-options"
        )
    )
    assert options_response.status_code == status.HTTP_200_OK
    assert {
        "roles",
        "account_statuses",
        "employment_statuses",
        "genders",
    }.issubset(options_response.data["data"].keys())

    export_response = admin_client.get(
        reverse("employees-api:profiles-export"),
        {"role": UserRole.ADMIN},
    )
    assert export_response.status_code == status.HTTP_200_OK
    assert response_ids(export_response) == {
        suspended.employee_id
    }

    csv_export_response = admin_client.get(
        reverse("employees-api:profiles-export"),
        {"file_format": "csv"},
    )
    assert (
        csv_export_response.status_code
        == status.HTTP_200_OK
    )
    assert csv_export_response["Content-Type"] == "text/csv"
    assert b"employee_id" in csv_export_response.content


@pytest.mark.django_db
def test_employee_api_permission_restrictions():
    normal_user = UserFactory()
    client = APIClient()
    client.force_authenticate(user=normal_user)

    list_response = client.get(
        reverse("employees-api:profiles-list")
    )
    assert list_response.status_code == status.HTTP_200_OK

    create_response = client.post(
        reverse("employees-api:profiles-list"),
        {
            "employee_id": "EMP_DENIED",
            "first_name": "Denied",
        },
        format="json",
    )
    assert (
        create_response.status_code
        == status.HTTP_403_FORBIDDEN
    )


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
