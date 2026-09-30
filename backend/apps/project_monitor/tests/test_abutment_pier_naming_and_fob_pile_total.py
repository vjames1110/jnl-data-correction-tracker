"""
End-to-end verification of migration 0027 against the real seeded
StructureTypeDefinition rows: Major Bridge's and ROB's Abutment/Pier
groups gain a free-typed name per index, and FOB's description now
totals pile count across every platform.
"""

from decimal import Decimal

import pytest

from apps.organization.models import Company, Site
from apps.project_monitor.models import StructureTypeDefinition
from apps.project_monitor.services.structure_generator import (
    create_structure,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL", company_name="Jhajharia Nirman Limited"
    )
    return Site.objects.create(
        company=company,
        site_code="NAM1",
        site_name="Naming Test Site",
    )


@pytest.fixture
def major_type():
    return StructureTypeDefinition.objects.get(code="MAJOR")


@pytest.fixture
def rob_type():
    return StructureTypeDefinition.objects.get(code="ROB")


@pytest.fixture
def fob_type():
    return StructureTypeDefinition.objects.get(code="FOB")


def group_subtitle(structure, group_title):
    activity = (
        structure.activities.filter(group_title=group_title)
        .order_by("row_order")
        .first()
    )
    return activity.group_subtitle if activity else None


class TestMajorBridgeAbutmentPierNaming:
    def test_seeded_schema_has_a_text_name_item_field(
        self, major_type
    ):
        by_count_field = {
            group["count_field"]: group
            for group in major_type.group_templates
            if group.get("count_field") in ("abuts", "piers")
        }
        abut_names = {
            field["key"]: field
            for field in by_count_field["abuts"]["item_fields"]
        }
        pier_names = {
            field["key"]: field
            for field in by_count_field["piers"]["item_fields"]
        }
        assert abut_names["abutName"]["type"] == "text"
        assert pier_names["pierName"]["type"] == "text"

    def test_named_abutments_show_the_name_in_the_subtitle(
        self, site, major_type
    ):
        structure = create_structure(
            site=site,
            structure_type=major_type,
            name="Br. No. 900",
            chainage_km=Decimal("5.000"),
            config={
                "abuts": 2,
                "abutName": [
                    "North abutment",
                    "South abutment",
                ],
                "abutH": [6, 6],
            },
            actor=None,
        )

        assert (
            "North abutment"
            in group_subtitle(structure, "Abutment A1")
        )
        assert (
            "South abutment"
            in group_subtitle(structure, "Abutment A2")
        )

    def test_an_unnamed_abutment_still_generates_correctly(
        self, site, major_type
    ):
        """No name given must not break generation - the group still
        renders, just without a name in the subtitle."""
        structure = create_structure(
            site=site,
            structure_type=major_type,
            name="Br. No. 901",
            chainage_km=Decimal("6.000"),
            config={"abuts": 1},
            actor=None,
        )

        assert structure.activities.filter(
            group_title="Abutment A1"
        ).exists()


class TestRobAbutmentPierNaming:
    def test_seeded_schema_has_a_text_name_item_field(
        self, rob_type
    ):
        group = next(
            group
            for group in rob_type.group_templates
            if group.get("count_field") == "subs"
            and group.get("kind") == "repeat"
        )
        by_key = {
            field["key"]: field
            for field in group["item_fields"]
        }
        assert by_key["subName"]["type"] == "text"

    def test_named_substructures_show_in_the_subtitle(
        self, site, rob_type
    ):
        structure = create_structure(
            site=site,
            structure_type=rob_type,
            name="ROB-1",
            chainage_km=Decimal("7.000"),
            config={
                "subs": 2,
                "subName": ["Abutment near gate", "Far pier"],
            },
            actor=None,
        )

        assert (
            "Abutment near gate"
            in group_subtitle(structure, "Abutment A1")
        )
        assert "Far pier" in group_subtitle(
            structure, "Abutment A2"
        )


class TestFobPileTotalInDescription:
    def test_description_includes_the_total_pile_count(
        self, site, fob_type
    ):
        structure = create_structure(
            site=site,
            structure_type=fob_type,
            name="FOB-Pile-1",
            chainage_km=Decimal("8.000"),
            config={
                "stationName": "Chunar",
                "spans": 2,
                "girderScope": "jnl",
                "platforms": [
                    {"name": "Platform 1", "noOfPile": 6},
                    {"name": "Platform 2", "noOfPile": 4},
                ],
            },
            actor=None,
        )

        assert "10 piles" in structure.description

    def test_description_shows_zero_piles_with_no_platforms(
        self, site, fob_type
    ):
        structure = create_structure(
            site=site,
            structure_type=fob_type,
            name="FOB-Pile-2",
            chainage_km=Decimal("9.000"),
            config={"stationName": "Chunar", "spans": 1},
            actor=None,
        )

        assert "0 piles" in structure.description
