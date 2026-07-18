import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ResponsiblePersonUserFactory,
    SuperAdminUserFactory,
    UserFactory,
)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "factory_class",
    [
        AdminUserFactory,
        SuperAdminUserFactory,
    ],
)
def test_admin_roles_can_access_dashboard(
    factory_class,
):
    user = factory_class()

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(
        reverse(
            "administration-api:dashboard"
        )
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    "factory_class",
    [
        UserFactory,
        DirectorUserFactory,
    ],
)
def test_non_admin_roles_cannot_access_dashboard(
    factory_class,
):
    user = factory_class()

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(
        reverse(
            "administration-api:dashboard"
        )
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_anonymous_user_cannot_access_dashboard():
    client = APIClient()

    response = client.get(
        reverse(
            "administration-api:dashboard"
        )
    )

    assert (
        response.status_code
        == status.HTTP_401_UNAUTHORIZED
    )


ADMIN_PORTAL_ENDPOINTS = [
    "dashboard",
    "login-trend",
    "recent-activity",
    "profile",
    "capabilities",
    "server-time",
]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "endpoint_name",
    ADMIN_PORTAL_ENDPOINTS,
)
@pytest.mark.parametrize(
    "factory_class",
    [
        AdminUserFactory,
        SuperAdminUserFactory,
    ],
)
def test_admin_roles_can_access_every_admin_portal_api(
    endpoint_name,
    factory_class,
):
    user = factory_class()
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(
        reverse(
            f"administration-api:{endpoint_name}"
        )
    )

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
@pytest.mark.parametrize(
    "endpoint_name",
    ADMIN_PORTAL_ENDPOINTS,
)
@pytest.mark.parametrize(
    "factory_class",
    [
        UserFactory,
        DirectorUserFactory,
        ResponsiblePersonUserFactory,
    ],
)
def test_non_admin_roles_cannot_access_any_admin_portal_api(
    endpoint_name,
    factory_class,
):
    user = factory_class()
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(
        reverse(
            f"administration-api:{endpoint_name}"
        )
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )
