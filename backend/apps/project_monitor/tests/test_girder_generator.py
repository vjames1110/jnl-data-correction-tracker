import pytest

from apps.authentication.tests.factories import (
    ProjectManagerUserFactory,
)
from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    ActivityStatus,
    GirderScope,
    GirderStructureKind,
)
from apps.project_monitor.services.girder_generator import (
    B_CHAIN,
    G_CHAIN,
    RAILWAY_ACTIVE_STEPS,
    create_girder_job,
)


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    return Site.objects.create(
        company=company,
        site_code="CHK",
        site_name="Chunar-Khairahi Doubling Pkg-I",
    )


@pytest.fixture
def actor():
    return ProjectManagerUserFactory()


def _span_config(label="S1", **overrides):
    config = {
        "label": label,
        "is_standard": True,
        "drawing_no": "RDSO/B-1234",
        "span_length_m": "24.40",
        "girder_type": "Welded plate girder",
        "qty_mt": "45.500",
        "vendor": "",
        "po_number": "",
        "bearings_count": 4,
        "expansion_joints_count": 2,
    }
    config.update(overrides)
    return config


@pytest.mark.django_db
def test_jnl_scope_generates_full_girder_and_be_chains(
    site, actor
):
    job = create_girder_job(
        site=site,
        structure_kind=GirderStructureKind.MAJOR,
        bridge_name="Br. No. 310",
        chainage_km="15.500",
        girder_scope=GirderScope.JNL,
        spans=[_span_config()],
        actor=actor,
    )

    gad_rows = list(job.activities.all())
    assert len(gad_rows) == 1
    assert gad_rows[0].name == "GAD approval"
    assert gad_rows[0].is_doc is True
    assert (
        gad_rows[0].status
        == ActivityStatus.NOT_STARTED
    )

    span = job.spans.get()
    girder_rows = span.activities.filter(
        group_title="Girder fabrication"
    ).order_by("row_order")
    assert [
        r.name for r in girder_rows
    ] == G_CHAIN
    assert all(
        r.status == ActivityStatus.NOT_STARTED
        for r in girder_rows
    )

    bearings_rows = span.activities.filter(
        group_title="Bearings"
    ).order_by("row_order")
    assert [
        r.name for r in bearings_rows
    ] == B_CHAIN

    ej_rows = span.activities.filter(
        group_title="Expansion Joints"
    ).order_by("row_order")
    assert [r.name for r in ej_rows] == B_CHAIN


@pytest.mark.django_db
def test_railway_scope_marks_all_but_four_steps_na(
    site, actor
):
    job = create_girder_job(
        site=site,
        structure_kind=GirderStructureKind.ROB,
        bridge_name="Br. No. 55",
        chainage_km=None,
        girder_scope=GirderScope.RAILWAY,
        spans=[_span_config()],
        actor=actor,
    )

    span = job.spans.get()
    girder_rows = {
        r.name: r.status
        for r in span.activities.filter(
            group_title="Girder fabrication"
        )
    }

    for name in G_CHAIN:
        if name in RAILWAY_ACTIVE_STEPS:
            assert (
                girder_rows[name]
                == ActivityStatus.NOT_STARTED
            ), name
        else:
            assert (
                girder_rows[name]
                == ActivityStatus.NOT_APPLICABLE
            ), name

    assert RAILWAY_ACTIVE_STEPS == {
        "Final inspection",
        "Dispatch",
        "Received at site",
        "Launching status",
    }


@pytest.mark.django_db
def test_fob_carries_girders_only(site, actor):
    job = create_girder_job(
        site=site,
        structure_kind=GirderStructureKind.FOB,
        bridge_name="FOB 1",
        chainage_km=None,
        girder_scope=GirderScope.JNL,
        spans=[_span_config()],
        actor=actor,
    )

    span = job.spans.get()
    assert (
        span.activities.filter(
            group_title="Girder fabrication"
        ).count()
        == len(G_CHAIN)
    )
    assert (
        span.activities.filter(
            group_title="Bearings"
        ).count()
        == 0
    )
    assert (
        span.activities.filter(
            group_title="Expansion Joints"
        ).count()
        == 0
    )


@pytest.mark.django_db
def test_multiple_spans_each_get_their_own_chains(
    site, actor
):
    job = create_girder_job(
        site=site,
        structure_kind=GirderStructureKind.MAJOR,
        bridge_name="Br. No. 400",
        chainage_km="20.000",
        girder_scope=GirderScope.JNL,
        spans=[
            _span_config("S1"),
            _span_config("S2"),
        ],
        actor=actor,
    )

    assert job.spans.count() == 2
    for span in job.spans.all():
        assert (
            span.activities.count()
            == len(G_CHAIN)
            + len(B_CHAIN)
            + len(B_CHAIN)
        )
