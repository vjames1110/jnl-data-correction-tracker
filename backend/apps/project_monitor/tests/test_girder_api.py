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
    GirderJob,
    RdsoSpanLibraryEntry,
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


def _girder_job_payload(**overrides):
    payload = {
        "structure_kind": "MAJOR",
        "bridge_name": "Br. No. 310",
        "chainage_km": "15.500",
        "girder_scope": "JNL",
        "spans": [
            {
                "label": "S1",
                "is_standard": True,
                "drawing_no": "RDSO/B-1234",
                "span_length_m": "24.40",
                "girder_type": "Welded plate girder",
                "qty_mt": "45.500",
                "bearings_count": 4,
                "expansion_joints_count": 2,
            }
        ],
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_project_manager_can_create_a_girder_job(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
        _girder_job_payload(),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["bridge_name"] == "Br. No. 310"
    assert (
        data["groups"][0]["group_title"]
        == "Approvals"
    )
    assert len(data["spans"]) == 1
    span = data["spans"][0]
    group_titles = [
        g["group_title"] for g in span["groups"]
    ]
    assert group_titles == [
        "Girder fabrication",
        "Bearings",
        "Expansion Joints",
    ]
    assert GirderJob.objects.filter(
        site=site
    ).count() == 1


@pytest.mark.django_db
def test_fob_job_has_no_bearings_or_ej_groups(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
        _girder_job_payload(
            structure_kind="FOB",
            bridge_name="FOB 1",
        ),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    span = response.data["data"]["spans"][0]
    group_titles = [
        g["group_title"] for g in span["groups"]
    ]
    assert group_titles == [
        "Girder fabrication"
    ]


@pytest.mark.django_db
def test_bridge_name_is_required(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
        _girder_job_payload(bridge_name="   "),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_at_least_one_span_is_required(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
        _girder_job_payload(spans=[]),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_director_cannot_create_a_girder_job(
    api_client, site
):
    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)

    response = api_client.post(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
        _girder_job_payload(),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_director_can_list_girder_jobs(
    api_client, site
):
    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)
    api_client.post(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
        _girder_job_payload(),
        format="json",
    )

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    response = api_client.get(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert len(response.data["data"]) == 1


@pytest.mark.django_db
def test_girder_job_detail_and_delete(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
        _girder_job_payload(),
        format="json",
    )
    job_id = create_response.data["data"]["id"]

    detail_response = api_client.get(
        reverse(
            "project-monitor-api:girder-job-detail",
            args=[job_id],
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
            "project-monitor-api:girder-job-detail",
            args=[job_id],
        )
    )
    assert (
        forbidden_delete.status_code
        == status.HTTP_403_FORBIDDEN
    )

    api_client.force_authenticate(user=pm)
    delete_response = api_client.delete(
        reverse(
            "project-monitor-api:girder-job-detail",
            args=[job_id],
        )
    )
    assert (
        delete_response.status_code
        == status.HTTP_200_OK
    )
    assert not GirderJob.objects.filter(
        id=job_id
    ).exists()


@pytest.mark.parametrize(
    "factory",
    [
        DirectorUserFactory,
        ProjectManagerUserFactory,
        AdminUserFactory,
    ],
)
@pytest.mark.django_db
def test_director_or_pm_or_admin_can_review_a_girder_job(
    api_client, site, factory
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
        _girder_job_payload(),
        format="json",
    )
    job_id = create_response.data["data"]["id"]

    reviewer = factory()
    api_client.force_authenticate(user=reviewer)
    response = api_client.post(
        reverse(
            "project-monitor-api:girder-job-review",
            args=[job_id],
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
    ] + [
        row
        for span in data["spans"]
        for group in span["groups"]
        for row in group["rows"]
    ]
    assert len(all_rows) > 1
    assert all(
        row["reviewed_at"] is not None
        for row in all_rows
    )


@pytest.mark.django_db
def test_plain_user_cannot_review_a_girder_job(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
        _girder_job_payload(),
        format="json",
    )
    job_id = create_response.data["data"]["id"]

    user = UserFactory()
    api_client.force_authenticate(user=user)
    response = api_client.post(
        reverse(
            "project-monitor-api:girder-job-review",
            args=[job_id],
        ),
        {},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_overview_reflects_real_girder_counts(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
        _girder_job_payload(),
        format="json",
    )
    span = create_response.data["data"][
        "spans"
    ][0]
    launching_row = next(
        row
        for group in span["groups"]
        if group["group_title"]
        == "Girder fabrication"
        for row in group["rows"]
        if row["name"] == "Launching status"
    )

    response = api_client.get(
        f"{reverse('project-monitor-api:overview')}?site={site.id}",
    )
    counts = response.data["data"]["counts"][
        "girders"
    ]
    assert counts["spans_tracked"] == 1
    assert counts["spans_launched"] == 0

    api_client.patch(
        reverse(
            "project-monitor-api:activity-update",
            args=[launching_row["id"]],
        ),
        {
            "meeting_date": "2026-01-05",
            "status": "COMPLETE",
        },
        format="json",
    )

    response = api_client.get(
        f"{reverse('project-monitor-api:overview')}?site={site.id}",
    )
    counts = response.data["data"]["counts"][
        "girders"
    ]
    assert counts["spans_tracked"] == 1
    assert counts["spans_launched"] == 1


@pytest.mark.django_db
def test_admin_can_manage_rdso_span_library(
    api_client,
):
    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)

    create_response = api_client.post(
        reverse(
            "project-monitor-api:rdso-span-library-list"
        ),
        {
            "span_length_m": "20.00",
            "girder_type": "Test girder",
            "drawing_no": "TEST-1",
            "qty_per_span_mt": "10.000",
        },
        format="json",
    )
    assert (
        create_response.status_code
        == status.HTTP_200_OK
    )
    entry_id = create_response.data["data"][
        "id"
    ]

    list_response = api_client.get(
        reverse(
            "project-monitor-api:rdso-span-library-list"
        ),
    )
    assert (
        list_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        len(list_response.data["data"]) == 8
    )

    delete_response = api_client.delete(
        reverse(
            "project-monitor-api:rdso-span-library-detail",
            args=[entry_id],
        )
    )
    assert (
        delete_response.status_code
        == status.HTTP_200_OK
    )
    assert not RdsoSpanLibraryEntry.objects.filter(
        id=entry_id
    ).exists()


@pytest.mark.django_db
def test_project_manager_can_update_span_vendor_and_po(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
        _girder_job_payload(),
        format="json",
    )
    span_id = create_response.data["data"][
        "spans"
    ][0]["id"]

    response = api_client.patch(
        reverse(
            "project-monitor-api:girder-span-update",
            args=[span_id],
        ),
        {
            "vendor": "ABC Fabricators",
            "po_number": "PO-9911",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["vendor"] == "ABC Fabricators"
    assert data["po_number"] == "PO-9911"


@pytest.mark.django_db
def test_director_cannot_update_span_vendor(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:girder-job-list')}?site={site.id}",
        _girder_job_payload(),
        format="json",
    )
    span_id = create_response.data["data"][
        "spans"
    ][0]["id"]

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    response = api_client.patch(
        reverse(
            "project-monitor-api:girder-span-update",
            args=[span_id],
        ),
        {"vendor": "ABC Fabricators"},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_project_manager_cannot_manage_rdso_span_library(
    api_client,
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        reverse(
            "project-monitor-api:rdso-span-library-list"
        ),
        {
            "span_length_m": "20.00",
            "girder_type": "Test girder",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )
