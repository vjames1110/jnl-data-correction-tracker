"""
The "+" that adds a hand-entered activity to an existing section of a
Structure/Building sheet, and the rule that a structure config edit
never reconciles a custom row away.
"""

from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    DirectorUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    Activity,
    Building,
    Structure,
    StructureTypeDefinition,
)
from apps.project_monitor.services.building_generator import (
    create_building,
)
from apps.project_monitor.services.structure_generator import (
    create_structure,
    update_structure,
)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def pm():
    return ProjectManagerUserFactory()


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
def building(site, pm):
    return create_building(
        site=site,
        name="Station building",
        station_label="Chunar",
        chainage_km=Decimal("5.000"),
        config={"gfArea": 200, "floors": 1},
        actor=pm,
    )


def url(name, *args):
    return reverse(f"project-monitor-api:{name}", args=args)


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def rows_of(response, group_title):
    for group in response.data["data"]["groups"]:
        if group["group_title"] == group_title:
            return group["rows"]
    raise AssertionError(f"no such group: {group_title}")


@pytest.mark.django_db
class TestAddingACustomActivity:
    def test_it_lands_at_the_end_of_the_section_by_default(
        self, api, site, minor_structure
    ):
        api.force_authenticate(user=ProjectManagerUserFactory())

        response = api.post(
            f"{url('structure-activity-create', minor_structure.id)}?site={site.id}",
            {
                "group_title": "Box structure",
                "name": "Anti-carbonation coating",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        rows = rows_of(response, "Box structure")
        assert rows[-1]["name"] == "Anti-carbonation coating"
        assert rows[-1]["is_custom"] is True
        assert rows[-1]["status"] == "NOT_STARTED"
        # It didn't create a new section of its own.
        titles = {g["group_title"] for g in response.data["data"]["groups"]}
        assert titles == {"Approvals", "Box structure"}

    def test_it_can_be_inserted_before_a_named_task(
        self, api, site, minor_structure
    ):
        api.force_authenticate(user=ProjectManagerUserFactory())
        before = Activity.objects.get(
            object_id=minor_structure.id, name="R/W 3"
        )

        response = api.post(
            f"{url('structure-activity-create', minor_structure.id)}?site={site.id}",
            {
                "group_title": "Box structure",
                "name": "Waterproofing check",
                "position": "before",
                "relative_activity_id": str(before.id),
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        names = [r["name"] for r in rows_of(response, "Box structure")]
        assert (
            names.index("Waterproofing check")
            == names.index("R/W 3") - 1
        )

    def test_it_can_be_inserted_after_a_named_task(
        self, api, site, minor_structure
    ):
        api.force_authenticate(user=ProjectManagerUserFactory())
        after = Activity.objects.get(
            object_id=minor_structure.id, name="R/W 3"
        )

        response = api.post(
            f"{url('structure-activity-create', minor_structure.id)}?site={site.id}",
            {
                "group_title": "Box structure",
                "name": "Curing record",
                "position": "after",
                "relative_activity_id": str(after.id),
            },
            format="json",
        )

        names = [r["name"] for r in rows_of(response, "Box structure")]
        assert names.index("Curing record") == names.index("R/W 3") + 1

    def test_a_length_activity_keeps_its_unit(
        self, api, site, minor_structure
    ):
        api.force_authenticate(user=ProjectManagerUserFactory())

        response = api.post(
            f"{url('structure-activity-create', minor_structure.id)}?site={site.id}",
            {
                "group_title": "Box structure",
                "name": "Approach road metalling",
                "kind": "LENGTH",
                "unit": "m",
            },
            format="json",
        )

        row = rows_of(response, "Box structure")[-1]
        assert row["kind"] == "LENGTH"
        assert row["unit"] == "m"

    def test_before_or_after_requires_a_task_to_place_it_against(
        self, api, site, minor_structure
    ):
        api.force_authenticate(user=ProjectManagerUserFactory())

        response = api.post(
            f"{url('structure-activity-create', minor_structure.id)}?site={site.id}",
            {
                "group_title": "Box structure",
                "name": "Anything",
                "position": "before",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_the_relative_task_must_be_in_the_same_section(
        self, api, site, minor_structure
    ):
        api.force_authenticate(user=ProjectManagerUserFactory())
        approval = Activity.objects.get(
            object_id=minor_structure.id, name="GAD approval"
        )

        response = api.post(
            f"{url('structure-activity-create', minor_structure.id)}?site={site.id}",
            {
                "group_title": "Box structure",
                "name": "Anything",
                "position": "before",
                "relative_activity_id": str(approval.id),
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_an_unknown_section_is_refused(
        self, api, site, minor_structure
    ):
        api.force_authenticate(user=ProjectManagerUserFactory())

        response = api.post(
            f"{url('structure-activity-create', minor_structure.id)}?site={site.id}",
            {"group_title": "Not a real section", "name": "Anything"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_works_on_a_building_the_same_way(
        self, api, site, building
    ):
        api.force_authenticate(user=ProjectManagerUserFactory())

        response = api.post(
            f"{url('building-activity-create', building.id)}?site={site.id}",
            {
                "group_title": "Ground Floor",
                "name": "Skirting",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        rows = rows_of(response, "Ground Floor")
        assert rows[-1]["name"] == "Skirting"

    def test_director_can_add_one_too(self, api, site, minor_structure):
        # The Director has every Project Monitor entry right, same as
        # an Admin - see apps/project_monitor/services/project_scope.py.
        api.force_authenticate(user=DirectorUserFactory())

        response = api.post(
            f"{url('structure-activity-create', minor_structure.id)}?site={site.id}",
            {"group_title": "Box structure", "name": "Anything"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK

    def test_someone_with_no_project_monitor_access_cannot_add_one(
        self, api, site, minor_structure
    ):
        api.force_authenticate(user=UserFactory())

        response = api.post(
            f"{url('structure-activity-create', minor_structure.id)}?site={site.id}",
            {"group_title": "Box structure", "name": "Anything"},
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestDeletingACustomActivity:
    def test_a_custom_activity_can_be_deleted(
        self, api, site, minor_structure
    ):
        api.force_authenticate(user=ProjectManagerUserFactory())
        add = api.post(
            f"{url('structure-activity-create', minor_structure.id)}?site={site.id}",
            {"group_title": "Box structure", "name": "Extra check"},
            format="json",
        )
        activity_id = next(
            r["id"]
            for r in rows_of(add, "Box structure")
            if r["name"] == "Extra check"
        )

        response = api.delete(
            f"{url('activity-update', activity_id)}?site={site.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        assert not Activity.objects.filter(pk=activity_id).exists()

    def test_a_generated_activity_cannot_be_deleted(
        self, api, site, minor_structure
    ):
        api.force_authenticate(user=ProjectManagerUserFactory())
        generated = Activity.objects.get(
            object_id=minor_structure.id, name="Box raft"
        )

        response = api.delete(
            f"{url('activity-update', generated.id)}?site={site.id}"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert Activity.objects.filter(pk=generated.id).exists()


@pytest.mark.django_db
class TestCustomActivitiesSurviveAStructureEdit:
    def test_editing_the_config_never_touches_a_custom_row(
        self, site, pm, minor_structure
    ):
        from apps.project_monitor.services.activity_engine import (
            add_custom_activity,
        )

        custom = add_custom_activity(
            parent=minor_structure,
            group_title="Box structure",
            name="Site inspection note",
            actor=pm,
        )
        custom.status = "IN_PROGRESS"
        custom.done_qty = 40
        custom.save()

        # Shrink the return walls from 4 to 2 - a config edit that
        # would ordinarily mark removed rows Not Applicable.
        update_structure(
            structure=minor_structure,
            config={
                "w": 3,
                "h": 3,
                "cells": 1,
                "barrel": 12,
                "returns": 2,
                "stairs": 2,
                "apron": True,
            },
            actor=pm,
        )

        custom.refresh_from_db()
        assert custom.status == "IN_PROGRESS"
        assert custom.done_qty == 40
        assert custom.group_title == "Box structure"

        response = client_for(pm).get(
            f"{url('structure-detail', minor_structure.id)}?site={site.id}"
        )
        rows = rows_of(response, "Box structure")
        names = [r["name"] for r in rows]
        assert "Site inspection note" in names
        # The shrunk return walls are still reconciled normally.
        rw3 = next(r for r in rows if r["name"] == "R/W 3")
        assert rw3["status"] == "NOT_APPLICABLE"
