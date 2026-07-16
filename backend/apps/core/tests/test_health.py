import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model


@pytest.mark.django_db
def test_health_check_api_returns_success():
    client = APIClient()

    response = client.get(
        reverse("core-api:health-check"),
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["success"] is True
    assert response.data["data"]["database"] == "connected"
    assert response.data["data"]["status"] == "operational"


@pytest.mark.django_db
def test_health_check_returns_request_id_header():
    client = APIClient()

    response = client.get(
        reverse("core-api:health-check"),
    )

    assert response.headers.get(
        "X-Request-ID"
    ) is not None


@pytest.mark.django_db
def test_system_information_rejects_anonymous_user():
    client = APIClient()

    response = client.get(
        reverse("core-api:system-information"),
    )

    assert (
        response.status_code
        == status.HTTP_401_UNAUTHORIZED
    )
    assert response.data["success"] is False
    assert (
        response.data["error_code"]
        == "NOT_AUTHENTICATED"
    )

@pytest.mark.django_db
def test_staff_user_can_access_system_information():
    user_model = get_user_model()

    staff_user = user_model.objects.create_user(
        username="technical-admin",
        password="TemporaryPassword123!",
        is_staff=True,
    )

    client = APIClient()
    client.force_authenticate(user=staff_user)

    response = client.get(
        reverse("core-api:system-information"),
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["success"] is True
    assert "python_version" in response.data["data"]
    assert "django_version" in response.data["data"]
