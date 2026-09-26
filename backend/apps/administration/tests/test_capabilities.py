import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    SuperAdminUserFactory,
)


@pytest.mark.django_db
def test_admin_receives_standard_capabilities():
    admin_user = AdminUserFactory()

    client = APIClient()
    client.force_authenticate(
        user=admin_user
    )

    response = client.get(
        reverse(
            "administration-api:capabilities"
        )
    )

    capabilities = response.data[
        "data"
    ]["capabilities"]

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert "view_admin_dashboard" in capabilities
    assert "view_users" in capabilities
    assert (
        "manage_system_settings"
        not in capabilities
    )


@pytest.mark.django_db
def test_super_admin_receives_system_capabilities():
    super_admin = SuperAdminUserFactory()

    client = APIClient()
    client.force_authenticate(
        user=super_admin
    )

    response = client.get(
        reverse(
            "administration-api:capabilities"
        )
    )

    capabilities = response.data[
        "data"
    ]["capabilities"]

    assert "view_audit_logs" in capabilities
    assert (
        "manage_system_settings"
        in capabilities
    )


@pytest.mark.django_db
def test_admin_navigation_excludes_audit():
    admin_user = AdminUserFactory()

    client = APIClient()
    client.force_authenticate(
        user=admin_user
    )

    response = client.get(
        reverse(
            "administration-api:capabilities"
        )
    )

    navigation_keys = {
        item["key"]
        for item
        in response.data[
            "data"
        ]["navigation"]
    }

    assert "dashboard" in navigation_keys
    assert "audit" not in navigation_keys
    assert "settings" not in navigation_keys


@pytest.mark.django_db
def test_director_receives_the_setup_capabilities_only():
    client = APIClient()
    client.force_authenticate(user=DirectorUserFactory())

    response = client.get(
        reverse("administration-api:capabilities")
    )

    assert response.status_code == status.HTTP_200_OK
    capabilities = set(response.data["data"]["capabilities"])

    # Users, organisation setup and Project Monitor are the Director's.
    for expected in (
        "view_users",
        "create_users",
        "update_users",
        "deactivate_users",
        "reset_user_password",
        "unlock_users",
        "view_sites",
        "manage_sites",
        "view_departments",
        "manage_departments",
        "view_project_monitor",
        "manage_project_monitor",
    ):
        assert expected in capabilities, expected

    # The system-level screens stay with the Super Admin, and the
    # admin dashboard is not the Director's.
    for withheld in (
        "view_audit_logs",
        "manage_system_settings",
        "view_admin_dashboard",
    ):
        assert withheld not in capabilities, withheld
