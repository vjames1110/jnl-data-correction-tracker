from datetime import date

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ProjectHoUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.organization.models import Company, Site
from apps.project_monitor.models import Building


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
    )


def _building_payload(name="Station building"):
    return {
        "name": name,
        "station_label": "Chunar station",
        "chainage_km": "10.500",
        "config": {
            "gf": 500,
            "up": 1,
            "uf": 500,
            "found": "open",
            "lift": True,
            "fire": False,
            "ext": True,
        },
    }


@pytest.mark.django_db
def test_project_manager_can_create_a_building(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:building-list')}?site={site.id}",
        _building_payload(),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["name"] == "Station building"
    assert (
        data["station_label"] == "Chunar station"
    )
    assert (
        data["groups"][0]["group_title"]
        == "Approvals"
    )
    assert Building.objects.filter(
        site=site
    ).count() == 1


@pytest.mark.django_db
def test_building_name_is_required(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    payload = _building_payload(name="   ")
    response = api_client.post(
        f"{reverse('project-monitor-api:building-list')}?site={site.id}",
        payload,
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_view_only_cannot_create_a_building(
    api_client, site
):
    view_only = ProjectHoUserFactory()
    api_client.force_authenticate(user=view_only)

    response = api_client.post(
        f"{reverse('project-monitor-api:building-list')}?site={site.id}",
        _building_payload(),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_director_can_list_buildings(
    api_client, site
):
    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)
    api_client.post(
        f"{reverse('project-monitor-api:building-list')}?site={site.id}",
        _building_payload(),
        format="json",
    )

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    response = api_client.get(
        f"{reverse('project-monitor-api:building-list')}?site={site.id}",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert len(response.data["data"]) == 1


@pytest.mark.django_db
def test_plain_user_cannot_list_buildings(
    api_client, site
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.get(
        f"{reverse('project-monitor-api:building-list')}?site={site.id}",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_building_detail_and_delete(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:building-list')}?site={site.id}",
        _building_payload(),
        format="json",
    )
    building_id = create_response.data["data"][
        "id"
    ]

    detail_response = api_client.get(
        reverse(
            "project-monitor-api:building-detail",
            args=[building_id],
        )
    )
    assert (
        detail_response.status_code
        == status.HTTP_200_OK
    )

    view_only = ProjectHoUserFactory()
    api_client.force_authenticate(user=view_only)
    forbidden_delete = api_client.delete(
        reverse(
            "project-monitor-api:building-detail",
            args=[building_id],
        )
    )
    assert (
        forbidden_delete.status_code
        == status.HTTP_403_FORBIDDEN
    )

    api_client.force_authenticate(user=pm)
    delete_response = api_client.delete(
        reverse(
            "project-monitor-api:building-detail",
            args=[building_id],
        )
    )
    assert (
        delete_response.status_code
        == status.HTTP_200_OK
    )
    assert not Building.objects.filter(
        id=building_id
    ).exists()


@pytest.mark.django_db
def test_updating_a_material_tracked_row_logs_material_status(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:building-list')}?site={site.id}",
        _building_payload(),
        format="json",
    )
    ground_floor = next(
        group
        for group in create_response.data[
            "data"
        ]["groups"]
        if group["group_title"]
        == "Ground Floor"
    )
    flooring = next(
        row
        for row in ground_floor["rows"]
        if row["name"] == "Flooring"
    )
    assert flooring["material_tracked"]

    response = api_client.patch(
        reverse(
            "project-monitor-api:activity-update",
            args=[flooring["id"]],
        ),
        {
            "meeting_date": str(date(2026, 1, 5)),
            "status": "IN_PROGRESS",
            "done_qty": "20",
            "material_status": "PO_PLACED",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["material_status"] == "PO_PLACED"
    comment_texts = [
        c["text"] for c in data["comments"]
    ]
    assert any(
        "Status: In Progress" in text
        for text in comment_texts
    )
    assert any(
        "Material: PO Placed" in text
        for text in comment_texts
    )


@pytest.mark.django_db
def test_overview_reflects_real_building_counts(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    api_client.post(
        f"{reverse('project-monitor-api:building-list')}?site={site.id}",
        _building_payload(),
        format="json",
    )

    response = api_client.get(
        f"{reverse('project-monitor-api:overview')}?site={site.id}",
    )

    counts = response.data["data"]["counts"][
        "buildings"
    ]
    assert counts["count"] == 1
    assert counts["built_up_area_sqm"] == 1000
