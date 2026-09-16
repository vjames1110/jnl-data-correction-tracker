from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.organization.models import Company, Site
from apps.project_monitor.models import ActionItem


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


def _payload(**overrides):
    payload = {
        "name": "Follow up on ROW handover",
        "responsibility": "Site Engineer",
        "remarks": "Discussed in weekly meeting.",
        "target_date": "2027-06-01",
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_project_manager_can_create_an_action_item(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["responsibility"] == (
        "Site Engineer"
    )
    assert data["remarks"] == (
        "Discussed in weekly meeting."
    )
    assert (
        data["activity"]["name"]
        == "Follow up on ROW handover"
    )
    assert (
        data["activity"]["current_target_date"]
        == "2027-06-01"
    )
    assert data["is_overdue"] is False
    assert ActionItem.objects.filter(
        site=site
    ).count() == 1


@pytest.mark.django_db
def test_name_is_required(api_client, site):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(name="   "),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_director_cannot_create_an_action_item(
    api_client, site
):
    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)

    response = api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(),
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_director_can_list_action_items(
    api_client, site
):
    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)
    api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(),
        format="json",
    )

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    response = api_client.get(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert len(response.data["data"]) == 1


@pytest.mark.django_db
def test_plain_user_cannot_list_action_items(
    api_client, site
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.get(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_action_item_is_flagged_overdue(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    past_date = (
        timezone.localdate() - timedelta(days=3)
    )
    create_response = api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(target_date=str(past_date)),
        format="json",
    )

    data = create_response.data["data"]
    assert data["is_overdue"] is True


@pytest.mark.django_db
def test_completing_an_action_item_clears_overdue_flag(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    past_date = (
        timezone.localdate() - timedelta(days=3)
    )
    create_response = api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(target_date=str(past_date)),
        format="json",
    )
    activity_id = create_response.data["data"][
        "activity"
    ]["id"]

    # The generic activity-update endpoint (already built for
    # Structures/Buildings/Girders) is reused as-is for Action
    # Items - no new "complete" endpoint needed.
    update_response = api_client.patch(
        reverse(
            "project-monitor-api:activity-update",
            args=[activity_id],
        ),
        {
            "meeting_date": str(
                timezone.localdate()
            ),
            "status": "COMPLETE",
        },
        format="json",
    )
    assert (
        update_response.status_code
        == status.HTTP_200_OK
    )

    item_id = create_response.data["data"][
        "id"
    ]
    detail_response = api_client.get(
        reverse(
            "project-monitor-api:action-item-detail",
            args=[item_id],
        )
    )
    data = detail_response.data["data"]
    assert (
        data["activity"]["status"]
        == "COMPLETE"
    )
    assert data["is_overdue"] is False


@pytest.mark.django_db
def test_reopening_a_completed_action_item(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(),
        format="json",
    )
    activity_id = create_response.data["data"][
        "activity"
    ]["id"]

    api_client.patch(
        reverse(
            "project-monitor-api:activity-update",
            args=[activity_id],
        ),
        {
            "meeting_date": str(
                timezone.localdate()
            ),
            "status": "COMPLETE",
        },
        format="json",
    )

    reopen_response = api_client.patch(
        reverse(
            "project-monitor-api:activity-update",
            args=[activity_id],
        ),
        {
            "meeting_date": str(
                timezone.localdate()
            ),
            "status": "IN_PROGRESS",
            "comment": "Re-opened",
        },
        format="json",
    )

    assert (
        reopen_response.status_code
        == status.HTTP_200_OK
    )
    data = reopen_response.data["data"]
    assert data["status"] == "IN_PROGRESS"
    assert any(
        "Re-opened" in c["text"]
        for c in data["comments"]
    )


@pytest.mark.django_db
def test_project_manager_can_update_persistent_fields(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(),
        format="json",
    )
    item_id = create_response.data["data"][
        "id"
    ]

    response = api_client.patch(
        reverse(
            "project-monitor-api:action-item-detail",
            args=[item_id],
        ),
        {
            "responsibility": "PM - Deepak",
            "remarks": "Updated after Sept review.",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["responsibility"] == (
        "PM - Deepak"
    )
    assert data["remarks"] == (
        "Updated after Sept review."
    )


@pytest.mark.django_db
def test_director_cannot_update_persistent_fields(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(),
        format="json",
    )
    item_id = create_response.data["data"][
        "id"
    ]

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    response = api_client.patch(
        reverse(
            "project-monitor-api:action-item-detail",
            args=[item_id],
        ),
        {"responsibility": "Should fail"},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_project_manager_can_delete_an_action_item(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(),
        format="json",
    )
    item_id = create_response.data["data"][
        "id"
    ]

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    forbidden_delete = api_client.delete(
        reverse(
            "project-monitor-api:action-item-detail",
            args=[item_id],
        )
    )
    assert (
        forbidden_delete.status_code
        == status.HTTP_403_FORBIDDEN
    )

    api_client.force_authenticate(user=pm)
    delete_response = api_client.delete(
        reverse(
            "project-monitor-api:action-item-detail",
            args=[item_id],
        )
    )
    assert (
        delete_response.status_code
        == status.HTTP_200_OK
    )
    assert not ActionItem.objects.filter(
        id=item_id
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
def test_director_or_pm_or_admin_can_review_an_action_item(
    api_client, site, factory
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(),
        format="json",
    )
    activity_id = create_response.data["data"][
        "activity"
    ]["id"]

    reviewer = factory()
    api_client.force_authenticate(user=reviewer)
    response = api_client.post(
        reverse(
            "project-monitor-api:activity-review",
            args=[activity_id],
        ),
        {"remarks": "Looks fine."},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert (
        response.data["data"][
            "reviewed_by_name"
        ]
    )


@pytest.mark.django_db
def test_overview_reflects_real_action_item_counts(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    past_date = (
        timezone.localdate() - timedelta(days=1)
    )
    api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(target_date=str(past_date)),
        format="json",
    )
    api_client.post(
        f"{reverse('project-monitor-api:action-item-list')}?site={site.id}",
        _payload(
            name="Another open item",
            target_date="2027-01-01",
        ),
        format="json",
    )

    response = api_client.get(
        f"{reverse('project-monitor-api:overview')}?site={site.id}",
    )
    counts = response.data["data"]["counts"][
        "action_items"
    ]
    assert counts["open"] == 2
    assert counts["overdue"] == 1
