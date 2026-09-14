"""
Structure-specific glue around ``services.template_engine`` - the
generic engine itself (schema validation, config normalization, and
turning ``config_schema``/``group_templates`` into activity groups)
lives there and is shared with Buildings
(``services.building_generator``). This module only adds what's
particular to a ``Structure``: the GAD/Structural-drawing "Approvals"
docs every structure type gets, and bulk-creating the resulting
``Activity`` rows against a ``Structure`` instance.
"""

from django.contrib.contenttypes.models import ContentType

from apps.project_monitor.models import (
    Activity,
    Structure,
)
from apps.project_monitor.services.template_engine import (
    doc_rows,
    normalize_config,
    render_description,
    render_groups,
    validate_definition_schema,
)

__all__ = [
    "create_structure",
    "normalize_config",
    "render_description",
    "render_groups",
    "validate_definition_schema",
]


def create_structure(
    *,
    site,
    structure_type,
    name,
    chainage_km,
    config,
    actor,
):
    normalized_config = normalize_config(
        structure_type, config
    )
    groups = render_groups(
        structure_type, normalized_config
    )
    description = render_description(
        structure_type, normalized_config
    )

    structure = Structure.objects.create(
        site=site,
        structure_type=structure_type,
        name=name,
        chainage_km=chainage_km,
        config=normalized_config,
        description=description,
        created_by=actor,
        updated_by=actor,
    )

    content_type = ContentType.objects.get_for_model(
        Structure
    )
    activities = []

    if structure_type.include_approval_docs:
        for row_index, row in enumerate(
            doc_rows()
        ):
            activities.append(
                Activity(
                    content_type=content_type,
                    object_id=structure.id,
                    name=row["name"],
                    group_title="Approvals",
                    group_order=0,
                    row_order=row_index,
                    kind=row["kind"],
                    unit=row["unit"],
                    total_qty=row["total_qty"],
                    status=row["status"],
                    is_doc=row["is_doc"],
                    created_by=actor,
                    updated_by=actor,
                )
            )

    for group_index, group in enumerate(
        groups, start=1
    ):
        for row_index, row in enumerate(
            group["rows"]
        ):
            activities.append(
                Activity(
                    content_type=content_type,
                    object_id=structure.id,
                    name=row["name"],
                    group_title=group["title"],
                    group_subtitle=group.get(
                        "subtitle", ""
                    ),
                    group_order=group_index,
                    row_order=row_index,
                    kind=row["kind"],
                    unit=row["unit"],
                    total_qty=row["total_qty"],
                    status=row["status"],
                    is_doc=row.get(
                        "is_doc", False
                    ),
                    material_tracked=row.get(
                        "material_tracked",
                        False,
                    ),
                    material_status=row.get(
                        "material_status"
                    ),
                    created_by=actor,
                    updated_by=actor,
                )
            )

    Activity.objects.bulk_create(activities)
    return structure
