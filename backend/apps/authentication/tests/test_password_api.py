import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.api.tokens import (
    ApplicationTokenSerializer,
)
from apps.authentication.tests.factories import (
    UserFactory,
)


@pytest.mark.django_db
def test_password_change_revokes_existing_access_token():
    old_password = "StrongTestPassword@123"
    new_password = "NewStrongPassword@456"
    user = UserFactory(
        password=old_password,
    )
    refresh = ApplicationTokenSerializer.get_token(
        user
    )
    old_access_token = str(refresh.access_token)

    client = APIClient()
    client.credentials(
        HTTP_AUTHORIZATION=(
            f"Bearer {old_access_token}"
        )
    )

    response = client.post(
        reverse("authentication-api:change-password"),
        {
            "current_password": old_password,
            "new_password": new_password,
            "confirm_password": new_password,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["success"] is True

    stale_token_response = client.get(
        reverse("authentication-api:current-user")
    )

    assert (
        stale_token_response.status_code
        == status.HTTP_401_UNAUTHORIZED
    )
    assert stale_token_response.data["success"] is False
