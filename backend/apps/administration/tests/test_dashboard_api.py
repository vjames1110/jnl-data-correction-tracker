import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.models import (
    AccountStatus,
)
from apps.authentication.tests.factories import (
    AdminUserFactory,
    UserFactory,
)


@pytest.mark.django_db
def test_admin_dashboard_returns_summary():
    admin_user = AdminUserFactory()

    UserFactory()
    UserFactory()
    UserFactory(
        is_active=False,
        account_status=AccountStatus.INACTIVE,
    )
    UserFactory(
        account_status=AccountStatus.LOCKED,
    )

    client = APIClient()
    client.force_authenticate(
        user=admin_user
    )

    response = client.get(
        reverse(
            "administration-api:dashboard"
        ),
        {"period": "30d"},
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert response.data["success"] is True

    data = response.data["data"]

    assert "summary" in data
    assert "role_distribution" in data
    assert (
        "account_status_distribution"
        in data
    )
    assert "login_trend" in data
    assert data["period"]["key"] == "30d"


@pytest.mark.django_db
def test_dashboard_rejects_invalid_period():
    admin_user = AdminUserFactory()

    client = APIClient()
    client.force_authenticate(
        user=admin_user
    )

    response = client.get(
        reverse(
            "administration-api:dashboard"
        ),
        {"period": "365d"},
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert (
        response.data["error_code"]
        == "VALIDATION_ERROR"
    )


@pytest.mark.django_db
def test_dashboard_login_trend_has_every_day():
    admin_user = AdminUserFactory()

    client = APIClient()
    client.force_authenticate(
        user=admin_user
    )

    response = client.get(
        reverse(
            "administration-api:dashboard"
        ),
        {"period": "7d"},
    )

    login_trend = response.data[
        "data"
    ]["login_trend"]

    assert len(login_trend) == 7

    @pytest.mark.django_db
    def test_admin_can_retrieve_server_time():
        admin_user = AdminUserFactory()

    client = APIClient()
    client.force_authenticate(
        user=admin_user
    )

    response = client.get(
        reverse(
            "administration-api:server-time"
        )
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert (
        response.data["data"]["timezone"]
        == "Asia/Kolkata"
    )
    assert "datetime" in response.data["data"]
    assert (
        "unix_timestamp"
        in response.data["data"]
    )