"""
The 48-hour edit/delete window on a task's own update/hide actions for
a Project Manager/Incharge, and the Admin/Director request-and-grant
recovery path once it has closed.
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    DirectorUserFactory,
    ProjectManagerUserFactory,
)
from apps.notifications.models import Notification
from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    Activity,
    ActivityEditAccessRequest,
    EditAccessRequestStatus,
    StructureTypeDefinition,
)
from apps.project_monitor.services import edit_access
from apps.project_monitor.services.structure_generator import (
    create_structure,
)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def pm():
    return ProjectManagerUserFactory()


@pytest.fixture
def director():
    return DirectorUserFactory()


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL", company_name="Jhajharia Nirman Limited"
    )
    return Site.objects.create(
        company=company,
        site_code="CHK",
        site_name="Chunar-Khairahi Doubling Pkg-I",
    )


@pytest.fixture
def minor_structure(site, pm):
    definition = StructureTypeDefinition.objects.get(code="MINOR")
    return create_structure(
        site=site,
        structure_type=definition,
        name="Br. No. 214",
        chainage_km=Decimal("12.345"),
        config={
            "w": 3,
            "h": 3,
            "cells": 1,
            "barrel": 12,
            "returns": 4,
            "stairs": 2,
            "apron": True,
        },
        actor=pm,
    )


@pytest.fixture
def activity(minor_structure):
    return Activity.objects.get(
        object_id=minor_structure.id, name="Box raft"
    )


def make_stale(activity, hours=50):
    Activity.objects.filter(pk=activity.pk).update(
        updated_at=timezone.now() - timedelta(hours=hours)
    )
    activity.refresh_from_db()
    return activity


def url(name, *args):
    return reverse(f"project-monitor-api:{name}", args=args)


@pytest.mark.django_db
class TestEditAccessService:
    def test_a_fresh_activity_is_within_its_window(self, activity):
        assert edit_access.is_within_edit_window(activity) is True

    def test_a_stale_activity_is_not(self, activity):
        make_stale(activity)
        assert edit_access.is_within_edit_window(activity) is False

    def test_admin_roles_can_always_edit(self, activity, director):
        make_stale(activity)
        assert edit_access.can_edit_activity(director, activity) is True

    def test_pm_cannot_edit_a_stale_activity_with_no_grant(
        self, activity, pm
    ):
        make_stale(activity)
        assert edit_access.can_edit_activity(pm, activity) is False

    def test_a_granted_request_lets_the_pm_edit_again(
        self, activity, pm, director
    ):
        make_stale(activity)
        edit_request = edit_access.request_edit_access(
            activity=activity, actor=pm
        )
        edit_access.grant_edit_access(edit_request, actor=director)

        assert edit_access.can_edit_activity(pm, activity) is True

    def test_an_expired_grant_no_longer_helps(self, activity, pm):
        make_stale(activity)
        request_obj = ActivityEditAccessRequest.objects.create(
            activity=activity,
            status=EditAccessRequestStatus.GRANTED,
            access_until=timezone.now() - timedelta(hours=1),
            created_by=pm,
            updated_by=pm,
        )
        assert not edit_access.has_active_grant(activity, pm)
        assert edit_access.can_edit_activity(pm, activity) is False
        assert request_obj.status == EditAccessRequestStatus.GRANTED

    def test_admin_and_director_never_need_to_request(
        self, activity, director
    ):
        make_stale(activity)
        with pytest.raises(Exception):
            edit_access.request_edit_access(
                activity=activity, actor=director
            )

    def test_cannot_request_while_still_inside_the_window(
        self, activity, pm
    ):
        with pytest.raises(Exception):
            edit_access.request_edit_access(
                activity=activity, actor=pm
            )

    def test_cannot_request_twice_while_one_is_pending(
        self, activity, pm
    ):
        make_stale(activity)
        edit_access.request_edit_access(activity=activity, actor=pm)
        with pytest.raises(Exception):
            edit_access.request_edit_access(
                activity=activity, actor=pm
            )

    def test_cannot_decide_a_request_twice(
        self, activity, pm, director
    ):
        make_stale(activity)
        edit_request = edit_access.request_edit_access(
            activity=activity, actor=pm
        )
        edit_access.grant_edit_access(edit_request, actor=director)
        with pytest.raises(Exception):
            edit_access.grant_edit_access(
                edit_request, actor=director
            )


@pytest.mark.django_db
class TestEditAccessAPI:
    def test_pm_can_update_a_fresh_task(self, api, site, activity):
        api.force_authenticate(user=ProjectManagerUserFactory())
        response = api.patch(
            f"{url('activity-update', activity.id)}?site={site.id}",
            {"meeting_date": "2026-10-01", "status": "IN_PROGRESS"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK

    def test_pm_is_refused_past_the_window(self, api, site, activity):
        make_stale(activity)
        api.force_authenticate(user=ProjectManagerUserFactory())
        response = api.patch(
            f"{url('activity-update', activity.id)}?site={site.id}",
            {"meeting_date": "2026-10-01", "status": "IN_PROGRESS"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "48 hours" in str(response.data)

    def test_pm_is_refused_hiding_a_stale_task(
        self, api, site, activity
    ):
        make_stale(activity)
        api.force_authenticate(user=ProjectManagerUserFactory())
        response = api.delete(
            f"{url('activity-update', activity.id)}?site={site.id}"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_pm_is_refused_unhiding_a_stale_task(
        self, api, site, activity
    ):
        user = ProjectManagerUserFactory()
        api.force_authenticate(user=user)
        api.delete(
            f"{url('activity-update', activity.id)}?site={site.id}"
        )
        make_stale(activity)
        response = api.post(
            f"{url('activity-unhide', activity.id)}?site={site.id}"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_director_is_never_refused(self, api, site, activity):
        make_stale(activity)
        api.force_authenticate(user=DirectorUserFactory())
        response = api.patch(
            f"{url('activity-update', activity.id)}?site={site.id}",
            {"meeting_date": "2026-10-01", "status": "IN_PROGRESS"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK

    def test_adding_a_brand_new_custom_activity_is_never_gated(
        self, api, site, minor_structure
    ):
        # Every existing row on the sheet is stale, but adding a new
        # one is a creation, not an edit of something already there.
        Activity.objects.filter(
            object_id=minor_structure.id
        ).update(
            updated_at=timezone.now() - timedelta(hours=50)
        )
        api.force_authenticate(user=ProjectManagerUserFactory())
        response = api.post(
            f"{url('structure-activity-create', minor_structure.id)}?site={site.id}",
            {"group_title": "Box structure", "name": "Extra check"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK

    def test_pm_can_request_access_once_locked(
        self, api, site, activity
    ):
        make_stale(activity)
        api.force_authenticate(user=ProjectManagerUserFactory())
        response = api.post(
            f"{url('edit-access-request-create', activity.id)}?site={site.id}",
            {"reason": "Need to correct yesterday's % done"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["status"] == "PENDING"

    def test_requesting_while_still_inside_the_window_is_refused(
        self, api, site, activity
    ):
        api.force_authenticate(user=ProjectManagerUserFactory())
        response = api.post(
            f"{url('edit-access-request-create', activity.id)}?site={site.id}",
            {},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_request_notifies_every_admin_and_director(
        self,
        api,
        site,
        activity,
        director,
        django_capture_on_commit_callbacks,
    ):
        make_stale(activity)
        api.force_authenticate(user=ProjectManagerUserFactory())
        with django_capture_on_commit_callbacks(execute=True):
            api.post(
                f"{url('edit-access-request-create', activity.id)}?site={site.id}",
                {},
                format="json",
            )

        assert Notification.objects.filter(
            recipient=director,
            event_type="PROJECT_MONITOR_EDIT_ACCESS_REQUESTED",
        ).exists()

    def test_a_pm_cannot_list_or_decide_requests(
        self, api, site, activity
    ):
        make_stale(activity)
        edit_request = edit_access.request_edit_access(
            activity=activity, actor=ProjectManagerUserFactory()
        )
        api.force_authenticate(user=ProjectManagerUserFactory())

        assert (
            api.get(url("edit-access-request-list")).status_code
            == status.HTTP_403_FORBIDDEN
        )
        assert (
            api.post(
                url(
                    "edit-access-request-grant",
                    edit_request.id,
                ),
                {},
                format="json",
            ).status_code
            == status.HTTP_403_FORBIDDEN
        )

    def test_director_grants_access_and_the_pm_can_then_edit(
        self,
        api,
        site,
        activity,
        django_capture_on_commit_callbacks,
    ):
        make_stale(activity)
        pm_user = ProjectManagerUserFactory()
        pm_client = APIClient()
        pm_client.force_authenticate(user=pm_user)
        pm_client.post(
            f"{url('edit-access-request-create', activity.id)}?site={site.id}",
            {"reason": "Need one more correction"},
            format="json",
        )
        edit_request = ActivityEditAccessRequest.objects.get(
            activity=activity
        )

        api.force_authenticate(user=DirectorUserFactory())
        with django_capture_on_commit_callbacks(execute=True):
            grant_response = api.post(
                url("edit-access-request-grant", edit_request.id),
                {"remarks": "Go ahead"},
                format="json",
            )
        assert grant_response.status_code == status.HTTP_200_OK
        assert (
            grant_response.data["data"]["status"] == "GRANTED"
        )

        update_response = pm_client.patch(
            f"{url('activity-update', activity.id)}?site={site.id}",
            {
                "meeting_date": "2026-10-01",
                "status": "IN_PROGRESS",
            },
            format="json",
        )
        assert update_response.status_code == status.HTTP_200_OK

        assert Notification.objects.filter(
            recipient=pm_user,
            event_type="PROJECT_MONITOR_EDIT_ACCESS_DECIDED",
        ).exists()

    def test_director_denies_access_and_the_pm_still_cannot_edit(
        self, api, site, activity
    ):
        make_stale(activity)
        pm_user = ProjectManagerUserFactory()
        pm_client = APIClient()
        pm_client.force_authenticate(user=pm_user)
        pm_client.post(
            f"{url('edit-access-request-create', activity.id)}?site={site.id}",
            {},
            format="json",
        )
        edit_request = ActivityEditAccessRequest.objects.get(
            activity=activity
        )

        api.force_authenticate(user=DirectorUserFactory())
        deny_response = api.post(
            url("edit-access-request-deny", edit_request.id),
            {"remarks": "Not justified"},
            format="json",
        )
        assert deny_response.status_code == status.HTTP_200_OK
        assert deny_response.data["data"]["status"] == "DENIED"

        update_response = pm_client.patch(
            f"{url('activity-update', activity.id)}?site={site.id}",
            {
                "meeting_date": "2026-10-01",
                "status": "IN_PROGRESS",
            },
            format="json",
        )
        assert (
            update_response.status_code
            == status.HTTP_403_FORBIDDEN
        )

    def test_admin_and_director_can_list_requests(
        self, api, site, activity, director
    ):
        make_stale(activity)
        edit_access.request_edit_access(
            activity=activity, actor=ProjectManagerUserFactory()
        )
        api.force_authenticate(user=director)
        response = api.get(url("edit-access-request-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["data"]) == 1
