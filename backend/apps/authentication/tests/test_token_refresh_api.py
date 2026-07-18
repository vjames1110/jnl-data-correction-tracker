import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import (
    RefreshToken,
)

from apps.authentication.api.tokens import (
    ApplicationTokenSerializer,
)
from apps.authentication.models import (
    LoginEventType,
    LoginHistory,
)
from apps.authentication.tests.factories import (
    UserFactory,
)


@pytest.mark.django_db
def test_token_refresh_returns_standard_response():
    user = UserFactory()
    refresh = ApplicationTokenSerializer.get_token(
        user
    )

    client = APIClient()

    response = client.post(
        reverse("authentication-api:token-refresh"),
        {
            "refresh": str(refresh),
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["success"] is True
    assert (
        response.data["message"]
        == "Authentication token refreshed successfully."
    )

    data = response.data["data"]

    assert data["token_type"] == "Bearer"
    assert data["access"]
    assert data["refresh"]


@pytest.mark.django_db
def test_token_refresh_returns_rotated_refresh_token():
    user = UserFactory()
    original_refresh = (
        ApplicationTokenSerializer.get_token(user)
    )

    client = APIClient()

    response = client.post(
        reverse("authentication-api:token-refresh"),
        {
            "refresh": str(original_refresh),
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert (
        response.data["data"]["refresh"]
        != str(original_refresh)
    )


@pytest.mark.django_db
def test_token_refresh_records_successful_login_event():
    user = UserFactory()
    refresh = ApplicationTokenSerializer.get_token(
        user
    )

    client = APIClient()

    response = client.post(
        reverse("authentication-api:token-refresh"),
        {
            "refresh": str(refresh),
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert LoginHistory.objects.filter(
        user=user,
        employee_id_attempted=user.employee_id,
        event_type=LoginEventType.TOKEN_REFRESH,
        was_successful=True,
    ).exists()


@pytest.mark.django_db
def test_rotated_refresh_token_cannot_be_reused():
    user = UserFactory()
    refresh = ApplicationTokenSerializer.get_token(
        user
    )

    client = APIClient()

    first_response = client.post(
        reverse("authentication-api:token-refresh"),
        {
            "refresh": str(refresh),
        },
        format="json",
    )

    second_response = client.post(
        reverse("authentication-api:token-refresh"),
        {
            "refresh": str(refresh),
        },
        format="json",
    )

    assert (
        first_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        second_response.status_code
        == status.HTTP_401_UNAUTHORIZED
    )
    assert second_response.data["success"] is False


@pytest.mark.django_db
def test_blacklisted_refresh_token_is_rejected():
    user = UserFactory()
    refresh = ApplicationTokenSerializer.get_token(
        user
    )
    RefreshToken(str(refresh)).blacklist()

    client = APIClient()

    response = client.post(
        reverse("authentication-api:token-refresh"),
        {
            "refresh": str(refresh),
        },
        format="json",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["success"] is False
