from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    HrDepartmentUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    ChainageSegment,
    ProjectExtension,
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


def _end_date(days_from_today):
    return (
        timezone.localdate()
        + timedelta(days=days_from_today)
    )


@pytest.mark.django_db
def test_project_manager_can_update_project_timeline_fields(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.patch(
        f"{reverse('project-monitor-api:overview')}?site={site.id}",
        {
            "project_name": "Chunar Doubling",
            "start_date": "2025-01-01",
            "end_date": "2026-12-31",
            "project_value": "125000000.00",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]["site"]
    assert (
        data["project_name"]
        == "Chunar Doubling"
    )
    assert data["start_date"] == "2025-01-01"
    assert data["end_date"] == "2026-12-31"
    assert (
        data["project_value"]
        == "125000000.00"
    )


@pytest.mark.django_db
def test_hr_department_cannot_update_project_timeline_fields(
    api_client, site
):
    view_only = HrDepartmentUserFactory()
    api_client.force_authenticate(user=view_only)

    response = api_client.patch(
        f"{reverse('project-monitor-api:overview')}?site={site.id}",
        {"project_value": "1.00"},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_no_end_date_means_no_countdown(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.get(
        reverse(
            "project-monitor-api:overview"
        ),
        {"site": str(site.id)},
    )

    data = response.data["data"]["site"]
    assert data["effective_end_date"] is None
    assert data["days_remaining"] is None
    assert data["countdown_status"] is None


@pytest.mark.django_db
@pytest.mark.parametrize(
    "days_from_today,expected_status",
    [
        (31, "GREEN"),
        (30, "ORANGE"),
        (15, "ORANGE"),
        (14, "RED"),
        (-5, "RED"),
    ],
)
def test_countdown_status_thresholds(
    api_client,
    site,
    days_from_today,
    expected_status,
):
    site.end_date = _end_date(days_from_today)
    site.save(update_fields=["end_date"])

    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    response = api_client.get(
        reverse(
            "project-monitor-api:overview"
        ),
        {"site": str(site.id)},
    )

    data = response.data["data"]["site"]
    assert (
        data["days_remaining"]
        == days_from_today
    )
    assert (
        data["countdown_status"]
        == expected_status
    )


@pytest.mark.django_db
def test_project_manager_can_add_an_extension(
    api_client, site
):
    site.end_date = _end_date(10)
    site.save(update_fields=["end_date"])

    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:extension-list')}?site={site.id}",
        {
            "new_end_date": str(
                _end_date(60)
            ),
            "reason": "Land acquisition delay",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert ProjectExtension.objects.filter(
        site=site
    ).count() == 1

    overview_response = api_client.get(
        reverse(
            "project-monitor-api:overview"
        ),
        {"site": str(site.id)},
    )
    data = overview_response.data["data"][
        "site"
    ]
    assert len(data["extensions"]) == 1
    assert (
        data["extensions"][0]["reason"]
        == "Land acquisition delay"
    )
    assert (
        data["effective_end_date"]
        == _end_date(60)
    )
    assert data["days_remaining"] == 60
    assert data["countdown_status"] == "GREEN"


@pytest.mark.django_db
def test_effective_end_date_uses_the_latest_extension(
    api_client, site
):
    site.end_date = _end_date(10)
    site.save(update_fields=["end_date"])
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    api_client.post(
        f"{reverse('project-monitor-api:extension-list')}?site={site.id}",
        {
            "new_end_date": str(_end_date(20)),
            "reason": "First extension",
        },
        format="json",
    )
    api_client.post(
        f"{reverse('project-monitor-api:extension-list')}?site={site.id}",
        {
            "new_end_date": str(_end_date(45)),
            "reason": "Second extension",
        },
        format="json",
    )

    response = api_client.get(
        reverse(
            "project-monitor-api:overview"
        ),
        {"site": str(site.id)},
    )
    data = response.data["data"]["site"]
    assert len(data["extensions"]) == 2
    assert (
        data["effective_end_date"]
        == _end_date(45)
    )
    assert data["days_remaining"] == 45


@pytest.mark.django_db
def test_hr_department_cannot_add_an_extension(
    api_client, site
):
    view_only = HrDepartmentUserFactory()
    api_client.force_authenticate(user=view_only)

    response = api_client.post(
        f"{reverse('project-monitor-api:extension-list')}?site={site.id}",
        {"new_end_date": str(_end_date(30))},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_plain_user_cannot_list_extensions(
    api_client, site
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.get(
        f"{reverse('project-monitor-api:extension-list')}?site={site.id}",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_project_manager_can_delete_an_extension(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:extension-list')}?site={site.id}",
        {"new_end_date": str(_end_date(30))},
        format="json",
    )
    extension_id = create_response.data[
        "data"
    ]["id"]

    response = api_client.delete(
        reverse(
            "project-monitor-api:extension-detail",
            args=[extension_id],
        )
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert not ProjectExtension.objects.filter(
        id=extension_id
    ).exists()


@pytest.mark.django_db
def test_project_manager_can_add_a_chainage_segment_with_no_vendor(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:chainage-segment-list')}?site={site.id}",
        {
            "from_chainage_km": "10.000",
            "to_chainage_km": "12.500",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert response.data["data"]["vendor"] == ""
    assert ChainageSegment.objects.filter(
        site=site
    ).count() == 1

    overview_response = api_client.get(
        reverse("project-monitor-api:overview"),
        {"site": str(site.id)},
    )
    data = overview_response.data["data"]["site"]
    assert len(data["chainage_segments"]) == 1
    assert (
        data["chainage_segments"][0][
            "from_chainage_km"
        ]
        == "10.000"
    )


@pytest.mark.django_db
def test_a_chainage_segment_can_optionally_name_a_vendor(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:chainage-segment-list')}?site={site.id}",
        {
            "from_chainage_km": "0.000",
            "to_chainage_km": "5.000",
            "vendor": "ABC Infra",
        },
        format="json",
    )

    assert response.data["data"]["vendor"] == "ABC Infra"


@pytest.mark.django_db
def test_a_chainage_segment_cannot_end_before_it_starts(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:chainage-segment-list')}?site={site.id}",
        {
            "from_chainage_km": "10.000",
            "to_chainage_km": "5.000",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert not ChainageSegment.objects.filter(
        site=site
    ).exists()


@pytest.mark.django_db
def test_a_site_can_have_several_chainage_segments(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    for from_km, to_km, vendor in (
        ("0.000", "5.000", "ABC Infra"),
        ("5.000", "9.000", ""),
        ("9.000", "12.000", "XYZ Constructions"),
    ):
        api_client.post(
            f"{reverse('project-monitor-api:chainage-segment-list')}?site={site.id}",
            {
                "from_chainage_km": from_km,
                "to_chainage_km": to_km,
                "vendor": vendor,
            },
            format="json",
        )

    response = api_client.get(
        f"{reverse('project-monitor-api:chainage-segment-list')}?site={site.id}",
    )

    assert len(response.data["data"]) == 3
    assert [
        row["vendor"] for row in response.data["data"]
    ] == ["ABC Infra", "", "XYZ Constructions"]


@pytest.mark.django_db
def test_hr_department_cannot_add_a_chainage_segment(
    api_client, site
):
    view_only = HrDepartmentUserFactory()
    api_client.force_authenticate(user=view_only)

    response = api_client.post(
        f"{reverse('project-monitor-api:chainage-segment-list')}?site={site.id}",
        {"from_chainage_km": "0.000", "to_chainage_km": "1.000"},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_plain_user_cannot_list_chainage_segments(
    api_client, site
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.get(
        f"{reverse('project-monitor-api:chainage-segment-list')}?site={site.id}",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_project_manager_can_delete_a_chainage_segment(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:chainage-segment-list')}?site={site.id}",
        {"from_chainage_km": "0.000", "to_chainage_km": "1.000"},
        format="json",
    )
    segment_id = create_response.data["data"]["id"]

    response = api_client.delete(
        reverse(
            "project-monitor-api:chainage-segment-detail",
            args=[segment_id],
        )
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert not ChainageSegment.objects.filter(
        id=segment_id
    ).exists()


@pytest.mark.django_db
def test_admin_can_manage_project_value_via_organization_site_serializer(
    site,
):
    from apps.organization.api.serializers import (
        SiteSerializer,
    )

    data = SiteSerializer(site).data
    assert "project_value" in data
