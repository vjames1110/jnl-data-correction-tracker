import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
)


@pytest.mark.django_db
def test_admin_can_retrieve_profile():
    admin_user = AdminUserFactory(
        employee_id="JNLADM001",
        first_name="Admin",
        last_name="User",
    )

    client = APIClient()
    client.force_authenticate(
        user=admin_user
    )

    response = client.get(
        reverse(
            "administration-api:profile"
        )
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert (
        response.data["data"]["employee_id"]
        == "JNLADM001"
    )
    assert (
        response.data["data"]["full_name"]
        == "Admin User"
    )