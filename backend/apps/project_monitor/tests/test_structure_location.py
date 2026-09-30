"""
StructureLocation - a named Chainage/Ramp list attached to a
Structure, for sites that have no real chainage at all (only ramps)
or a structure that spans more than one of either.
``Structure.chainage_km`` itself is kept in sync automatically - see
``services.structure_locations``.
"""

from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    ProjectManagerUserFactory,
)
from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    StructureLocation,
    StructureLocationType,
    StructureTypeDefinition,
)
from apps.project_monitor.services.structure_generator import (
    create_structure,
)
from apps.project_monitor.services.structure_locations import (
    create_location,
    delete_location,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    return Site.objects.create(
        company=company,
        site_code="LOC1",
        site_name="Location Test Site",
    )


@pytest.fixture
def minor_type():
    return StructureTypeDefinition.objects.get(code="MINOR")


@pytest.fixture
def structure(site, minor_type):
    return create_structure(
        site=site,
        structure_type=minor_type,
        name="Br. No. 500",
        chainage_km=None,
        config={},
        actor=None,
    )


class TestStructureLocationModel:
    def test_name_whitespace_is_normalized(self, structure):
        location = StructureLocation.objects.create(
            structure=structure,
            location_type=StructureLocationType.RAMP,
            name="  R2   Down  ",
        )

        assert location.name == "R2 Down"

    def test_a_location_without_a_name_is_allowed(
        self, structure
    ):
        location = StructureLocation.objects.create(
            structure=structure,
            location_type=StructureLocationType.CHAINAGE,
            chainage_km=Decimal("1.000"),
        )

        assert location.name == ""

    def test_deleting_the_structure_cascades_to_its_locations(
        self, structure
    ):
        StructureLocation.objects.create(
            structure=structure,
            location_type=StructureLocationType.CHAINAGE,
            chainage_km=Decimal("1.000"),
        )

        structure.delete()

        assert StructureLocation.objects.count() == 0


class TestChainageSync:
    def test_adding_a_chainage_location_sets_the_structures_own_chainage(
        self, structure
    ):
        create_location(
            structure=structure,
            location_type=StructureLocationType.CHAINAGE,
            chainage_km=Decimal("12.500"),
            actor=None,
        )

        structure.refresh_from_db()
        assert structure.chainage_km == Decimal(
            "12.500"
        )

    def test_the_smallest_chainage_location_wins(
        self, structure
    ):
        create_location(
            structure=structure,
            location_type=StructureLocationType.CHAINAGE,
            chainage_km=Decimal("12.500"),
            actor=None,
        )
        create_location(
            structure=structure,
            location_type=StructureLocationType.CHAINAGE,
            name="Down line",
            chainage_km=Decimal("8.000"),
            actor=None,
        )

        structure.refresh_from_db()
        assert structure.chainage_km == Decimal(
            "8.000"
        )

    def test_a_ramp_only_location_leaves_chainage_unset(
        self, structure
    ):
        create_location(
            structure=structure,
            location_type=StructureLocationType.RAMP,
            name="R2",
            actor=None,
        )

        structure.refresh_from_db()
        assert structure.chainage_km is None

    def test_a_ramps_own_numeric_value_does_not_affect_chainage(
        self, structure
    ):
        create_location(
            structure=structure,
            location_type=StructureLocationType.RAMP,
            name="R2",
            chainage_km=Decimal("3.000"),
            actor=None,
        )

        structure.refresh_from_db()
        assert structure.chainage_km is None

    def test_deleting_the_only_chainage_location_clears_it_again(
        self, structure
    ):
        location = create_location(
            structure=structure,
            location_type=StructureLocationType.CHAINAGE,
            chainage_km=Decimal("12.500"),
            actor=None,
        )
        structure.refresh_from_db()
        assert structure.chainage_km == Decimal(
            "12.500"
        )

        delete_location(location)

        structure.refresh_from_db()
        assert structure.chainage_km is None

    def test_deleting_the_smaller_of_two_falls_back_to_the_other(
        self, structure
    ):
        smaller = create_location(
            structure=structure,
            location_type=StructureLocationType.CHAINAGE,
            chainage_km=Decimal("8.000"),
            actor=None,
        )
        create_location(
            structure=structure,
            location_type=StructureLocationType.CHAINAGE,
            chainage_km=Decimal("12.500"),
            actor=None,
        )

        delete_location(smaller)

        structure.refresh_from_db()
        assert structure.chainage_km == Decimal(
            "12.500"
        )

    def test_a_manually_set_chainage_with_no_locations_is_untouched(
        self, site, minor_type
    ):
        structure = create_structure(
            site=site,
            structure_type=minor_type,
            name="Br. No. 501",
            chainage_km=Decimal("20.000"),
            config={},
            actor=None,
        )

        assert structure.chainage_km == Decimal(
            "20.000"
        )


class TestStructureLocationApi:
    @pytest.fixture
    def api_client(self):
        client = APIClient()
        client.force_authenticate(
            user=ProjectManagerUserFactory()
        )
        return client

    def test_create_and_list(
        self, api_client, site, minor_type
    ):
        structure = create_structure(
            site=site,
            structure_type=minor_type,
            name="Br. No. 502",
            chainage_km=None,
            config={},
            actor=None,
        )

        response = api_client.post(
            reverse(
                "project-monitor-api:structure-location-list",
                args=[structure.id],
            ),
            {
                "location_type": "RAMP",
                "name": "R2",
                "remarks": "Interchange ramp",
            },
            format="json",
        )

        assert (
            response.status_code
            == status.HTTP_200_OK
        )
        data = response.data["data"]
        assert data["location_type"] == "RAMP"
        assert data["name"] == "R2"
        assert (
            data["remarks"] == "Interchange ramp"
        )

        list_response = api_client.get(
            reverse(
                "project-monitor-api:structure-location-list",
                args=[structure.id],
            )
        )
        assert (
            list_response.status_code
            == status.HTTP_200_OK
        )
        assert len(list_response.data["data"]) == 1

    def test_delete(
        self, api_client, site, minor_type
    ):
        structure = create_structure(
            site=site,
            structure_type=minor_type,
            name="Br. No. 503",
            chainage_km=None,
            config={},
            actor=None,
        )
        create_response = api_client.post(
            reverse(
                "project-monitor-api:structure-location-list",
                args=[structure.id],
            ),
            {
                "location_type": "CHAINAGE",
                "chainage_km": "1.000",
            },
            format="json",
        )
        location_id = create_response.data["data"][
            "id"
        ]

        delete_response = api_client.delete(
            reverse(
                "project-monitor-api:structure-location-detail",
                args=[location_id],
            )
        )

        assert (
            delete_response.status_code
            == status.HTTP_200_OK
        )
        assert not StructureLocation.objects.filter(
            id=location_id
        ).exists()

    def test_the_structure_serializer_nests_locations(
        self, api_client, site, minor_type
    ):
        structure = create_structure(
            site=site,
            structure_type=minor_type,
            name="Br. No. 504",
            chainage_km=None,
            config={},
            actor=None,
        )
        api_client.post(
            reverse(
                "project-monitor-api:structure-location-list",
                args=[structure.id],
            ),
            {
                "location_type": "CHAINAGE",
                "name": "Up line",
                "chainage_km": "3.500",
            },
            format="json",
        )

        detail_response = api_client.get(
            reverse(
                "project-monitor-api:structure-detail",
                args=[structure.id],
            )
        )

        locations = detail_response.data["data"][
            "locations"
        ]
        assert len(locations) == 1
        assert locations[0]["name"] == "Up line"

    def test_a_bad_type_is_rejected(
        self, api_client, site, minor_type
    ):
        structure = create_structure(
            site=site,
            structure_type=minor_type,
            name="Br. No. 505",
            chainage_km=None,
            config={},
            actor=None,
        )

        response = api_client.post(
            reverse(
                "project-monitor-api:structure-location-list",
                args=[structure.id],
            ),
            {"location_type": "NOT-A-TYPE"},
            format="json",
        )

        assert (
            response.status_code
            == status.HTTP_400_BAD_REQUEST
        )
