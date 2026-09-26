"""
The Director sets up sites, departments and designations like an
Admin does. The company master itself stays with the Super Admin.
"""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    DirectorUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.organization.models import Company, Department, Site


@pytest.fixture
def company():
    return Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_director_creates_and_deactivates_a_site(company):
    client = client_for(DirectorUserFactory())

    created = client.post(
        reverse("organization-api:sites-list"),
        {
            "company": str(company.id),
            "site_code": "DRSITE",
            "site_name": "Director Site",
        },
        format="json",
    )
    assert created.status_code == status.HTTP_201_CREATED

    site_id = created.data["data"]["id"]
    deactivated = client.post(
        reverse("organization-api:sites-deactivate", args=[site_id])
    )
    assert deactivated.status_code == status.HTTP_200_OK
    assert Site.objects.get(id=site_id).is_active is False


@pytest.mark.django_db
def test_director_creates_a_department(company):
    response = client_for(DirectorUserFactory()).post(
        reverse("organization-api:departments-list"),
        {
            "company": str(company.id),
            "department_name": "Planning",
            "description": "",
            "display_order": 5,
            "is_active": True,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert Department.objects.filter(
        department_name="Planning"
    ).exists()


@pytest.mark.django_db
def test_director_cannot_create_a_company():
    response = client_for(DirectorUserFactory()).post(
        reverse("organization-api:companies-list"),
        {"company_code": "DIR", "company_name": "Director Company"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert not Company.objects.filter(company_code="DIR").exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "factory", [UserFactory, ProjectManagerUserFactory]
)
def test_other_roles_still_cannot_manage_sites(company, factory):
    response = client_for(factory()).post(
        reverse("organization-api:sites-list"),
        {
            "company": str(company.id),
            "site_code": "NOPE",
            "site_name": "Not Allowed",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
