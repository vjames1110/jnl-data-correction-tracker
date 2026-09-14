from decimal import Decimal

import pytest

from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    Activity,
    ActivityKind,
    ActivityStatus,
    Structure,
    StructureTypeDefinition,
)
from apps.project_monitor.services.structure_generator import (
    create_structure,
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


@pytest.fixture
def minor_type():
    return StructureTypeDefinition.objects.get(
        code="MINOR"
    )


@pytest.fixture
def major_type():
    return StructureTypeDefinition.objects.get(
        code="MAJOR"
    )


@pytest.fixture
def rub_type():
    return StructureTypeDefinition.objects.get(
        code="RUB"
    )


@pytest.fixture
def rob_type():
    return StructureTypeDefinition.objects.get(
        code="ROB"
    )


def _names(structure):
    return list(
        structure.activities.order_by(
            "group_order", "row_order"
        ).values_list("name", flat=True)
    )


def _row(structure, name):
    return structure.activities.get(name=name)


@pytest.mark.django_db
def test_minor_bridge_marks_unused_return_walls_and_apron_na(
    site, minor_type,
):
    structure = create_structure(
        site=site,
        structure_type=minor_type,
        name="Br. No. 214",
        chainage_km=Decimal("12.345"),
        config={
            "w": 3,
            "h": 3,
            "cells": 1,
            "barrel": 12,
            "returns": 2,
            "stairs": 1,
            "apron": False,
        },
        actor=None,
    )

    assert (
        _row(structure, "R/W 1").status
        == ActivityStatus.NOT_STARTED
    )
    assert (
        _row(structure, "R/W 2").status
        == ActivityStatus.NOT_STARTED
    )
    assert (
        _row(structure, "R/W 3").status
        == ActivityStatus.NOT_APPLICABLE
    )
    assert (
        _row(structure, "R/W 4").status
        == ActivityStatus.NOT_APPLICABLE
    )
    assert (
        _row(structure, "Staircase 1").status
        == ActivityStatus.NOT_STARTED
    )
    assert (
        _row(structure, "Staircase 2").status
        == ActivityStatus.NOT_APPLICABLE
    )
    assert (
        _row(structure, "Apron").status
        == ActivityStatus.NOT_APPLICABLE
    )
    # Docs (GAD/Structural drawing) always come first, group_order 0.
    assert _names(structure)[:2] == [
        "GAD approval",
        "Structural drawing approval",
    ]
    assert _row(structure, "GAD approval").is_doc
    assert (
        "1×3×3 m box"
        in structure.description
    )


@pytest.mark.django_db
def test_minor_bridge_keeps_apron_when_configured(
    site, minor_type,
):
    structure = create_structure(
        site=site,
        structure_type=minor_type,
        name="Br. No. 215",
        chainage_km=None,
        config={
            "w": 3,
            "h": 3,
            "cells": 1,
            "barrel": 12,
            "returns": 4,
            "stairs": 2,
            "apron": True,
        },
        actor=None,
    )

    assert (
        _row(structure, "Apron").status
        == ActivityStatus.NOT_STARTED
    )
    assert (
        _row(structure, "R/W 4").status
        == ActivityStatus.NOT_STARTED
    )
    assert (
        _row(structure, "Staircase 2").status
        == ActivityStatus.NOT_STARTED
    )


@pytest.mark.django_db
def test_rub_marks_nil_approach_quantities_na(site, rub_type):
    structure = create_structure(
        site=site,
        structure_type=rub_type,
        name="RUB 12",
        chainage_km=None,
        config={
            "w": 6,
            "h": 4.5,
            "cells": 1,
            "barrel": 14,
            "returns": 4,
            "raftLHS": 60,
            "raftRHS": 0,
            "wallLHS": 120,
            "wallRHS": 0,
            "sheeting": False,
        },
        actor=None,
    )

    raft_lhs = _row(
        structure, "Approach road raft – LHS"
    )
    assert raft_lhs.kind == ActivityKind.LENGTH
    assert raft_lhs.total_qty == Decimal("60")
    assert raft_lhs.status == ActivityStatus.NOT_STARTED

    raft_rhs = _row(
        structure, "Approach road raft – RHS"
    )
    assert (
        raft_rhs.status == ActivityStatus.NOT_APPLICABLE
    )

    assert (
        _row(
            structure, "Sheeting of approach road"
        ).status
        == ActivityStatus.NOT_APPLICABLE
    )


@pytest.mark.django_db
def test_major_bridge_generates_pile_rows_and_span_chain(
    site, major_type,
):
    structure = create_structure(
        site=site,
        structure_type=major_type,
        name="Br. 220",
        chainage_km=Decimal("20.000"),
        config={
            "spans": 2,
            "abuts": 2,
            "abutH": [6, 6],
            "abutPiles": [8, 8],
            "abutFound": "pile",
            "piers": 1,
            "pierH": [8],
            "pierPiles": [10],
            "pierFound": "pile",
            "girderScope": "jnl",
        },
        actor=None,
    )

    groups = list(
        structure.activities.filter(
            group_order__gt=0
        )
        .values_list("group_title", flat=True)
        .distinct()
    )
    assert "Abutment A1" in groups
    assert "Abutment A2" in groups
    assert "Pier P1" in groups
    assert "Superstructure (span-wise)" in groups

    pile_rows = structure.activities.filter(
        group_title="Abutment A1", name="Pile"
    )
    assert pile_rows.count() == 1
    assert pile_rows.first().kind == (
        ActivityKind.LENGTH
    )
    assert pile_rows.first().total_qty == Decimal(
        "8"
    )

    assert _row(
        structure, "S1 – Girder fabrication"
    )
    assert _row(structure, "S1 – Girder launching")
    assert _row(structure, "S2 – Bearings")


@pytest.mark.django_db
def test_major_bridge_railway_scope_combines_girder_row(
    site, major_type,
):
    structure = create_structure(
        site=site,
        structure_type=major_type,
        name="Br. 221",
        chainage_km=None,
        config={
            "spans": 1,
            "abuts": 2,
            "abutFound": "open",
            "piers": 0,
            "pierFound": "open",
            "girderScope": "rly",
        },
        actor=None,
    )

    combined = structure.activities.filter(
        name__icontains=(
            "Girder fabrication & launching"
        )
    )
    assert combined.count() == 1
    assert "Railway" in combined.first().name
    assert not structure.activities.filter(
        name="S1 – Girder fabrication"
    ).exists()


@pytest.mark.django_db
def test_rob_generates_substructures_and_girders_between(
    site, rob_type,
):
    structure = create_structure(
        site=site,
        structure_type=rob_type,
        name="ROB 5",
        chainage_km=None,
        config={
            "subs": 3,
            "found": "pile",
            "piles": [8, 10, 8],
            "girderScope": "jnl",
            "rwLHS": 0,
            "rwRHS": 100,
            "reLHS": 0,
            "reRHS": 0,
            "fillLHS": 0,
            "fillRHS": 5000,
            "cbLHS": 0,
            "cbRHS": 300,
            "roadLHS": 0,
            "roadRHS": 150,
        },
        actor=None,
    )

    groups = list(
        structure.activities.filter(
            group_order__gt=0
        )
        .values_list("group_title", flat=True)
        .distinct()
    )
    assert "Abutment A1" in groups
    assert "Pier P1" in groups
    assert "Abutment A2" in groups
    assert "Girder G1" in groups
    assert "Girder G2" in groups
    assert "Approach LHS" in groups
    assert "Approach RHS" in groups

    assert structure.activities.filter(
        group_title="Abutment A1", name="Pile"
    ).exists()

    # Two "Retaining wall" rows exist (LHS + RHS) - narrow by group.
    lhs_wall = structure.activities.get(
        group_title="Approach LHS",
        name="Retaining wall",
    )
    assert (
        lhs_wall.status == ActivityStatus.NOT_APPLICABLE
    )
    rhs_wall = structure.activities.get(
        group_title="Approach RHS",
        name="Retaining wall",
    )
    assert (
        rhs_wall.status == ActivityStatus.NOT_STARTED
    )
    assert rhs_wall.total_qty == Decimal("100")


@pytest.mark.django_db
def test_deleting_structure_cascades_its_activities(
    site, minor_type,
):
    structure = create_structure(
        site=site,
        structure_type=minor_type,
        name="Br. No. 300",
        chainage_km=None,
        config={
            "w": 3,
            "h": 3,
            "cells": 1,
            "barrel": 12,
            "returns": 4,
            "stairs": 2,
            "apron": True,
        },
        actor=None,
    )
    structure_id = structure.id
    assert Activity.objects.filter(
        object_id=structure_id
    ).exists()

    structure.delete()

    assert not Structure.objects.filter(
        id=structure_id
    ).exists()
    assert not Activity.objects.filter(
        object_id=structure_id
    ).exists()


@pytest.mark.django_db
def test_hostile_span_count_is_clamped(site, major_type):
    structure = create_structure(
        site=site,
        structure_type=major_type,
        name="Br. 999",
        chainage_km=None,
        config={
            "spans": 10_000,
            "abuts": 2,
            "abutFound": "open",
            "piers": 0,
            "pierFound": "open",
            "girderScope": "jnl",
        },
        actor=None,
    )

    assert structure.config["spans"] == 30
