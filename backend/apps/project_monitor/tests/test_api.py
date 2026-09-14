import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.organization.models import Company, Site


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    return Site.objects.create(
        company=company,
        site_code="CHK",
        site_name="Chunar-Khairahi Doubling Pkg-I",
        chainage_start_km="0.000",
        chainage_end_km="25.000",
        client_or_section="NCR Prayagraj",
    )


@pytest.mark.django_db
def test_project_manager_can_read_overview(
    api_client,
    site,
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.get(
        reverse(
            "project-monitor-api:overview"
        ),
        {"site": str(site.id)},
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["site"]["site_code"] == "CHK"
    assert (
        data["site"]["client_or_section"]
        == "NCR Prayagraj"
    )
    assert (
        data["site"]["chainage_start_km"]
        == "0.000"
    )
    assert (
        data["counts"]["structures"]["by_type"]
        == []
    )
    assert (
        data["counts"]["action_items"]["open"]
        == 0
    )


@pytest.mark.django_db
def test_director_can_read_overview(
    api_client,
    site,
):
    director = DirectorUserFactory()
    api_client.force_authenticate(
        user=director
    )

    response = api_client.get(
        reverse(
            "project-monitor-api:overview"
        ),
        {"site": str(site.id)},
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )


@pytest.mark.django_db
def test_admin_can_read_overview(
    api_client,
    site,
):
    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)

    response = api_client.get(
        reverse(
            "project-monitor-api:overview"
        ),
        {"site": str(site.id)},
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )


@pytest.mark.django_db
def test_plain_user_cannot_read_overview(
    api_client,
    site,
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.get(
        reverse(
            "project-monitor-api:overview"
        ),
        {"site": str(site.id)},
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_overview_requires_a_site_param(
    api_client,
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.get(
        reverse(
            "project-monitor-api:overview"
        )
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_overview_rejects_an_unknown_site(
    api_client,
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.get(
        reverse(
            "project-monitor-api:overview"
        ),
        {
            "site": "00000000-0000-0000-0000-000000000000"
        },
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_anonymous_user_cannot_read_overview(
    api_client,
    site,
):
    response = api_client.get(
        reverse(
            "project-monitor-api:overview"
        ),
        {"site": str(site.id)},
    )

    assert response.status_code in (
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    )
