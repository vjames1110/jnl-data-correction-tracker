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
    ActivityStatus,
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
    "update_structure",
    "normalize_config",
    "render_description",
    "render_groups",
    "validate_definition_schema",
]

_UNSET = object()


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


def update_structure(
    *,
    structure,
    config,
    name=_UNSET,
    chainage_km=_UNSET,
    actor,
):
    """
    Edits a structure's own inputs after the fact - the same config
    form "Add a structure" uses, re-run against the sheet that
    already exists. Reconciled against the current Activity rows by
    a natural key (``group_title``, ``group_subtitle``, row
    ``name``) - deterministic given the templates, so a row that is
    still generated keeps its history untouched; the Approvals docs
    (``group_order == 0``) are never regenerated and are left alone
    entirely.

    Never deletes a row a person may have already logged progress
    on: a row the new config no longer generates is marked
    NOT_APPLICABLE instead (moved to the end of the sheet so it
    doesn't interleave with current groups) - the same state a row
    already gets when a count shrinks at creation time. A row that
    newly starts (or stops) being generated gets its status flipped
    between NOT_STARTED and NOT_APPLICABLE only on that transition;
    a row whose applicability hasn't changed keeps whatever real
    progress is already on it.
    """

    definition = structure.structure_type
    normalized_config = normalize_config(
        definition, config
    )
    new_groups = render_groups(
        definition, normalized_config
    )
    description = render_description(
        definition, normalized_config
    )

    if name is not _UNSET:
        structure.name = name
    if chainage_km is not _UNSET:
        structure.chainage_km = chainage_km
    structure.config = normalized_config
    structure.description = description
    structure.updated_by = actor

    content_type = ContentType.objects.get_for_model(
        Structure
    )
    existing = {
        (
            activity.group_title,
            activity.group_subtitle,
            activity.name,
        ): activity
        for activity in Activity.objects.filter(
            content_type=content_type,
            object_id=structure.id,
        )
        if activity.group_order != 0
    }
    matched_keys = set()
    to_create = []

    for group_index, group in enumerate(
        new_groups, start=1
    ):
        subtitle = group.get("subtitle", "")
        for row_index, row in enumerate(
            group["rows"]
        ):
            key = (
                group["title"],
                subtitle,
                row["name"],
            )
            found = existing.get(key)
            if found is None:
                to_create.append(
                    Activity(
                        content_type=content_type,
                        object_id=structure.id,
                        name=row["name"],
                        group_title=group["title"],
                        group_subtitle=subtitle,
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
                            "material_tracked", False
                        ),
                        material_status=row.get(
                            "material_status"
                        ),
                        created_by=actor,
                        updated_by=actor,
                    )
                )
                continue

            matched_keys.add(key)
            new_is_na = (
                row["status"]
                == ActivityStatus.NOT_APPLICABLE
            )
            old_is_na = (
                found.status
                == ActivityStatus.NOT_APPLICABLE
            )
            if new_is_na and not old_is_na:
                found.status = (
                    ActivityStatus.NOT_APPLICABLE
                )
            elif old_is_na and not new_is_na:
                found.status = (
                    ActivityStatus.NOT_STARTED
                )

            found.group_title = group["title"]
            found.group_subtitle = subtitle
            found.group_order = group_index
            found.row_order = row_index
            found.kind = row["kind"]
            found.unit = row["unit"]
            found.total_qty = row["total_qty"]
            found.is_doc = row.get(
                "is_doc", False
            )
            new_material_tracked = row.get(
                "material_tracked", False
            )
            if (
                new_material_tracked
                and not found.material_tracked
            ):
                found.material_status = row.get(
                    "material_status"
                )
            elif not new_material_tracked:
                found.material_status = None
            found.material_tracked = (
                new_material_tracked
            )
            found.updated_by = actor
            found.save()

    orphaned_group_order = len(new_groups) + 1
    for key, activity in existing.items():
        if key in matched_keys:
            continue
        if (
            activity.status
            != ActivityStatus.NOT_APPLICABLE
        ):
            activity.status = (
                ActivityStatus.NOT_APPLICABLE
            )
        activity.group_order = orphaned_group_order
        activity.updated_by = actor
        activity.save()

    if to_create:
        Activity.objects.bulk_create(to_create)

    structure.full_clean()
    structure.save()
    return structure
