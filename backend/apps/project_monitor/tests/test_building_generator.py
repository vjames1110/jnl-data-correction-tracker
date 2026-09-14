from decimal import Decimal

import pytest

from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    Activity,
    ActivityKind,
    ActivityStatus,
    Building,
)
from apps.project_monitor.services.building_generator import (
    create_building,
)


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    return Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )


def _row(building, group_title, name):
    return building.activities.get(
        group_title=group_title, name=name
    )


@pytest.mark.django_db
def test_pile_foundation_adds_pile_row(site):
    building = create_building(
        site=site,
        name="Station building",
        station_label="Chunar station",
        chainage_km=None,
        config={
            "gf": 500,
            "up": 1,
            "uf": 500,
            "found": "pile",
            "piles": 40,
            "lift": False,
            "fire": False,
            "ext": True,
        },
        actor=None,
    )

    pile = _row(
        building, "Foundation & plinth", "Pile"
    )
    assert pile.kind == ActivityKind.LENGTH
    assert pile.total_qty == Decimal("40")
    assert not building.activities.filter(
        group_title="Foundation & plinth",
        name="Raft",
    ).exists()
    assert building.activities.filter(
        group_title="Foundation & plinth",
        name="Footing / foundation",
    ).exists()


@pytest.mark.django_db
def test_raft_foundation_swaps_footing_row(
    site,
):
    building = create_building(
        site=site,
        name="Crew lobby",
        station_label="Chunar station",
        chainage_km=None,
        config={
            "gf": 300,
            "up": 0,
            "uf": 0,
            "found": "raft",
            "lift": False,
            "fire": False,
            "ext": False,
        },
        actor=None,
    )

    assert building.activities.filter(
        group_title="Foundation & plinth",
        name="Raft",
    ).exists()
    assert not building.activities.filter(
        group_title="Foundation & plinth",
        name="Footing / foundation",
    ).exists()
    assert not building.activities.filter(
        group_title="Foundation & plinth",
        name="Pile",
    ).exists()


@pytest.mark.django_db
def test_floor_groups_are_named_ground_then_ordinal(
    site,
):
    building = create_building(
        site=site,
        name="Type-II quarters",
        station_label="Chunar station",
        chainage_km=None,
        config={
            "gf": 200,
            "up": 3,
            "uf": 200,
            "found": "open",
        },
        actor=None,
    )

    ordered_titles = (
        building.activities.filter(
            group_order__gt=0,
        )
        .exclude(
            group_title__in=[
                "Foundation & plinth",
                "Finishing & services",
            ],
        )
        .order_by(
            "group_order", "row_order"
        )
        .values_list(
            "group_title", flat=True
        )
    )
    floor_titles = list(
        dict.fromkeys(ordered_titles)
    )
    assert floor_titles == [
        "Ground Floor",
        "1st Floor",
        "2nd Floor",
        "3rd Floor",
    ]


@pytest.mark.django_db
def test_mep_rows_are_material_tracked(site):
    building = create_building(
        site=site,
        name="Station building",
        station_label="Chunar station",
        chainage_km=None,
        config={"gf": 500, "up": 0, "uf": 0},
        actor=None,
    )

    flooring = _row(
        building, "Ground Floor", "Flooring"
    )
    assert flooring.material_tracked
    assert (
        flooring.material_status == "NOT_ORDERED"
    )

    columns = _row(
        building, "Ground Floor", "Columns"
    )
    assert not columns.material_tracked
    assert columns.material_status is None


@pytest.mark.django_db
def test_lift_fire_and_compound_wall_na_when_off(
    site,
):
    building = create_building(
        site=site,
        name="Station building",
        station_label="Chunar station",
        chainage_km=None,
        config={
            "gf": 500,
            "up": 0,
            "uf": 0,
            "lift": False,
            "fire": False,
            "ext": False,
        },
        actor=None,
    )

    for name in (
        "Lift",
        "Fire fighting",
        "Compound wall & external development",
    ):
        row = _row(
            building, "Finishing & services", name
        )
        assert (
            row.status
            == ActivityStatus.NOT_APPLICABLE
        )


@pytest.mark.django_db
def test_lift_and_fire_included_when_on(site):
    building = create_building(
        site=site,
        name="Station building",
        station_label="Chunar station",
        chainage_km=None,
        config={
            "gf": 500,
            "up": 0,
            "uf": 0,
            "lift": True,
            "fire": True,
            "ext": True,
        },
        actor=None,
    )

    for name in (
        "Lift",
        "Fire fighting",
        "Compound wall & external development",
    ):
        row = _row(
            building, "Finishing & services", name
        )
        assert (
            row.status
            == ActivityStatus.NOT_STARTED
        )


@pytest.mark.django_db
def test_built_up_area_is_computed(site):
    building = create_building(
        site=site,
        name="Station building",
        station_label="Chunar station",
        chainage_km=None,
        config={"gf": 500, "up": 2, "uf": 300},
        actor=None,
    )

    assert building.config[
        "totalBuiltUpArea"
    ] == 1100


@pytest.mark.django_db
def test_deleting_building_cascades_activities(
    site,
):
    building = create_building(
        site=site,
        name="Station building",
        station_label="Chunar station",
        chainage_km=None,
        config={"gf": 500, "up": 0, "uf": 0},
        actor=None,
    )
    building_id = building.id
    assert Activity.objects.filter(
        object_id=building_id
    ).exists()

    building.delete()

    assert not Building.objects.filter(
        id=building_id
    ).exists()
    assert not Activity.objects.filter(
        object_id=building_id
    ).exists()


@pytest.mark.django_db
def test_hostile_upper_floor_count_is_clamped(
    site,
):
    building = create_building(
        site=site,
        name="Station building",
        station_label="Chunar station",
        chainage_km=None,
        config={"gf": 500, "up": 10_000, "uf": 500},
        actor=None,
    )

    assert building.config["floorsCount"] <= 30
