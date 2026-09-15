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


@pytest.fixture
def structure(api_client, site, minor_type_id):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )
    structure_id = response.data["data"]["id"]
    return Structure.objects.get(pk=structure_id)


@pytest.mark.django_db
def test_editing_never_requires_a_review(
    api_client, site, minor_type_id
):
    """
    The whole-site review-session edit gate was reverted - PM/Admin
    can always add/edit, with no dependency on any review state.
    """

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


@pytest.mark.parametrize(
    "factory",
    [
        DirectorUserFactory,
        ProjectManagerUserFactory,
        AdminUserFactory,
    ],
)
@pytest.mark.django_db
def test_director_or_pm_or_admin_can_review_an_activity(
    api_client, structure, factory
):
    activity_id = (
        structure.activities.first().id
    )
    reviewer = factory()
    api_client.force_authenticate(user=reviewer)

    response = api_client.post(
        reverse(
            "project-monitor-api:activity-review",
            args=[activity_id],
        ),
        {"remarks": "Looks good."},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["reviewed_by_name"]
    assert data["reviewed_at"] is not None
    assert data["review_remarks"] == (
        "Looks good."
    )
    assert any(
        "Reviewed by" in c["text"]
        for c in data["comments"]
    )


@pytest.mark.django_db
def test_plain_user_cannot_review_an_activity(
    api_client, structure
):
    activity_id = (
        structure.activities.first().id
    )
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse(
            "project-monitor-api:activity-review",
            args=[activity_id],
        ),
        {},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_reviewing_an_activity_again_overwrites_the_sign_off(
    api_client, structure
):
    activity_id = (
        structure.activities.first().id
    )
    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    api_client.post(
        reverse(
            "project-monitor-api:activity-review",
            args=[activity_id],
        ),
        {"remarks": "First pass."},
        format="json",
    )

    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    response = api_client.post(
        reverse(
            "project-monitor-api:activity-review",
            args=[activity_id],
        ),
        {"remarks": "Second pass."},
        format="json",
    )

    data = response.data["data"]
    assert data["review_remarks"] == (
        "Second pass."
    )
    assert (
        len(data["comments"]) == 2
    )


@pytest.mark.django_db
def test_reviewing_a_structure_reviews_every_activity_on_it(
    api_client, structure
):
    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)

    response = api_client.post(
        reverse(
            "project-monitor-api:structure-review",
            args=[structure.id],
        ),
        {"remarks": "Reviewed at site visit."},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    all_rows = [
        row
        for group in data["groups"]
        for row in group["rows"]
    ]
    assert len(all_rows) > 1
    assert all(
        row["reviewed_at"] is not None
        for row in all_rows
    )
    assert all(
        row["review_remarks"]
        == "Reviewed at site visit."
        for row in all_rows
    )


@pytest.mark.django_db
def test_plain_user_cannot_review_a_structure(
    api_client, structure
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse(
            "project-monitor-api:structure-review",
            args=[structure.id],
        ),
        {},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )
