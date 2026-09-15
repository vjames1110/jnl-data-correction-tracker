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
from apps.project_monitor.services.structure_generator import (
    create_structure,
)


@pytest.fixture
def api_client():
    return APIClient()


def _fob_payload():
    return {
        "code": "FOB",
        "name": "Foot Over Bridge",
        "description_template": "{spans} span(s) FOB",
        "config_schema": [
            {
                "key": "spans",
                "label": "No. of spans",
                "type": "number",
                "default": 2,
            },
        ],
        "group_templates": [
            {
                "kind": "chain",
                "count_field": "spans",
                "group_per_item": False,
                "title": "Girders",
                "name_prefix_template": "S{n} – ",
                "rows": [
                    {
                        "name": "Girder fabrication",
                        "kind": "TASK",
                    },
                ],
            },
        ],
    }


@pytest.mark.django_db
def test_admin_can_create_a_new_structure_type(
    api_client,
):
    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        reverse(
            "project-monitor-api:structure-type-list"
        ),
        _fob_payload(),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert StructureTypeDefinition.objects.filter(
        code="FOB"
    ).exists()


@pytest.mark.django_db
def test_project_manager_cannot_create_a_structure_type(
    api_client,
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        reverse(
            "project-monitor-api:structure-type-list"
        ),
        _fob_payload(),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_project_manager_can_read_structure_types(
    api_client,
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.get(
        reverse(
            "project-monitor-api:structure-type-list"
        ),
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    codes = {
        row["code"]
        for row in response.data["data"]
    }
    assert {
        "MINOR",
        "MAJOR",
        "RUB",
        "ROB",
    }.issubset(codes)


@pytest.mark.django_db
def test_plain_user_cannot_read_structure_types(
    api_client,
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.get(
        reverse(
            "project-monitor-api:structure-type-list"
        ),
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_malformed_group_templates_are_rejected(
    api_client,
):
    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)

    payload = _fob_payload()
    payload["group_templates"] = [
        {"kind": "not-a-real-kind"}
    ]

    response = api_client.post(
        reverse(
            "project-monitor-api:structure-type-list"
        ),
        payload,
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_a_newly_defined_type_generates_a_real_structure(
    api_client,
):
    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)
    api_client.post(
        reverse(
            "project-monitor-api:structure-type-list"
        ),
        _fob_payload(),
        format="json",
    )
    fob_id = str(
        StructureTypeDefinition.objects.get(
            code="FOB"
        ).id
    )

    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    site = Site.objects.create(
        company=company,
        site_code="FOBSITE",
        site_name="FOB Test Site",
    )

    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        {
            "structure_type": fob_id,
            "name": "FOB 1",
            "config": {"spans": 3},
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["structure_type_code"] == "FOB"
    assert (
        data["groups"][0]["group_title"]
        == "Approvals"
    )
    girder_group = data["groups"][1]
    assert girder_group["group_title"] == "Girders"
    assert [
        row["name"] for row in girder_group["rows"]
    ] == [
        "S1 – Girder fabrication",
        "S2 – Girder fabrication",
        "S3 – Girder fabrication",
    ]


@pytest.mark.django_db
def test_structure_type_in_use_cannot_be_deleted(
    api_client,
):
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    site = Site.objects.create(
        company=company,
        site_code="PROTSITE",
        site_name="Protect Test Site",
    )
    minor_type = (
        StructureTypeDefinition.objects.get(
            code="MINOR"
        )
    )
    create_structure(
        site=site,
        structure_type=minor_type,
        name="Br. No. 1",
        chainage_km=None,
        config={},
        actor=None,
    )

    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)
    response = api_client.delete(
        reverse(
            "project-monitor-api:structure-type-detail",
            args=[minor_type.id],
        ),
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert StructureTypeDefinition.objects.filter(
        id=minor_type.id
    ).exists()


@pytest.mark.django_db
def test_unused_structure_type_can_be_deleted(
    api_client,
):
    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)
    api_client.post(
        reverse(
            "project-monitor-api:structure-type-list"
        ),
        _fob_payload(),
        format="json",
    )
    fob_id = StructureTypeDefinition.objects.get(
        code="FOB"
    ).id

    response = api_client.delete(
        reverse(
            "project-monitor-api:structure-type-detail",
            args=[fob_id],
        ),
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert not StructureTypeDefinition.objects.filter(
        id=fob_id
    ).exists()


@pytest.mark.django_db
def test_director_cannot_delete_a_structure_type(
    api_client,
):
    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)
    api_client.post(
        reverse(
            "project-monitor-api:structure-type-list"
        ),
        _fob_payload(),
        format="json",
    )
    fob_id = StructureTypeDefinition.objects.get(
        code="FOB"
    ).id

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    response = api_client.delete(
        reverse(
            "project-monitor-api:structure-type-detail",
            args=[fob_id],
        ),
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )
