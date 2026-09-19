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
    UserFactory,
)
from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    Structure,
    StructureTypeDefinition,
)
from apps.project_monitor.services.linear_generator import (
    create_linear_item,
    create_progress_entry,
    create_scope_patch,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def company():
    return Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )


@pytest.fixture
def site(company):
    return Site.objects.create(
        company=company,
        site_code="CHK",
        site_name="Chunar-Khairahi Doubling Pkg-I",
    )


@pytest.fixture
def empty_site(company):
    return Site.objects.create(
        company=company,
        site_code="EMP",
        site_name="Nothing Here Yet",
    )


@pytest.fixture
def pm():
    return ProjectManagerUserFactory()


@pytest.fixture
def minor_type_id():
    return str(
        StructureTypeDefinition.objects.get(
            code="MINOR"
        ).id
    )


def _create_structure(
    api_client, pm, site, minor_type_id, name="Br. 1"
):
    api_client.force_authenticate(user=pm)
    response = api_client.post(
        f"{reverse('project-monitor-api:structure-list')}?site={site.id}",
        {
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
        },
        format="json",
    )
    return Structure.objects.get(
        pk=response.data["data"]["id"]
    )


def _patch(
    api_client, activity, meeting, **fields
):
    return api_client.patch(
        reverse(
            "project-monitor-api:activity-update",
            args=[activity.id],
        ),
        {"meeting_date": str(meeting), **fields},
        format="json",
    )


@pytest.fixture
def structure(api_client, pm, site, minor_type_id):
    return _create_structure(
        api_client, pm, site, minor_type_id
    )


def _dashboard(api_client, **params):
    return api_client.get(
        reverse("project-monitor-api:dashboard"),
        params,
    )


@pytest.mark.django_db
def test_dashboard_lists_monitored_sites_and_hides_empty_ones(
    api_client, structure, empty_site, pm
):
    api_client.force_authenticate(user=pm)

    response = _dashboard(api_client)

    assert response.status_code == status.HTTP_200_OK
    data = response.data["data"]
    codes = [
        p["site"]["site_code"] for p in data["projects"]
    ]
    assert codes == ["CHK"]
    assert data["totals"]["projects"] == 1
    assert data["totals"]["hidden_empty_sites"] == 1

    with_empty = _dashboard(
        api_client, include_empty="1"
    ).data["data"]
    assert {
        p["site"]["site_code"]
        for p in with_empty["projects"]
    } == {"CHK", "EMP"}


@pytest.mark.django_db
def test_dashboard_progress_status_breakdown_and_percent(
    api_client, structure, pm
):
    activities = list(structure.activities.all())
    meeting = timezone.localdate()
    _patch(
        api_client,
        activities[0],
        meeting,
        status="COMPLETE",
    )
    _patch(
        api_client,
        activities[1],
        meeting,
        status="IN_PROGRESS",
    )
    _patch(
        api_client, activities[2], meeting, status="HOLD"
    )

    project = _dashboard(api_client).data["data"][
        "projects"
    ][0]

    counts = project["activities"]
    assert counts["done"] == 1
    assert counts["in_progress"] == 1
    assert counts["hold"] == 1
    assert counts["total"] > 3
    assert counts["percent_complete"] == round(
        1 / counts["total"] * 100, 1
    )
    assert project["modules"]["structures"]["done"] == 1
    assert project["modules"]["buildings"]["total"] == 0
    assert project["money"] is None


@pytest.mark.django_db
def test_dashboard_counts_overdue_open_activities_only(
    api_client, structure
):
    activities = list(structure.activities.all())
    meeting = timezone.localdate()
    past = timezone.localdate() - timedelta(days=5)
    future = timezone.localdate() + timedelta(days=5)
    _patch(
        api_client,
        activities[0],
        meeting,
        new_target_date=str(past),
    )
    _patch(
        api_client,
        activities[1],
        meeting,
        new_target_date=str(future),
    )
    # Overdue date but completed - must not count.
    _patch(
        api_client,
        activities[2],
        meeting,
        new_target_date=str(past),
        status="COMPLETE",
    )

    data = _dashboard(api_client).data["data"]

    assert data["projects"][0]["overdue"]["total"] == 1
    assert data["totals"]["overdue"] == 1


@pytest.mark.django_db
def test_dashboard_linear_chainage_progress(
    api_client, site, pm
):
    item = create_linear_item(
        site=site, name="Earthwork", unit="M", actor=pm
    )
    create_scope_patch(
        linear_item=item,
        from_chainage_km=Decimal("0"),
        to_chainage_km=Decimal("2"),
        side="BOTH",
        actor=pm,
    )
    create_progress_entry(
        linear_item=item,
        date=timezone.localdate(),
        from_chainage_km=Decimal("0"),
        to_chainage_km=Decimal("0.5"),
        side="BOTH",
        status="COMPLETE",
        meeting_date=timezone.localdate(),
        actor=pm,
    )
    api_client.force_authenticate(user=pm)

    project = _dashboard(api_client).data["data"][
        "projects"
    ][0]

    assert project["linear"]["scope_m"] == 2000
    assert project["linear"]["done_m"] == 500
    assert project["linear"]["percent"] == 25.0


@pytest.mark.django_db
def test_dashboard_countdown_tally(api_client, site, pm):
    site.end_date = timezone.localdate() + timedelta(
        days=10
    )
    site.save()
    api_client.force_authenticate(user=pm)

    data = _dashboard(api_client).data["data"]

    assert data["totals"]["countdown"]["RED"] == 1
    assert (
        data["projects"][0]["site"]["countdown_status"]
        == "RED"
    )


@pytest.mark.django_db
def test_director_can_read_dashboard_but_plain_user_cannot(
    api_client, structure
):
    api_client.force_authenticate(
        user=DirectorUserFactory()
    )
    assert (
        _dashboard(api_client).status_code
        == status.HTTP_200_OK
    )

    api_client.force_authenticate(user=UserFactory())
    assert (
        _dashboard(api_client).status_code
        == status.HTTP_403_FORBIDDEN
    )


def _due(api_client, **params):
    return api_client.get(
        reverse("project-monitor-api:due-tracker"),
        params,
    )


@pytest.fixture
def dated_structure(api_client, structure):
    """
    Four open activities with target dates today-5, today,
    today+3 and today+20, plus one completed activity that is
    overdue (must never be listed).
    """
    today = timezone.localdate()
    activities = list(structure.activities.all())
    offsets = [-5, 0, 3, 20]
    for activity, offset in zip(activities, offsets):
        _patch(
            api_client,
            activity,
            today,
            new_target_date=str(
                today + timedelta(days=offset)
            ),
        )
    _patch(
        api_client,
        activities[4],
        today,
        new_target_date=str(today - timedelta(days=9)),
        status="COMPLETE",
    )
    return structure, activities


@pytest.mark.django_db
def test_due_tracker_modes(api_client, dated_structure, pm):
    _, activities = dated_structure
    api_client.force_authenticate(user=pm)

    def ids(mode):
        rows = _due(api_client, mode=mode).data["data"][
            "rows"
        ]
        return {r["activity_id"] for r in rows}

    ids_by_offset = {
        offset: str(activities[i].id)
        for i, offset in enumerate([-5, 0, 3, 20])
    }

    assert ids("date") == {ids_by_offset[0]}
    assert ids("week") == {
        ids_by_offset[0],
        ids_by_offset[3],
    }
    assert ids("overdue") == {ids_by_offset[-5]}
    assert ids("upcoming") == {
        ids_by_offset[0],
        ids_by_offset[3],
        ids_by_offset[20],
    }


@pytest.mark.django_db
def test_due_tracker_row_details(
    api_client, dated_structure, pm
):
    structure, activities = dated_structure
    today = timezone.localdate()
    _patch(
        api_client,
        activities[1],
        today,
        new_target_date=str(today + timedelta(days=1)),
        comment="Shuttering delayed",
    )
    api_client.force_authenticate(user=pm)

    rows = _due(
        api_client, mode="upcoming"
    ).data["data"]["rows"]
    row = next(
        r
        for r in rows
        if r["activity_id"] == str(activities[1].id)
    )

    assert row["module"] == "structures"
    assert row["site_code"] == "CHK"
    assert "Br. 1" in row["where"]
    assert row["target_date"] == today + timedelta(days=1)
    assert row["earlier_dates"] == [today]
    assert "Shuttering delayed" in row["last_remark"]
    assert row["is_overdue"] is False


