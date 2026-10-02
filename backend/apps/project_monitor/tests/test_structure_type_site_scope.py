"""
Site-scoped Structure Types: a Project Manager/Incharge may now
create/edit a structure type owned by their own site - never a
global one, never another site's - and an Admin/Director may give
another site use-access to it ("distribute"), which lets that site
pick the type but never edit it. Company-wide roles
(Director/Admin/Super Admin/Project HO) are unaffected - they still
see and may edit everything, same as before this feature.

Runs against the real per-site rules (``real_scope``), not the
"every progress task on every site" shortcut most other Project
Monitor tests use by default.
"""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ProjectHoUserFactory,
    ProjectInchargeUserFactory,
    ProjectManagerUserFactory,
)
from apps.project_monitor.models import StructureTypeDefinition
from apps.project_monitor.tests.scope_helpers import grant

pytestmark = [pytest.mark.real_scope, pytest.mark.django_db]

OK = status.HTTP_200_OK
BAD = status.HTTP_400_BAD_REQUEST
DENIED = status.HTTP_403_FORBIDDEN


def url(name, *args):
    return reverse(f"project-monitor-api:{name}", args=args)


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _payload(code="ESP"):
    return {
        "code": code,
        "name": "ESP structure",
        "config_schema": [
            {"key": "n", "type": "number", "default": 2}
        ],
        "group_templates": [
            {
                "kind": "static",
                "title": "X",
                "rows": [{"name": "Row"}],
            }
        ],
    }


def _owned_type(site, code="OWNED"):
    return StructureTypeDefinition.objects.create(
        code=code,
        name="Owned type",
        config_schema=[],
        group_templates=[
            {
                "kind": "static",
                "title": "X",
                "rows": [{"name": "Row"}],
            }
        ],
        owner_site=site,
    )


class TestCreate:
    def test_pm_creates_a_type_owned_by_their_granted_site(
        self, site
    ):
        pm = grant(
            ProjectManagerUserFactory(), site, "STRUCTURES"
        )

        response = client_for(pm).post(
            f"{url('structure-type-list')}?site={site.id}",
            _payload(),
            format="json",
        )

        assert response.status_code == OK
        created = StructureTypeDefinition.objects.get(
            code="ESP"
        )
        assert created.owner_site_id == site.id

    def test_pm_cannot_create_for_a_site_they_are_not_granted_structures_on(
        self, site, other_site
    ):
        pm = grant(
            ProjectManagerUserFactory(),
            other_site,
            "STRUCTURES",
        )

        response = client_for(pm).post(
            f"{url('structure-type-list')}?site={site.id}",
            _payload(),
            format="json",
        )

        assert response.status_code == DENIED
        assert not StructureTypeDefinition.objects.filter(
            code="ESP"
        ).exists()

    def test_a_different_task_grant_is_not_enough(
        self, site
    ):
        pm = grant(ProjectManagerUserFactory(), site, "DPR_BILLS")

        response = client_for(pm).post(
            f"{url('structure-type-list')}?site={site.id}",
            _payload(),
            format="json",
        )

        assert response.status_code == DENIED

    def test_body_cannot_force_a_different_owner_site(
        self, site, other_site
    ):
        pm = grant(
            ProjectManagerUserFactory(), site, "STRUCTURES"
        )

        response = client_for(pm).post(
            f"{url('structure-type-list')}?site={site.id}",
            {**_payload(), "owner_site": str(other_site.id)},
            format="json",
        )

        assert response.status_code == OK
        created = StructureTypeDefinition.objects.get(
            code="ESP"
        )
        assert created.owner_site_id == site.id

    def test_incharge_creates_a_type_owned_by_their_granted_site(
        self, site
    ):
        incharge = grant(
            ProjectInchargeUserFactory(),
            site,
            "STRUCTURES",
        )

        response = client_for(incharge).post(
            f"{url('structure-type-list')}?site={site.id}",
            _payload(),
            format="json",
        )

        assert response.status_code == OK


class TestRead:
    def test_site_filter_shows_global_owned_and_distributed_types(
        self, site, other_site
    ):
        owned_by_site = _owned_type(site, "BYSITE")
        owned_by_other = _owned_type(other_site, "BYOTHER")
        owned_by_other.distributed_sites.add(site)
        pm = grant(
            ProjectManagerUserFactory(), site, "STRUCTURES"
        )

        response = client_for(pm).get(
            f"{url('structure-type-list')}?site={site.id}",
        )

        codes = {row["code"] for row in response.data["data"]}
        assert "MINOR" in codes  # global built-in
        assert "BYSITE" in codes  # owned by this site
        assert "BYOTHER" in codes  # distributed to this site

    def test_a_type_owned_by_another_undistributed_site_is_hidden(
        self, site, other_site
    ):
        _owned_type(other_site, "BYOTHER")
        pm = grant(
            ProjectManagerUserFactory(), site, "STRUCTURES"
        )

        response = client_for(pm).get(
            f"{url('structure-type-list')}?site={site.id}",
        )

        codes = {row["code"] for row in response.data["data"]}
        assert "BYOTHER" not in codes

    def test_no_site_param_unions_every_granted_site_for_a_pm(
        self, site, other_site
    ):
        _owned_type(site, "BYSITE")
        _owned_type(other_site, "BYOTHER")
        pm = ProjectManagerUserFactory()
        grant(pm, site, "STRUCTURES")
        # Granted on other_site too, but NOT the Structures task -
        # its own type must not leak through.
        grant(pm, other_site, "DPR_BILLS")

        response = client_for(pm).get(url("structure-type-list"))

        codes = {row["code"] for row in response.data["data"]}
        assert "BYSITE" in codes
        assert "BYOTHER" not in codes

    def test_company_wide_roles_see_everything_with_no_site_param(
        self, site
    ):
        _owned_type(site, "BYSITE")

        response = client_for(
            DirectorUserFactory()
        ).get(url("structure-type-list"))

        codes = {row["code"] for row in response.data["data"]}
        assert "BYSITE" in codes


