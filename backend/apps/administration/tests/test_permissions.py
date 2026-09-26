import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ResponsiblePersonUserFactory,
    StoreHoUserFactory,
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


# The Director manages users and organisation setup, so the two
# endpoints the Administration screens are built on (who am I, and what
# may I do) are open to the Director as well. The dashboard, login
# trend and recent activity stay Admin-only.
DIRECTOR_PORTAL_ENDPOINTS = {"profile", "capabilities"}


@pytest.mark.django_db
@pytest.mark.parametrize(
    "endpoint_name",
    ADMIN_PORTAL_ENDPOINTS,
)
@pytest.mark.parametrize(
    "factory_class",
    [
        UserFactory,
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


@pytest.mark.django_db
@pytest.mark.parametrize(
    "endpoint_name",
    ADMIN_PORTAL_ENDPOINTS,
)
def test_director_reaches_only_the_administration_setup_apis(
    endpoint_name,
):
    client = APIClient()
    client.force_authenticate(user=DirectorUserFactory())

    response = client.get(
        reverse(
            f"administration-api:{endpoint_name}"
        )
    )

    expected = (
        status.HTTP_200_OK
        if endpoint_name in DIRECTOR_PORTAL_ENDPOINTS
        else status.HTTP_403_FORBIDDEN
    )
    assert response.status_code == expected


@pytest.mark.django_db
@pytest.mark.parametrize(
    "factory_class",
    [
        AdminUserFactory,
        SuperAdminUserFactory,
        UserFactory,
        DirectorUserFactory,
        ResponsiblePersonUserFactory,
        StoreHoUserFactory,
    ],
)
def test_every_role_can_read_server_time(
    factory_class,
):
    """
    Every portal header shows a live clock
    (ServerClock.jsx) driven by this endpoint - it
    carries no sensitive data, so it's deliberately
    not restricted to Admin like the rest of the
    admin-portal API.
    """
    user = factory_class()
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(
        reverse(
            "administration-api:server-time"
        )
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )


@pytest.mark.django_db
def test_anonymous_user_cannot_read_server_time():
    client = APIClient()

    response = client.get(
        reverse(
            "administration-api:server-time"
        )
    )

    assert (
        response.status_code
        == status.HTTP_401_UNAUTHORIZED
    )
