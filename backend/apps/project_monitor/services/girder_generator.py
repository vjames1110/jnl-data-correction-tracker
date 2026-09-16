"""
Direct port of the prototype's girder/bearings/expansion-joints
chains (``G_CHAIN``/``B_CHAIN`` in the original single-file HTML) -
flat, fixed step lists, not schema-driven like Structures/Buildings'
``template_engine``, since there's no per-type configuration here:
every bridge gets the same chains, just repeated once per span (and
skipped for Bearings/Expansion Joints on a FOB).

Bearings and Expansion Joints deliberately use the exact same
``B_CHAIN`` step names in the prototype (confirmed against its
``migrateGirders()`` back-fill logic, which keys both off the same
array) - this is not a bug to "fix", it's how the source material
actually works, so this port keeps them identical too.
"""

from decimal import Decimal

from django.contrib.contenttypes.models import ContentType

from apps.project_monitor.models import (
    Activity,
    ActivityKind,
    ActivityStatus,
    GirderJob,
    GirderScope,
    GirderSpan,
    GirderStructureKind,
)

G_CHAIN = [
    "Structural drawing approval",
    "Vendor selection",
    "PO issued",
    "QAP submitted",
    "QAP approved",
    "Raw material procurement",
    "Fabrication",
    "Trial assembly",
    "Bolt procurement",
    "Painting",
    "Metallising",
    "Final inspection",
    "Dispatch",
    "Received at site",
    "Launching status",
]

B_CHAIN = [
    "Drawing approval",
    "Vendor selection",
    "PO issued",
    "QAP approved",
    "Manufacturing",
    "Final inspection",
    "Dispatch",
    "Received at site",
    "Launching status",
]

# When a bridge's girders are Railway-supplied, JNL only follows up
# from these steps onward - every other G_CHAIN row is generated
# already marked N/A, exactly as the prototype does immediately on
# creation (not left for a user to mark by hand).
RAILWAY_ACTIVE_STEPS = frozenset(
    {
        "Final inspection",
        "Dispatch",
        "Received at site",
        "Launching status",
    }
)


def _row(
    content_type,
    object_id,
    *,
    name,
    group_title,
    group_order,
    row_order,
    status=ActivityStatus.NOT_STARTED,
    is_doc=False,
    actor,
):
    return Activity(
        content_type=content_type,
        object_id=object_id,
        name=name,
        group_title=group_title,
        group_order=group_order,
        row_order=row_order,
        kind=ActivityKind.TASK,
        unit="",
        total_qty=Decimal("0"),
        status=status,
        is_doc=is_doc,
        created_by=actor,
        updated_by=actor,
    )


def create_girder_job(
    *,
    site,
    structure=None,
    structure_kind,
    bridge_name,
    chainage_km,
    girder_scope,
    spans,
    actor,
):
    """
    ``spans`` is a list of dicts, each with: ``label``,
    ``is_standard``, ``drawing_no``, ``span_length_m``,
    ``girder_type``, ``qty_mt``, ``vendor``, ``po_number``,
    ``bearings_count``, ``expansion_joints_count``.
    """

    job = GirderJob.objects.create(
        site=site,
        structure=structure,
        structure_kind=structure_kind,
        bridge_name=bridge_name,
        chainage_km=chainage_km,
        girder_scope=girder_scope,
        created_by=actor,
        updated_by=actor,
    )

    job_content_type = (
        ContentType.objects.get_for_model(
            GirderJob
        )
    )
    Activity.objects.bulk_create(
        [
            _row(
                job_content_type,
                job.id,
                name="GAD approval",
                group_title="Bridge-level",
                group_order=0,
                row_order=0,
                is_doc=True,
                actor=actor,
            )
        ]
    )

    span_content_type = (
        ContentType.objects.get_for_model(
            GirderSpan
        )
    )
    is_fob = (
        structure_kind == GirderStructureKind.FOB
    )

    for span_index, span_config in enumerate(
        spans
    ):
        span = GirderSpan.objects.create(
            job=job,
            label=span_config["label"],
            is_standard=span_config.get(
                "is_standard", False
            ),
            drawing_no=span_config.get(
                "drawing_no", ""
            )
            or "",
            span_length_m=span_config.get(
                "span_length_m"
            ),
            girder_type=span_config.get(
                "girder_type", ""
            )
            or "",
            qty_mt=span_config.get(
                "qty_mt"
            )
            or 0,
            vendor=span_config.get(
                "vendor", ""
            )
            or "",
            po_number=span_config.get(
                "po_number", ""
            )
            or "",
            bearings_count=span_config.get(
                "bearings_count", 4
            ),
            expansion_joints_count=span_config.get(
                "expansion_joints_count", 2
            ),
            row_order=span_index,
            created_by=actor,
            updated_by=actor,
        )

        activities = []
        for row_index, name in enumerate(
            G_CHAIN
        ):
            status = ActivityStatus.NOT_STARTED
            if (
                girder_scope
                == GirderScope.RAILWAY
                and name
                not in RAILWAY_ACTIVE_STEPS
            ):
                status = (
                    ActivityStatus.NOT_APPLICABLE
                )
            activities.append(
                _row(
                    span_content_type,
                    span.id,
                    name=name,
                    group_title="Girder fabrication",
                    group_order=1,
                    row_order=row_index,
                    status=status,
                    actor=actor,
                )
            )

        if not is_fob:
            for row_index, name in enumerate(
                B_CHAIN
            ):
                activities.append(
                    _row(
                        span_content_type,
                        span.id,
                        name=name,
                        group_title="Bearings",
                        group_order=2,
                        row_order=row_index,
                        actor=actor,
                    )
                )
            for row_index, name in enumerate(
                B_CHAIN
            ):
                activities.append(
                    _row(
                        span_content_type,
                        span.id,
                        name=name,
                        group_title="Expansion Joints",
                        group_order=3,
                        row_order=row_index,
                        actor=actor,
                    )
                )

        Activity.objects.bulk_create(activities)

    return job
