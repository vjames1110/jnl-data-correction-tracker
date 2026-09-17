from datetime import date

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ProjectManagerUserFactory,
)
from apps.notifications.models import (
    Notification,
    NotificationEventType,
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
def director():
    return DirectorUserFactory()


@pytest.fixture
def site(director):
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    return Site.objects.create(
        company=company,
        site_code="CHK",
        site_name="Chunar-Khairahi Doubling Pkg-I",
        site_director=director,
    )


@pytest.fixture
def minor_type_id():
    return str(
        StructureTypeDefinition.objects.get(
            code="MINOR"
        ).id
    )


def _minor_bridge_payload(minor_type_id):
    return {
        "structure_type": minor_type_id,
        "name": "Br. No. 214",
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
def generating_pm():
    return ProjectManagerUserFactory()


@pytest.fixture
def structure(
    api_client, site, minor_type_id, generating_pm
):
    api_client.force_authenticate(user=generating_pm)
    response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )
    structure_id = response.data["data"]["id"]
    return Structure.objects.get(pk=structure_id)


def _first_activity_id(structure):
    return str(structure.activities.first().id)


def _second_activity_id(structure):
    activities = list(
        structure.activities.all()[:2]
    )
    return str(activities[1].id)


def _patch_activity(
    api_client,
    on_commit,
    activity_id,
    *,
    meeting_date,
    comment="Progressed",
):
    """
    ``notify_users()`` defers its DB write to ``transaction.on_commit``
    whenever it runs inside an atomic block - which every
    ``@pytest.mark.django_db`` test does. ``django_capture_on_commit_
    callbacks(execute=True)`` (a pytest-django fixture) runs those
    deferred callbacks for real without needing a genuine commit, so
    tests don't need ``TransactionTestCase``/``transaction=True``
    (which would flush the DB between tests and collide with the
    contenttypes framework's own re-seeding).
    """
    with on_commit(execute=True):
        response = api_client.patch(
            reverse(
                "project-monitor-api:activity-update",
                args=[activity_id],
            ),
            {
                "meeting_date": str(meeting_date),
                "comment": comment,
            },
            format="json",
        )
    return response


def _review(
    api_client, on_commit, activity_id, remarks=""
):
    with on_commit(execute=True):
        response = api_client.post(
            reverse(
                "project-monitor-api:activity-review",
                args=[activity_id],
            ),
            {"remarks": remarks},
            format="json",
        )
    return response


def _review_structure(
    api_client, on_commit, structure_id, remarks=""
):
    with on_commit(execute=True):
        response = api_client.post(
            reverse(
                "project-monitor-api:structure-review",
                args=[structure_id],
            ),
            {"remarks": remarks},
            format="json",
        )
    return response


@pytest.mark.django_db
def test_update_notifies_the_site_director(
    api_client,
    site,
    structure,
    director,
    django_capture_on_commit_callbacks,
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = _patch_activity(
        api_client,
        django_capture_on_commit_callbacks,
        _first_activity_id(structure),
        meeting_date=date(2026, 1, 5),
    )

    assert (
        response.status_code == status.HTTP_200_OK
    )
    assert Notification.objects.filter(
        recipient=director,
        event_type=(
            NotificationEventType.PROJECT_MONITOR_UPDATE_LOGGED
        ),
        payload__site=str(site.id),
        payload__meeting_date="2026-01-05",
    ).exists()


@pytest.mark.django_db
def test_a_second_update_same_meeting_date_does_not_duplicate(
    api_client,
    structure,
    director,
    django_capture_on_commit_callbacks,
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    _patch_activity(
        api_client,
        django_capture_on_commit_callbacks,
        _first_activity_id(structure),
        meeting_date=date(2026, 1, 5),
        comment="First row",
    )
    _patch_activity(
        api_client,
        django_capture_on_commit_callbacks,
        _second_activity_id(structure),
        meeting_date=date(2026, 1, 5),
        comment="Second row",
    )

    assert (
        Notification.objects.filter(
            recipient=director,
            event_type=(
                NotificationEventType.PROJECT_MONITOR_UPDATE_LOGGED
            ),
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_an_update_on_a_later_meeting_date_notifies_again(
    api_client,
    structure,
    director,
    django_capture_on_commit_callbacks,
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    _patch_activity(
        api_client,
        django_capture_on_commit_callbacks,
        _first_activity_id(structure),
        meeting_date=date(2026, 1, 5),
    )
    _patch_activity(
        api_client,
        django_capture_on_commit_callbacks,
        _second_activity_id(structure),
        meeting_date=date(2026, 2, 2),
    )

    assert (
        Notification.objects.filter(
            recipient=director,
            event_type=(
                NotificationEventType.PROJECT_MONITOR_UPDATE_LOGGED
            ),
        ).count()
        == 2
    )


@pytest.mark.django_db
def test_update_with_no_site_director_does_not_notify_or_error(
    api_client,
    minor_type_id,
    django_capture_on_commit_callbacks,
):
    company = Company.objects.create(
        company_code="NDL",
        company_name="No Director Ltd",
    )
    site_without_director = Site.objects.create(
        company=company,
        site_code="NDL1",
        site_name="No Director Site",
    )
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site_without_director.id}",
        _minor_bridge_payload(minor_type_id),
        format="json",
    )
    structure_obj = Structure.objects.get(
        pk=create_response.data["data"]["id"]
    )

    response = _patch_activity(
        api_client,
        django_capture_on_commit_callbacks,
        _first_activity_id(structure_obj),
        meeting_date=date(2026, 1, 5),
    )

    assert (
        response.status_code == status.HTTP_200_OK
    )
    assert not Notification.objects.filter(
        event_type=(
            NotificationEventType.PROJECT_MONITOR_UPDATE_LOGGED
        ),
    ).exists()


@pytest.mark.django_db
def test_reviewing_an_activity_notifies_its_last_updater(
    api_client,
    structure,
    director,
    django_capture_on_commit_callbacks,
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    activity_id = _first_activity_id(structure)
    _patch_activity(
        api_client,
        django_capture_on_commit_callbacks,
        activity_id,
        meeting_date=date(2026, 1, 5),
    )

    api_client.force_authenticate(user=director)
    response = _review(
        api_client,
        django_capture_on_commit_callbacks,
        activity_id,
        remarks="Looks good.",
    )

    assert (
        response.status_code == status.HTTP_200_OK
    )
    assert Notification.objects.filter(
        recipient=pm,
        event_type=(
            NotificationEventType.PROJECT_MONITOR_ACTIVITY_REVIEWED
        ),
    ).exists()


@pytest.mark.django_db
def test_reviewing_your_own_update_does_not_self_notify(
    api_client,
    structure,
    django_capture_on_commit_callbacks,
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    activity_id = _first_activity_id(structure)
    _patch_activity(
        api_client,
        django_capture_on_commit_callbacks,
        activity_id,
        meeting_date=date(2026, 1, 5),
    )

    _review(
        api_client,
        django_capture_on_commit_callbacks,
        activity_id,
        remarks="Self reviewed.",
    )

    assert not Notification.objects.filter(
        recipient=pm,
        event_type=(
            NotificationEventType.PROJECT_MONITOR_ACTIVITY_REVIEWED
        ),
    ).exists()


@pytest.mark.django_db
def test_reviewing_a_freshly_generated_activity_notifies_its_creator(
    api_client,
    structure,
    director,
    generating_pm,
    django_capture_on_commit_callbacks,
):
    """
    A generated Activity's ``updated_by`` is already the PM who
    generated the sheet (set at creation time, before any explicit
    "meeting update") - so reviewing it before anyone has touched it
    still has a well-defined, correct recipient.
    """
    activity_id = _first_activity_id(structure)

    api_client.force_authenticate(user=director)
    response = _review(
        api_client,
        django_capture_on_commit_callbacks,
        activity_id,
        remarks="First look.",
    )

    assert (
        response.status_code == status.HTTP_200_OK
    )
    assert Notification.objects.filter(
        recipient=generating_pm,
        event_type=(
            NotificationEventType.PROJECT_MONITOR_ACTIVITY_REVIEWED
        ),
    ).exists()


@pytest.mark.django_db
def test_reviewing_a_whole_structure_notifies_each_distinct_updater_once(
    api_client,
    structure,
    django_capture_on_commit_callbacks,
):
    pm = ProjectManagerUserFactory()
    admin = AdminUserFactory()
    activities = list(structure.activities.all()[:4])

    api_client.force_authenticate(user=pm)
    for activity in activities[:3]:
        _patch_activity(
            api_client,
            django_capture_on_commit_callbacks,
            str(activity.id),
            meeting_date=date(2026, 1, 5),
        )
    api_client.force_authenticate(user=admin)
    _patch_activity(
        api_client,
        django_capture_on_commit_callbacks,
        str(activities[3].id),
        meeting_date=date(2026, 1, 5),
    )

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    response = _review_structure(
        api_client,
        django_capture_on_commit_callbacks,
        structure.id,
        remarks="Reviewed at site visit.",
    )

    assert (
        response.status_code == status.HTTP_200_OK
    )
    reviewed_event = (
        NotificationEventType.PROJECT_MONITOR_ACTIVITY_REVIEWED
    )
    assert (
        Notification.objects.filter(
            recipient=pm, event_type=reviewed_event
        ).count()
        == 1
    )
    assert (
        Notification.objects.filter(
            recipient=admin, event_type=reviewed_event
        ).count()
        == 1
    )
