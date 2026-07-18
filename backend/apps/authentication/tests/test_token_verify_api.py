from datetime import timedelta

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
from apps.authentication.tests.factories import (
    UserFactory,
)


@pytest.mark.django_db
def test_token_verify_returns_standard_response_for_valid_token():
    user = UserFactory()
    refresh = ApplicationTokenSerializer.get_token(
        user
    )

    client = APIClient()

    response = client.post(
        reverse("authentication-api:token-verify"),
        {
            "token": str(refresh.access_token),
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["success"] is True
    assert (
        response.data["message"]
        == "Authentication token verified successfully."
    )
    assert response.data["data"]["valid"] is True
    assert (
        response.data["data"]["token_type"]
        == "access"
    )
    assert (
        response.data["data"]["user_id"]
        == str(user.id)
    )


@pytest.mark.django_db
def test_token_verify_rejects_invalid_token():
    client = APIClient()

    response = client.post(
        reverse("authentication-api:token-verify"),
        {
            "token": "not-a-valid-jwt",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["success"] is False
    assert response.data["message"] == "The token is invalid."
    assert response.data["error_code"] == "INVALID_TOKEN"


@pytest.mark.django_db
def test_token_verify_rejects_expired_token():
    user = UserFactory()
    refresh = ApplicationTokenSerializer.get_token(
        user
    )
    access = refresh.access_token
    access.set_exp(
        lifetime=timedelta(seconds=-1),
    )

    client = APIClient()

    response = client.post(
        reverse("authentication-api:token-verify"),
        {
            "token": str(access),
        },
        format="json",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["success"] is False
    assert response.data["message"] == "The token has expired."
    assert response.data["error_code"] == "TOKEN_EXPIRED"


@pytest.mark.django_db
def test_token_verify_rejects_blacklisted_refresh_token():
    user = UserFactory()
    refresh = ApplicationTokenSerializer.get_token(
        user
    )
    RefreshToken(str(refresh)).blacklist()

    client = APIClient()

    response = client.post(
        reverse("authentication-api:token-verify"),
        {
            "token": str(refresh),
        },
        format="json",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["success"] is False
    assert response.data["message"] == "The token has been revoked."
    assert response.data["error_code"] == "TOKEN_REVOKED"


@pytest.mark.django_db
def test_token_verify_requires_token_field():
    client = APIClient()

    response = client.post(
        reverse("authentication-api:token-verify"),
        {},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["success"] is False
    assert response.data["error_code"] == "VALIDATION_ERROR"
