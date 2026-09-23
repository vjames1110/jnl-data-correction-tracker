from datetime import date

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
from apps.project_monitor.models import (
    Structure,
    StructureTypeDefinition,
)


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


@pytest.fixture
def minor_type_id():
    return str(
        StructureTypeDefinition.objects.get(
            code="MINOR"
        ).id
    )


def _minor_bridge_payload(
    minor_type_id, name="Br. No. 214"
):
    return {
        "structure_type": minor_type_id,
        "name": name,
        "chainage_km": "12.345",
        "config": {
            "w": 3,
            "h": 3,
            "cells": 1,
            "barrel": 12,
            "returns": 4,
            "stairs": 2,
            "apron": True,
        },
    }


@pytest.mark.django_db
def test_project_manager_can_create_a_structure(
    api_client, site, minor_type_id
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["structure_type_code"] == "MINOR"
    assert data["name"] == "Br. No. 214"
    assert (
        data["groups"][0]["group_title"]
        == "Approvals"
    )
    assert (
        data["groups"][1]["group_title"]
        == "Box structure"
    )
    assert data["overall_progress"]["total"] > 0
    assert Structure.objects.filter(
        site=site
    ).count() == 1


@pytest.mark.django_db
def test_structure_name_is_required(
    api_client, site, minor_type_id
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    payload = _minor_bridge_payload(minor_type_id, name="   ")
    response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        payload,
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_director_cannot_create_a_structure(
    api_client, site, minor_type_id
):
    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)

    response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_director_can_list_structures(
    api_client, site, minor_type_id
):
    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)
    api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    response = api_client.get(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert len(response.data["data"]) == 1


@pytest.mark.django_db
def test_plain_user_cannot_list_structures(
    api_client, site, minor_type_id
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.get(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_structure_detail_and_delete(
    api_client, site, minor_type_id
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )
    structure_id = create_response.data["data"][
        "id"
    ]

    detail_response = api_client.get(
        reverse(
            "project-monitor-api:structure-detail",
            args=[structure_id],
        )
    )
    assert (
        detail_response.status_code
        == status.HTTP_200_OK
    )

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    forbidden_delete = api_client.delete(
        reverse(
            "project-monitor-api:structure-detail",
            args=[structure_id],
        )
    )
    assert (
        forbidden_delete.status_code
        == status.HTTP_403_FORBIDDEN
    )

    api_client.force_authenticate(user=pm)
    delete_response = api_client.delete(
        reverse(
            "project-monitor-api:structure-detail",
            args=[structure_id],
        )
    )
    assert (
        delete_response.status_code
        == status.HTTP_200_OK
    )
    assert not Structure.objects.filter(
        id=structure_id
    ).exists()


@pytest.mark.django_db
def test_a_structures_name_and_chainage_can_be_edited(
    api_client, site, minor_type_id
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )
    structure_id = create_response.data["data"]["id"]
    original_activity_count = len(
        create_response.data["data"]["groups"]
    )

    response = api_client.patch(
        reverse(
            "project-monitor-api:structure-detail",
            args=[structure_id],
        ),
        {"name": "Br. No. 214-A", "chainage_km": "13.000"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["data"]["name"] == "Br. No. 214-A"
    assert (
        response.data["data"]["chainage_km"] == "13.000"
    )
    # The activity sheet is untouched by editing metadata.
    assert (
        len(response.data["data"]["groups"])
        == original_activity_count
    )

    structure = Structure.objects.get(pk=structure_id)
    assert structure.name == "Br. No. 214-A"


@pytest.mark.django_db
def test_editing_a_structure_needs_a_name(
    api_client, site, minor_type_id
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )
    structure_id = create_response.data["data"]["id"]

    response = api_client.patch(
        reverse(
            "project-monitor-api:structure-detail",
            args=[structure_id],
        ),
        {"name": "   "},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_editing_the_config_regenerates_the_sheet(
    api_client, site, minor_type_id
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )
    structure_id = create_response.data["data"]["id"]

    response = api_client.patch(
        reverse(
            "project-monitor-api:structure-detail",
            args=[structure_id],
        ),
        {
            "config": {
                "w": 3,
                "h": 3,
                "cells": 1,
                "barrel": 12,
                "returns": 2,
                "stairs": 2,
                "apron": True,
            }
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    box_group = next(
        group
        for group in response.data["data"]["groups"]
        if group["group_title"] == "Box structure"
    )
    rw3 = next(
        row
        for row in box_group["rows"]
        if row["name"] == "R/W 3"
    )
    assert rw3["status"] == "NOT_APPLICABLE"
    # Still the same rows - none deleted.
    assert len(box_group["rows"]) == 18


@pytest.mark.django_db
def test_a_director_cannot_edit_a_structure(
    api_client, site, minor_type_id
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )
    structure_id = create_response.data["data"]["id"]

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    response = api_client.patch(
        reverse(
            "project-monitor-api:structure-detail",
            args=[structure_id],
        ),
        {"name": "Renamed"},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_updating_an_activity_composes_one_log_line(
    api_client, site, minor_type_id
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )
    box_group = create_response.data["data"][
        "groups"
    ][1]
    box_raft = next(
        row
        for row in box_group["rows"]
        if row["name"] == "Box raft"
    )

    response = api_client.patch(
        reverse(
            "project-monitor-api:activity-update",
            args=[box_raft["id"]],
        ),
        {
            "meeting_date": str(date(2026, 1, 5)),
            "new_target_date": str(
                date(2026, 2, 1)
            ),
            "status": "IN_PROGRESS",
            "done_qty": "40",
            "comment": "Shuttering in progress",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["status"] == "IN_PROGRESS"
    assert data["done_qty"] == "40.000"
    assert (
        data["current_target_date"]
        == "2026-02-01"
    )
    assert len(data["comments"]) == 1
    text = data["comments"][0]["text"]
    assert "Target set 01-02-2026" in text
    assert "Status: In Progress" in text
    assert "40% done" in text
    assert "Shuttering in progress" in text


@pytest.mark.django_db
def test_director_cannot_update_an_activity(
    api_client, site, minor_type_id
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )
    activity_id = create_response.data["data"][
        "groups"
    ][1]["rows"][0]["id"]

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    response = api_client.patch(
        reverse(
            "project-monitor-api:activity-update",
            args=[activity_id],
        ),
        {
            "meeting_date": str(date(2026, 1, 5)),
            "status": "IN_PROGRESS",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_overview_reflects_real_structure_counts(
    api_client, site, minor_type_id
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )

    response = api_client.get(
        f"{reverse('project-monitor-api:overview')}?site={site.id}",
    )

    counts = response.data["data"]["counts"][
        "structures"
    ]
    by_type = {
        row["code"]: row["count"]
        for row in counts["by_type"]
    }
    assert by_type["MINOR"] == 1
    assert by_type.get("MAJOR", 0) == 0
    assert counts["activities_total"] > 0
    assert counts["activities_done"] == 0


@pytest.mark.django_db
def test_marking_a_row_as_a_hindrance(
    api_client, site, minor_type_id
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )
    box_raft_id = create_response.data["data"][
        "groups"
    ][1]["rows"][0]["id"]

    response = api_client.patch(
        reverse(
            "project-monitor-api:activity-update",
            args=[box_raft_id],
        ),
        {
            "meeting_date": str(
                date(2026, 1, 5)
            ),
            "is_hindrance": True,
            "hindrance_expected_removal_date": str(
                date(2026, 2, 1)
            ),
            "hindrance_remarks": (
                "Blocked pending Railway NOC"
            ),
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["is_hindrance"] is True
    assert (
        data["hindrance_expected_removal_date"]
        == "2026-02-01"
    )
    assert (
        data["hindrance_remarks"]
        == "Blocked pending Railway NOC"
    )
    assert any(
        "Marked as hindrance" in c["text"]
        for c in data["comments"]
    )
