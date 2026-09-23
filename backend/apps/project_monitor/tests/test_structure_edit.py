"""
Editing a structure's parametric config after the fact -
``structure_generator.update_structure``. Reconciliation rule under
test throughout: a row that is still generated keeps whatever real
progress/history it has; a row that stops being generated is marked
NOT_APPLICABLE rather than deleted; a row that newly starts being
generated is created fresh; the Approvals docs are never touched.
"""

from decimal import Decimal

import pytest

from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    ActivityComment,
    ActivityStatus,
    StructureTypeDefinition,
)
from apps.project_monitor.services.activity_engine import apply_update
from apps.project_monitor.services.structure_generator import (
    create_structure,
    update_structure,
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


def _row(structure, group_title, name):
    return structure.activities.get(
        group_title=group_title, name=name
    )


@pytest.mark.django_db
def test_editing_an_unrelated_field_leaves_logged_progress_alone(
    site, minor_type
):
    structure = create_structure(
        site=site,
        structure_type=minor_type,
        name="Br. 1",
        chainage_km=Decimal("1.000"),
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 12,
            "returns": 4, "stairs": 2, "apron": True,
        },
        actor=None,
    )
    raft = _row(structure, "Box structure", "Box raft")
    apply_update(
        raft,
        status=ActivityStatus.COMPLETE,
        comment="Poured",
        meeting_date="2026-01-05",
    )

    update_structure(
        structure=structure,
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 15,
            "returns": 4, "stairs": 2, "apron": True,
        },
        actor=None,
    )

    raft.refresh_from_db()
    assert raft.status == ActivityStatus.COMPLETE
    assert (
        ActivityComment.objects.filter(
            activity=raft
        ).count()
        == 1
    )
    structure.refresh_from_db()
    assert structure.config["barrel"] == 15.0
    assert "15" in structure.description


@pytest.mark.django_db
def test_shrinking_a_count_marks_the_excess_rows_na_not_deleted(
    site, minor_type
):
    structure = create_structure(
        site=site,
        structure_type=minor_type,
        name="Br. 2",
        chainage_km=None,
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 12,
            "returns": 4, "stairs": 2, "apron": True,
        },
        actor=None,
    )
    assert (
        _row(structure, "Box structure", "R/W 3").status
        == ActivityStatus.NOT_STARTED
    )

    update_structure(
        structure=structure,
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 12,
            "returns": 2, "stairs": 2, "apron": True,
        },
        actor=None,
    )

    assert (
        _row(structure, "Box structure", "R/W 3").status
        == ActivityStatus.NOT_APPLICABLE
    )
    assert (
        _row(structure, "Box structure", "R/W 4").status
        == ActivityStatus.NOT_APPLICABLE
    )
    # Not deleted - still the same 18-row group.
    assert (
        structure.activities.filter(
            group_title="Box structure"
        ).count()
        == 18
    )


@pytest.mark.django_db
def test_growing_a_count_reactivates_a_previously_na_row(
    site, minor_type
):
    structure = create_structure(
        site=site,
        structure_type=minor_type,
        name="Br. 3",
        chainage_km=None,
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 12,
            "returns": 2, "stairs": 2, "apron": True,
        },
        actor=None,
    )
    assert (
        _row(structure, "Box structure", "R/W 4").status
        == ActivityStatus.NOT_APPLICABLE
    )

    update_structure(
        structure=structure,
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 12,
            "returns": 4, "stairs": 2, "apron": True,
        },
        actor=None,
    )

    assert (
        _row(structure, "Box structure", "R/W 4").status
        == ActivityStatus.NOT_STARTED
    )


