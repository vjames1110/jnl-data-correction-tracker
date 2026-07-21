from datetime import date

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    SuperAdminUserFactory,
    UserFactory,
)
from apps.organization.models import (
    Company,
    Department,
    Designation,
    Site,
    SiteDepartmentMapping,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def organization_data():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    site = Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
        state="Rajasthan",
        district="Bikaner",
    )
    inactive_site = Site.objects.create(
        company=company,
        site_code="JPR",
        site_name="Jaipur Site",
        state="Rajasthan",
        district="Jaipur",
        is_active=False,
    )
    department = Department.objects.create(
        company=company,
        department_code="FIN",
        department_name="Finance",
        display_order=10,
    )
    designation = Designation.objects.create(
        designation_code="ACC",
        designation_name="Accountant",
        level=5,
    )

    return {
        "company": company,
        "site": site,
        "inactive_site": inactive_site,
        "department": department,
        "designation": designation,
    }


@pytest.mark.django_db
def test_normal_user_can_list_only_active_organization_records(
    api_client,
    organization_data,
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.get(
        reverse("organization-api:sites-list")
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["success"] is True
    site_codes = {
        item["site_code"]
        for item in response.data["data"]
    }
    assert "BKN" in site_codes
    assert "JPR" not in site_codes


@pytest.mark.django_db
def test_normal_user_cannot_manage_organization_records(
    api_client,
    organization_data,
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("organization-api:sites-list"),
        {
            "company": str(
                organization_data["company"].id
            ),
            "site_code": "NEW",
            "site_name": "New Site",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_admin_can_create_site(
    api_client,
    organization_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse("organization-api:sites-list"),
        {
            "company": str(
                organization_data["company"].id
            ),
            "site_code": " new site ",
            "site_name": " New   Site ",
            "state": " Rajasthan ",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert response.data["data"]["site_code"] == "NEW_SITE"
    assert response.data["data"]["site_name"] == "New Site"


@pytest.mark.django_db
def test_company_write_is_super_admin_only(
    api_client,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    admin_response = api_client.post(
        reverse("organization-api:companies-list"),
        {
            "company_code": "ADM",
            "company_name": "Admin Company",
        },
        format="json",
    )

    super_admin = SuperAdminUserFactory()
    api_client.force_authenticate(user=super_admin)

    super_admin_response = api_client.post(
        reverse("organization-api:companies-list"),
        {
            "company_code": "ROOT",
            "company_name": "Root Company",
        },
        format="json",
    )

    assert (
        admin_response.status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert (
        super_admin_response.status_code
        == status.HTTP_201_CREATED
    )


@pytest.mark.django_db
def test_admin_can_deactivate_and_activate_site(
    api_client,
    organization_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    deactivate_response = api_client.post(
        reverse(
            "organization-api:sites-deactivate",
            args=[organization_data["site"].id],
        )
    )
    activate_response = api_client.post(
        reverse(
            "organization-api:sites-activate",
            args=[organization_data["site"].id],
        )
    )

    assert (
        deactivate_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        deactivate_response.data["data"]["is_active"]
        is False
    )
    assert (
        activate_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        activate_response.data["data"]["is_active"]
        is True
    )


@pytest.mark.django_db
def test_site_api_supports_search_filter_order_and_export(
    api_client,
    organization_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    list_response = api_client.get(
        reverse("organization-api:sites-list"),
        {
            "search": "Bikaner",
            "state": "Rajasthan",
            "ordering": "site_code",
        },
    )
    export_response = api_client.get(
        reverse("organization-api:sites-export"),
        {
            "state": "Rajasthan",
        },
    )

    assert list_response.status_code == status.HTTP_200_OK
    assert len(list_response.data["data"]) == 1
    assert (
        list_response.data["data"][0]["site_code"]
        == "BKN"
    )
    assert (
        export_response.status_code
        == status.HTTP_200_OK
    )
    assert len(export_response.data["data"]) == 2


@pytest.mark.django_db
def test_dropdown_and_hierarchy_endpoints_return_master_data(
    api_client,
    organization_data,
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    dropdown_response = api_client.get(
        reverse("organization-api:departments-dropdown")
    )
    hierarchy_response = api_client.get(
        reverse("organization-api:hierarchy")
    )

    assert (
        dropdown_response.status_code
        == status.HTTP_200_OK
    )
    assert dropdown_response.data["data"][0]["code"] == "FIN"
    assert (
        hierarchy_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        hierarchy_response.data["data"][0]["code"]
        == "JNL"
    )


@pytest.mark.django_db
def test_user_dropdown_returns_active_users(
    api_client,
):
    admin_user = AdminUserFactory(
        employee_id="ADMIN001",
    )
    UserFactory(
        employee_id="USR001",
        first_name="Finance",
        last_name="Head",
    )
    UserFactory(
        employee_id="INACTIVE001",
        is_active=False,
    )
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(
        reverse("organization-api:users-dropdown")
    )

    assert response.status_code == status.HTTP_200_OK
    employee_ids = {
        item["employee_id"]
        for item in response.data["data"]
    }
    assert "USR001" in employee_ids
    assert "INACTIVE001" not in employee_ids


@pytest.mark.django_db
def test_admin_can_create_site_department_mapping(
    api_client,
    organization_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse(
            "organization-api:site-department-mappings-list"
        ),
        {
            "site": str(organization_data["site"].id),
            "department": str(
                organization_data["department"].id
            ),
            "effective_date": "2026-07-18",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert (
        SiteDepartmentMapping.objects.filter(
            site=organization_data["site"],
            department=organization_data["department"],
            effective_date=date(2026, 7, 18),
        ).exists()
        is True
    )


@pytest.mark.django_db
def test_api_rejects_invalid_mapping_context(
    api_client,
    organization_data,
):
    other_company = Company.objects.create(
        company_code="OTHER",
        company_name="Other Company",
    )
    other_department = Department.objects.create(
        company=other_company,
        department_code="FIN",
        department_name="Finance",
    )

    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse(
            "organization-api:site-department-mappings-list"
        ),
        {
            "site": str(organization_data["site"].id),
            "department": str(other_department.id),
            "effective_date": "2026-07-18",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert response.data["error_code"] == "VALIDATION_ERROR"
