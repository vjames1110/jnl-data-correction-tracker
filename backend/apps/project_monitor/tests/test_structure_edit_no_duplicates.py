"""
Editing a structure's inputs must not duplicate its rows. Reported
from the field: changing the number of spans, or switching a
foundation to piles, added the new rows but left the old ones behind,
so piers and superstructure rows appeared twice. Cause: the match key
used to reconcile existing rows included the group subtitle, and
subtitles are built from those very inputs ("Open foundation" vs
"8 piles", "3 span(s)"), so an edited structure never matched its own
rows.
"""

from decimal import Decimal

import pytest

from apps.organization.models import Company, Site
from apps.project_monitor.models import StructureTypeDefinition
from apps.project_monitor.services.structure_generator import (
    create_structure,
    update_structure,
)

BASE_CONFIG = {
    "spans": 3,
    "abuts": 2,
    "abutH": [6, 6],
    "abutPiles": [8, 8],
    "abutFound": "open",
    "piers": 2,
    "pierH": [8, 8],
    "pierPiles": [8, 8],
    "pierFound": "open",
    "girderScope": "jnl",
}


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL", company_name="Jhajharia Nirman Limited"
    )
    return Site.objects.create(
        company=company, site_code="DUP", site_name="Duplicate Test"
    )


@pytest.fixture
def major_type():
    return StructureTypeDefinition.objects.get(code="MAJOR")


def _visible_titles(structure):
    return [
        activity.group_title
        for activity in structure.activities.filter(is_hidden=False)
        .order_by("group_order", "row_order")
        .distinct("group_title")
    ]


def _visible_rows(structure, group_title_prefix):
    return list(
        structure.activities.filter(
            is_hidden=False,
            group_title__startswith=group_title_prefix,
            status__in=["NOT_STARTED", "IN_PROGRESS", "COMPLETE", "HOLD"],
        ).values_list("group_title", "name")
    )


@pytest.mark.django_db
def test_switching_pier_foundation_to_piles_does_not_duplicate_piers(
    site, major_type
):
    structure = create_structure(
        site=site,
        structure_type=major_type,
        name="Br. 300",
        chainage_km=Decimal("30.000"),
        config=BASE_CONFIG,
        actor=None,
    )
    before = sorted(_visible_rows(structure, "Pier P"))

    update_structure(
        structure=structure,
        config={**BASE_CONFIG, "pierFound": "pile"},
        actor=None,
    )

    after = sorted(_visible_rows(structure, "Pier P"))
    # The foundation change adds a Pile row to each pier; it must not
    # leave a second copy of every pier behind.
    assert len(after) == len(set(after)), "duplicate pier rows"
    assert {title for title, _ in after} == {"Pier P1", "Pier P2"}
    assert len(after) == len(before) + 2


@pytest.mark.django_db
def test_changing_span_count_does_not_duplicate_superstructure_rows(
    site, major_type
):
    structure = create_structure(
        site=site,
        structure_type=major_type,
        name="Br. 301",
        chainage_km=Decimal("31.000"),
        config=BASE_CONFIG,
        actor=None,
    )

    update_structure(
        structure=structure,
        config={**BASE_CONFIG, "spans": 4},
        actor=None,
    )

    visible = list(
        structure.activities.filter(is_hidden=False).values_list(
            "group_title", "name"
        )
    )
    assert len(visible) == len(set(visible)), "duplicate visible rows"