@pytest.mark.django_db
def test_due_tracker_can_be_scoped_to_one_site(
    api_client, dated_structure, company, pm, minor_type_id
):
    other = Site.objects.create(
        company=company,
        site_code="OTH",
        site_name="Other Project",
    )
    other_structure = _create_structure(
        api_client, pm, other, minor_type_id, name="Br. 9"
    )
    today = timezone.localdate()
    _patch(
        api_client,
        other_structure.activities.first(),
        today,
        new_target_date=str(today),
    )

    everything = _due(
        api_client, mode="date"
    ).data["data"]["rows"]
    scoped = _due(
        api_client, mode="date", site=str(other.id)
    ).data["data"]["rows"]

    assert {r["site_code"] for r in everything} == {
        "CHK",
        "OTH",
    }
    assert {r["site_code"] for r in scoped} == {"OTH"}


@pytest.mark.django_db
@pytest.mark.parametrize(
    "params",
    [
        {"mode": "bogus"},
        {"date": "05-01-2026"},
        {"site": "not-a-uuid"},
    ],
)
def test_due_tracker_rejects_bad_params(
    api_client, pm, params
):
    api_client.force_authenticate(user=pm)

    response = _due(api_client, **params)

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_overdue_counts_per_module(
    api_client, dated_structure, site, pm
):
    api_client.force_authenticate(user=pm)

    response = api_client.get(
        reverse("project-monitor-api:overdue-counts"),
        {"site": str(site.id)},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["data"] == {
        "structures": 1,
        "buildings": 0,
        "girders": 0,
        "action_items": 0,
    }


@pytest.mark.django_db
def test_overdue_counts_requires_a_site(api_client, pm):
    api_client.force_authenticate(user=pm)

    response = api_client.get(
        reverse("project-monitor-api:overdue-counts")
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


# ---- finance "money" slot visibility ---------------------------------


@pytest.fixture
def money_site(company, pm):
    from apps.project_monitor.models import (
        DprEntry,
        DprEntrySource,
    )
    from apps.project_monitor.services import dpr

    site = Site.objects.create(
        company=company,
        site_code="FIN",
        site_name="Finance Site",
        project_value=Decimal("1000000"),
        end_date=timezone.localdate() + timedelta(days=20),
    )
    item = dpr.create_item(
        site=site,
        description="Earthwork",
        item_no="1",
        scope_qty=Decimal("10000"),
        rate=Decimal("100"),
    )
    DprEntry.objects.create(
        item=item,
        date=timezone.localdate() - timedelta(days=1),
        qty=Decimal("100"),
        rate=Decimal("100"),
        source=DprEntrySource.DETAILED,
    )
    return site


@pytest.mark.django_db
def test_dashboard_money_is_visible_to_director_and_admin(
    api_client, money_site
):
    from apps.authentication.tests.factories import (
        AdminUserFactory,
    )

    for user in (DirectorUserFactory(), AdminUserFactory()):
        api_client.force_authenticate(user=user)

        data = _dashboard(api_client).data["data"]

        money = data["projects"][0]["money"]
        assert money["work_done_total"] == Decimal("10000")
        assert money["balance_value"] == Decimal("990000")
        assert data["totals"]["money"]["projects"] == 1


@pytest.mark.django_db
def test_dashboard_money_only_reaches_assigned_project_managers(
    api_client, money_site, pm
):
    from apps.project_monitor.models import ProjectSiteAccess

    api_client.force_authenticate(user=pm)
    unassigned = _dashboard(api_client).data["data"]
    assert unassigned["projects"][0]["money"] is None
    assert unassigned["totals"]["money"] is None

    ProjectSiteAccess.objects.create(site=money_site, user=pm)
    assigned = _dashboard(api_client).data["data"]
    assert (
        assigned["projects"][0]["money"]["work_done_total"]
        == Decimal("10000")
    )
