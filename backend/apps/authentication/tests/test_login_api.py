import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    UserFactory,
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