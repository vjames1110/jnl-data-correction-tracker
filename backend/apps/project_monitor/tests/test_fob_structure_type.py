"""
The seeded FOB (Foot Over Bridge) structure type - Station Name /
Chainage-Ramp as text, a repeatable "Platforms" group_list, and the
fixed monitoring activities confirmed by the director. Platforms are
pure data capture: the activity list is identical whether zero, one
or several platforms are added.
"""

from decimal import Decimal

import pytest

from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    Activity,
    Structure,
    StructureTypeDefinition,
)
from apps.project_monitor.services.structure_generator import (
    create_structure,
)


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL", company_name="Jhajharia Nirman Limited"
    )
    return Site.objects.create(
        company=company, site_code="FOB1", site_name="FOB Test Site"
    )


@pytest.fixture
def fob_type():
    return StructureTypeDefinition.objects.get(code="FOB")


def group_titles(structure):
    seen = []
    titles = structure.activities.order_by(
        "group_order", "row_order"
    ).values_list("group_title", flat=True)
    for title in titles:
        if title not in seen:
            seen.append(title)
    return seen


def rows_of(structure, group_title):
    return list(
        structure.activities.filter(
            group_title=group_title
        )
        .order_by("row_order")
        .values_list("name", flat=True)
    )


@pytest.mark.django_db
class TestFobSeedData:
    def test_the_fob_type_is_seeded(self, fob_type):
        assert fob_type.name == "FOB (Foot Over Bridge)"
        assert fob_type.include_approval_docs is True

    def test_station_name_and_chainage_ramp_are_text_fields(
        self, fob_type
    ):
        by_key = {
            field["key"]: field
            for field in fob_type.config_schema
        }
        assert by_key["stationName"]["type"] == "text"
        assert by_key["chainageRamp"]["type"] == "text"

    def test_platforms_is_a_group_list_with_the_right_sub_fields(
        self, fob_type
    ):
        by_key = {
            field["key"]: field
            for field in fob_type.config_schema
        }
        platforms = by_key["platforms"]
        assert platforms["type"] == "group_list"
        sub_keys = {f["key"] for f in platforms["fields"]}
        assert sub_keys == {
            "name",
            "colHeight",
            "hasLift",
            "hasStaircase",
            "hasRamp",
            "foundation",
            "noOfPile",
        }


@pytest.mark.django_db
class TestFobActivityGeneration:
    def test_generates_approvals_and_every_fixed_group(
        self, site, fob_type
    ):
        structure = create_structure(
            site=site,
            structure_type=fob_type,
            name="FOB-1",
            chainage_km=Decimal("12.000"),
            config={"stationName": "Chunar", "spans": 3},
            actor=None,
        )

        assert group_titles(structure) == [
            "Approvals",
            "Footing",
            "Civil",
            "Girder",
            "Deck",
            "Staircase",
            "Lift",
            "ACP",
            "Flooring",
        ]
        assert rows_of(structure, "Approvals") == [
            "GAD approval",
            "Structural drawing approval",
        ]
        assert rows_of(structure, "Footing") == [
            "Main Footing",
            "Stair Footing",
            "Lift Pit",
            "Escalator Column",
            "Escalator Pit",
        ]
        assert rows_of(structure, "Civil") == [
            "Stair Concrete",
            "Name of Civil team",
            "Main column launching",
        ]
        assert rows_of(structure, "Girder") == [
            "Girder Fabrication",
            "Fabrication Team",
        ]
        assert rows_of(structure, "Deck") == [
            "Deck sheet",
            "Deck Slab",
        ]
        assert rows_of(structure, "Staircase") == [
            "Staircase fabrication and erection",
        ]
        assert rows_of(structure, "Lift") == [
            "Lift Framework",
            "Escalator Frame erection",
            "Gangway materials",
            "Gangway roof",
            "Stairway & Esc roof",
            "Fabrication team",
        ]
        assert rows_of(structure, "ACP") == [
            "ACP for lift",
            "Fixing team",
        ]
        assert rows_of(structure, "Flooring") == [
            "Flooring granite",
            "Laying team",
        ]

    def test_stores_platforms_and_text_fields_on_the_config(
        self, site, fob_type
    ):
        structure = create_structure(
            site=site,
            structure_type=fob_type,
            name="FOB-2",
            chainage_km=Decimal("15.500"),
            config={
                "stationName": "Chunar",
                "chainageRamp": "15.5 km - Ramp A & B",
                "spans": 2,
                "girderScope": "jnl",
                "platforms": [
                    {
                        "name": "Platform 1",
                        "colHeight": "6.5",
                        "hasLift": True,
                        "hasStaircase": True,
                        "hasRamp": False,
                        "foundation": "pile",
                        "noOfPile": "6",
                    },
                    {
                        "name": "Platform 2",
                        "colHeight": "6",
                        "foundation": "open",
                    },
                ],
            },
            actor=None,
        )

        assert structure.config["stationName"] == "Chunar"
        assert (
            structure.config["chainageRamp"]
            == "15.5 km - Ramp A & B"
        )
        platforms = structure.config["platforms"]
        assert len(platforms) == 2
        assert platforms[0] == {
            "name": "Platform 1",
            "colHeight": 6.5,
            "hasLift": True,
            "hasStaircase": True,
            "hasRamp": False,
            "foundation": "pile",
            "noOfPile": 6.0,
        }
        assert platforms[1]["name"] == "Platform 2"
        assert platforms[1]["hasLift"] is False

    def test_the_activity_list_is_unchanged_regardless_of_platform_count(
        self, site, fob_type
    ):
        no_platforms = create_structure(
            site=site,
            structure_type=fob_type,
            name="FOB-3",
            chainage_km=Decimal("1.000"),
            config={"platforms": []},
            actor=None,
        )
        many_platforms = create_structure(
            site=site,
            structure_type=fob_type,
            name="FOB-4",
            chainage_km=Decimal("2.000"),
            config={
                "platforms": [
                    {"name": f"Platform {i}"} for i in range(5)
                ]
            },
            actor=None,
        )

        assert group_titles(no_platforms) == group_titles(
            many_platforms
        )
        assert rows_of(no_platforms, "Footing") == rows_of(
            many_platforms, "Footing"
        )

    def test_the_description_uses_the_text_and_choice_fields(
        self, site, fob_type
    ):
        structure = create_structure(
            site=site,
            structure_type=fob_type,
            name="FOB-5",
            chainage_km=Decimal("3.000"),
            config={
                "stationName": "Chunar",
                "spans": 4,
                "girderScope": "rly",
            },
            actor=None,
        )

        assert structure.description == (
            "Chunar · 4 spans · girders: Railway scope"
        )

    def test_activities_really_are_persisted_rows(self, site, fob_type):
        structure = create_structure(
            site=site,
            structure_type=fob_type,
            name="FOB-6",
            chainage_km=Decimal("4.000"),
            config={},
            actor=None,
        )

        count = Activity.objects.filter(
            object_id=structure.id
        ).count()
        # 2 approvals + 5 + 3 + 2 + 2 + 1 + 6 + 2 + 2 = 25.
        assert count == 25
        assert Structure.objects.get(pk=structure.pk).config == (
            structure.config
        )