class TestEdit:
    def test_pm_can_edit_their_own_sites_type(self, site):
        owned = _owned_type(site, "MINE")
        pm = grant(
            ProjectManagerUserFactory(), site, "STRUCTURES"
        )

        response = client_for(pm).patch(
            url("structure-type-detail", owned.id),
            {"name": "Renamed"},
            format="json",
        )

        assert response.status_code == OK
        owned.refresh_from_db()
        assert owned.name == "Renamed"

    def test_pm_cannot_edit_a_global_type(self, site):
        global_type = StructureTypeDefinition.objects.get(
            code="MINOR"
        )
        pm = grant(
            ProjectManagerUserFactory(), site, "STRUCTURES"
        )

        response = client_for(pm).patch(
            url("structure-type-detail", global_type.id),
            {"name": "Renamed"},
            format="json",
        )

        assert response.status_code == DENIED

    def test_pm_cannot_edit_another_sites_type(
        self, site, other_site
    ):
        owned = _owned_type(other_site, "THEIRS")
        pm = grant(
            ProjectManagerUserFactory(), site, "STRUCTURES"
        )

        response = client_for(pm).patch(
            url("structure-type-detail", owned.id),
            {"name": "Renamed"},
            format="json",
        )

        assert response.status_code == DENIED

    def test_distribution_grants_use_not_edit(
        self, site, other_site
    ):
        owned = _owned_type(other_site, "THEIRS")
        owned.distributed_sites.add(site)
        pm = grant(
            ProjectManagerUserFactory(), site, "STRUCTURES"
        )

        response = client_for(pm).patch(
            url("structure-type-detail", owned.id),
            {"name": "Renamed"},
            format="json",
        )

        assert response.status_code == DENIED

    def test_director_can_still_edit_any_site_owned_type(
        self, site
    ):
        owned = _owned_type(site, "MINE")

        response = client_for(
            DirectorUserFactory()
        ).patch(
            url("structure-type-detail", owned.id),
            {"name": "Renamed"},
            format="json",
        )

        assert response.status_code == OK


class TestDistribute:
    def test_admin_can_distribute_a_site_owned_type(
        self, site, other_site
    ):
        owned = _owned_type(site, "MINE")

        response = client_for(AdminUserFactory()).patch(
            url("structure-type-distribute", owned.id),
            {"site_ids": [str(other_site.id)]},
            format="json",
        )

        assert response.status_code == OK
        assert list(
            owned.distributed_sites.values_list(
                "id", flat=True
            )
        ) == [other_site.id]

    def test_director_can_distribute_too(self, site, other_site):
        owned = _owned_type(site, "MINE")

        response = client_for(DirectorUserFactory()).patch(
            url("structure-type-distribute", owned.id),
            {"site_ids": [str(other_site.id)]},
            format="json",
        )

        assert response.status_code == OK

    @pytest.mark.parametrize(
        "factory",
        [
            ProjectHoUserFactory,
            ProjectManagerUserFactory,
            ProjectInchargeUserFactory,
        ],
    )
    def test_nobody_else_can_distribute(
        self, site, other_site, factory
    ):
        owned = _owned_type(site, "MINE")

        response = client_for(factory()).patch(
            url("structure-type-distribute", owned.id),
            {"site_ids": [str(other_site.id)]},
            format="json",
        )

        assert response.status_code == DENIED

    def test_a_global_type_cannot_be_distributed(self):
        global_type = StructureTypeDefinition.objects.get(
            code="MINOR"
        )

        response = client_for(AdminUserFactory()).patch(
            url("structure-type-distribute", global_type.id),
            {"site_ids": []},
            format="json",
        )

        assert response.status_code == BAD

    def test_distributing_replaces_the_full_set(
        self, site, other_site, company
    ):
        from apps.organization.models import Site

        third_site = Site.objects.create(
            company=company,
            site_code="THIRD",
            site_name="Third Project",
        )
        owned = _owned_type(site, "MINE")
        owned.distributed_sites.set([other_site, third_site])

        response = client_for(AdminUserFactory()).patch(
            url("structure-type-distribute", owned.id),
            {"site_ids": [str(third_site.id)]},
            format="json",
        )

        assert response.status_code == OK
        assert list(
            owned.distributed_sites.values_list(
                "id", flat=True
            )
        ) == [third_site.id]

    def test_the_owner_site_itself_is_excluded(self, site):
        owned = _owned_type(site, "MINE")

        response = client_for(AdminUserFactory()).patch(
            url("structure-type-distribute", owned.id),
            {"site_ids": [str(site.id)]},
            format="json",
        )

        assert response.status_code == OK
        assert owned.distributed_sites.count() == 0
