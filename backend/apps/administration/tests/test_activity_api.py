import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.models import (
    LoginEventType,
    LoginHistory,
)
from apps.authentication.tests.factories import (
    AdminUserFactory,
    UserFactory,
)


@pytest.mark.django_db
def test_admin_can_retrieve_recent_activity():
    admin_user = AdminUserFactory()
    normal_user = UserFactory()

    LoginHistory.objects.create(
        user=normal_user,
        employee_id_attempted=(
            normal_user.employee_id
        ),
        event_type=(
            LoginEventType.LOGIN_SUCCESS
        ),
        was_successful=True,
    )

    client = APIClient()
    client.force_authenticate(
        user=admin_user
    )

    response = client.get(
        reverse(
            "administration-api:recent-activity"
        ),
        {"limit": 10},
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert (
        len(
            response.data[
                "data"
            ]["items"]
        )
        == 1
    )


@pytest.mark.django_db
def test_recent_activity_rejects_excessive_limit():
    admin_user = AdminUserFactory()

    client = APIClient()
    client.force_authenticate(
        user=admin_user
    )

    response = client.get(
        reverse(
            "administration-api:recent-activity"
        ),
        {"limit": 1000},
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )