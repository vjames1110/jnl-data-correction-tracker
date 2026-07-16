import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_check_api_returns_success():
    client = APIClient()

    response = client.get(
        reverse("core-api:health-check"),
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["success"] is True
    assert response.data["data"]["database"] == "connected"