@pytest.mark.django_db
def test_a_completed_row_that_becomes_na_keeps_its_history(
    site, minor_type
):
    structure = create_structure(
        site=site,
        structure_type=minor_type,
        name="Br. 4",
        chainage_km=None,
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 12,
            "returns": 4, "stairs": 2, "apron": True,
        },
        actor=None,
    )
    apron = _row(structure, "Box structure", "Apron")
    apply_update(
        apron,
        status=ActivityStatus.COMPLETE,
        comment="Cast and cured",
        meeting_date="2026-01-05",
    )

    update_structure(
        structure=structure,
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 12,
            "returns": 4, "stairs": 2, "apron": False,
        },
        actor=None,
    )

    apron.refresh_from_db()
    assert apron.status == ActivityStatus.NOT_APPLICABLE
    assert (
        ActivityComment.objects.filter(
            activity=apron
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_a_bigger_abutment_count_creates_a_fresh_group(
    site, major_type
):
    structure = create_structure(
        site=site,
        structure_type=major_type,
        name="Br. 220",
        chainage_km=Decimal("20.000"),
        config={
            "spans": 1,
            "abuts": 2,
            "abutH": [6, 6],
            "abutPiles": [8, 8],
            "abutFound": "pile",
            "piers": 0,
            "pierFound": "open",
            "girderScope": "jnl",
        },
        actor=None,
    )
    assert not structure.activities.filter(
        group_title="Abutment A3"
    ).exists()

    update_structure(
        structure=structure,
        config={
            "spans": 1,
            "abuts": 3,
            "abutH": [6, 6, 7],
            "abutPiles": [8, 8, 9],
            "abutFound": "pile",
            "piers": 0,
            "pierFound": "open",
            "girderScope": "jnl",
        },
        actor=None,
    )

    new_pile = _row(
        structure, "Abutment A3", "Pile"
    )
    assert new_pile.status == ActivityStatus.NOT_STARTED
    assert new_pile.total_qty == Decimal("9")


@pytest.mark.django_db
def test_a_smaller_abutment_count_marks_the_dropped_group_na(
    site, major_type
):
    structure = create_structure(
        site=site,
        structure_type=major_type,
        name="Br. 221",
        chainage_km=None,
        config={
            "spans": 1,
            "abuts": 2,
            "abutH": [6, 6],
            "abutPiles": [8, 8],
            "abutFound": "pile",
            "piers": 0,
            "pierFound": "open",
            "girderScope": "jnl",
        },
        actor=None,
    )
    abutment_2_pile = _row(
        structure, "Abutment A2", "Pile"
    )
    apply_update(
        abutment_2_pile,
        done_qty=Decimal("8"),
        comment="Piling done",
        meeting_date="2026-01-05",
    )

    update_structure(
        structure=structure,
        config={
            "spans": 1,
            "abuts": 1,
            "abutH": [6],
            "abutPiles": [8],
            "abutFound": "pile",
            "piers": 0,
            "pierFound": "open",
            "girderScope": "jnl",
        },
        actor=None,
    )

    abutment_2_pile.refresh_from_db()
    assert (
        abutment_2_pile.status
        == ActivityStatus.NOT_APPLICABLE
    )
    # Its logged quantity is not wiped.
    assert abutment_2_pile.done_qty == Decimal("8")
    assert (
        ActivityComment.objects.filter(
            activity=abutment_2_pile
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_the_approvals_docs_are_never_touched_by_a_config_edit(
    site, minor_type
):
    structure = create_structure(
        site=site,
        structure_type=minor_type,
        name="Br. 5",
        chainage_km=None,
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 12,
            "returns": 4, "stairs": 2, "apron": True,
        },
        actor=None,
    )
    gad = structure.activities.get(
        group_title="Approvals", name="GAD approval"
    )
    apply_update(
        gad,
        status=ActivityStatus.COMPLETE,
        comment="Approved",
        meeting_date="2026-01-05",
    )
    gad_id = gad.id

    update_structure(
        structure=structure,
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 12,
            "returns": 2, "stairs": 0, "apron": False,
        },
        actor=None,
    )

    gad.refresh_from_db()
    assert gad.id == gad_id
    assert gad.status == ActivityStatus.COMPLETE
    assert gad.group_order == 0


@pytest.mark.django_db
def test_name_and_chainage_still_update_together_with_config(
    site, minor_type
):
    structure = create_structure(
        site=site,
        structure_type=minor_type,
        name="Br. 6",
        chainage_km=Decimal("6.000"),
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 12,
            "returns": 4, "stairs": 2, "apron": True,
        },
        actor=None,
    )

    updated = update_structure(
        structure=structure,
        name="Br. 6-A",
        chainage_km=Decimal("6.500"),
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 12,
            "returns": 4, "stairs": 2, "apron": True,
        },
        actor=None,
    )

    assert updated.name == "Br. 6-A"
    assert updated.chainage_km == Decimal("6.500")


@pytest.mark.django_db
def test_leaving_out_name_and_chainage_keeps_them_as_they_were(
    site, minor_type
):
    structure = create_structure(
        site=site,
        structure_type=minor_type,
        name="Br. 7",
        chainage_km=Decimal("7.000"),
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 12,
            "returns": 4, "stairs": 2, "apron": True,
        },
        actor=None,
    )

    updated = update_structure(
        structure=structure,
        config={
            "w": 3, "h": 3, "cells": 1, "barrel": 20,
            "returns": 4, "stairs": 2, "apron": True,
        },
        actor=None,
    )

    assert updated.name == "Br. 7"
    assert updated.chainage_km == Decimal("7.000")
