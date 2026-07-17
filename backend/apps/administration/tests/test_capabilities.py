import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
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