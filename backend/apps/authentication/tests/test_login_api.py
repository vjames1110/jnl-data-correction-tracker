import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    UserFactory,
)
from apps.authentication.models import (
    AccountStatus,
)


@pytest.mark.django_db
def test_user_can_login_with_employee_id():
    UserFactory(
        employee_id="JNL00001",
        password="StrongTestPassword@123",
    )

    client = APIClient()

    response = client.post(
        reverse("authentication-api:login"),
        {
            "employee_id": "jnl00001",
            "password": "StrongTestPassword@123",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["success"] is True
    assert "access" in response.data["data"]
    assert "refresh" in response.data["data"]


@pytest.mark.django_db
def test_account_is_locked_after_repeated_failed_logins():
    user = UserFactory(
        password="StrongTestPassword@123",
    )
    client = APIClient()

    for _ in range(5):
        response = client.post(
            reverse("authentication-api:login"),
            {
                "employee_id": user.employee_id,
                "password": "WrongPassword@123",
            },
            format="json",
        )

    user.refresh_from_db()

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert user.account_status == AccountStatus.LOCKED
    assert user.locked_until is not None


@pytest.mark.django_db
def test_temporary_password_user_cannot_access_admin_portal_api():
    user = AdminUserFactory(
        must_change_password=True,
    )
    login_response = APIClient().post(
        reverse("authentication-api:login"),
        {
            "employee_id": user.employee_id,
            "password": "StrongTestPassword@123",
        },
        format="json",
    )

    client = APIClient()
    client.credentials(
        HTTP_AUTHORIZATION=(
            "Bearer "
            f"{login_response.data['data']['access']}"
        )
    )

    response = client.get(
        reverse("administration-api:dashboard")
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.data["error_code"] == "PERMISSION_DENIED"
