"""
Buildings have one fixed shape (unlike Structures, which are an
admin-configurable master of types) - this module is the Python
equivalent of a single ``StructureTypeDefinition``, feeding the same
generic ``services.template_engine`` the ``Structure`` side uses.

Ports the prototype's ``addBuilding()``: Foundation & plinth (with a
Pile row when piled, a Footing/Raft swap otherwise) -> one repeating
group per floor (Ground Floor, 1st Floor, 2nd Floor, ...) with a
fixed 9-activity checklist, 5 of which carry an independent Material
status -> Finishing & services (N/A-marking Lift/Fire fighting/
Compound wall when their flag is off).
"""

from types import SimpleNamespace

from django.contrib.contenttypes.models import ContentType

from apps.project_monitor.models import (
    Activity,
    Building,
)
from apps.project_monitor.services.template_engine import (
    MAX_COUNT,
    doc_rows,
    normalize_config,
    render_description,
    render_groups,
)

_FOUNDATION_OPTIONS = [
    {"value": "open", "label": "Open / isolated footings"},
    {"value": "raft", "label": "Raft"},
    {"value": "pile", "label": "Pile"},
]

CONFIG_SCHEMA = [
    {
        "key": "gf",
        "label": "Ground floor area (sqm)",
        "type": "number",
        "default": 500,
    },
    {
        "key": "up",
        "label": "No. of upper floors",
        "type": "number",
        "default": 1,
    },
    {
        "key": "uf",
        "label": "Typical upper floor area (sqm)",
        "type": "number",
        "default": 500,
    },
    {
        "key": "found",
        "label": "Foundation",
        "type": "choice",
        "default": "open",
        "options": _FOUNDATION_OPTIONS,
    },
    {
        "key": "piles",
        "label": "Piles (nos)",
        "type": "number",
        "default": 40,
    },
    {
        "key": "lift",
        "label": "Lift",
        "type": "boolean",
        "default": False,
    },
    {
        "key": "fire",
        "label": "Fire fighting",
        "type": "boolean",
        "default": False,
    },
    {
        "key": "ext",
        "label": (
            "Compound wall / external "
            "development"
        ),
        "type": "boolean",
        "default": True,
    },
]

_MATERIAL_ROW = {"material_tracked": True}

GROUP_TEMPLATES = [
    {
        "kind": "static",
        "title": "Foundation & plinth",
        "subtitle_template": "{foundation:found:piles}",
        "rows": [
            {
                "name": "Pile",
                "kind": "LENGTH",
                "unit": "nos",
                "qty_field": "piles",
                "show_when": {
                    "field": "found",
                    "equals": "pile",
                },
            },
            {
                "variant_field": "found",
                "variants": {
                    "raft": [
                        {
                            "name": "Raft",
                            "kind": "TASK",
                        }
                    ],
                    "default": [
                        {
                            "name": (
                                "Footing / "
                                "foundation"
                            ),
                            "kind": "TASK",
                        }
                    ],
                },
            },
            {
                "name": "Column up to plinth",
                "kind": "TASK",
            },
            {"name": "Plinth beam", "kind": "TASK"},
            {
                "name": "Plinth filling & PCC",
                "kind": "TASK",
            },
            {"name": "DPC", "kind": "TASK"},
        ],
    },
    {
        "kind": "repeat",
        "count_field": "floorsCount",
        "title_rule": "floor_ordinal",
        "subtitle_template": "{item:floorAreas} sqm",
        "item_fields": [
            {"key": "floorAreas", "default": 0},
        ],
        "rows": [
            {"name": "Columns", "kind": "TASK"},
            {
                "name": "Beams & slab",
                "kind": "TASK",
            },
            {"name": "Brickwork", "kind": "TASK"},
            {"name": "Plastering", "kind": "TASK"},
            {
                "name": "Flooring",
                "kind": "TASK",
                **_MATERIAL_ROW,
            },
            {
                "name": "Doors & windows",
                "kind": "TASK",
                **_MATERIAL_ROW,
            },
            {
                "name": (
                    "Electrical conduit & "
                    "wiring"
                ),
                "kind": "TASK",
                **_MATERIAL_ROW,
            },
            {
                "name": "Plumbing & sanitary",
                "kind": "TASK",
                **_MATERIAL_ROW,
            },
            {
                "name": "Painting",
                "kind": "TASK",
                **_MATERIAL_ROW,
            },
        ],
    },
    {
        "kind": "static",
        "title": "Finishing & services",
        "rows": [
            {"name": "Staircase", "kind": "TASK"},
            {
                "name": "Roof waterproofing",
                "kind": "TASK",
            },
            {
                "name": "Parapet & coping",
                "kind": "TASK",
            },
            {
                "name": (
                    "External plaster & "
                    "painting"
                ),
                "kind": "TASK",
            },
            {
                "name": "Lift",
                "kind": "TASK",
                "na_when": {
                    "type": "is_false",
                    "field": "lift",
                },
                **_MATERIAL_ROW,
            },
            {
                "name": "Fire fighting",
                "kind": "TASK",
                "na_when": {
                    "type": "is_false",
                    "field": "fire",
                },
                **_MATERIAL_ROW,
            },
            {
                "name": (
                    "Electrical DB & fixtures"
                ),
                "kind": "TASK",
                **_MATERIAL_ROW,
            },
            {
                "name": (
                    "Water supply & sewer "
                    "connection"
                ),
                "kind": "TASK",
            },
            {
                "name": (
                    "Compound wall & external "
                    "development"
                ),
                "kind": "TASK",
                "na_when": {
                    "type": "is_false",
                    "field": "ext",
                },
            },
            {
                "name": "Handing over",
                "kind": "TASK",
            },
        ],
    },
]

DESCRIPTION_TEMPLATE = (
    "{gf} sqm GF + {up} upper floor(s) x {uf} sqm "
    "= {totalBuiltUpArea} sqm - "
    "{foundation:found:piles}"
)

DEFINITION = SimpleNamespace(
    config_schema=CONFIG_SCHEMA,
    group_templates=GROUP_TEMPLATES,
    description_template=DESCRIPTION_TEMPLATE,
)


def _with_derived_fields(config):
    up = max(
        0,
        min(
            MAX_COUNT - 1,
            int(config.get("up") or 0),
        ),
    )
    config["up"] = up
    gf = float(config.get("gf") or 0)
    uf = float(config.get("uf") or 0)

    config["floorsCount"] = up + 1
    config["floorAreas"] = [gf] + [uf] * up
    config["totalBuiltUpArea"] = gf + up * uf
    return config


def create_building(
    *,
    site,
    name,
    station_label,
    chainage_km,
    config,
    actor,
):
    normalized_config = _with_derived_fields(
        normalize_config(DEFINITION, config)
    )
    groups = render_groups(
        DEFINITION, normalized_config
    )
    description = render_description(
        DEFINITION, normalized_config
    )

    building = Building.objects.create(
        site=site,
        name=name,
        station_label=station_label or "",
        chainage_km=chainage_km,
        config=normalized_config,
        description=description,
        created_by=actor,
        updated_by=actor,
    )

    content_type = ContentType.objects.get_for_model(
        Building
    )
    activities = []

    for row_index, row in enumerate(doc_rows()):
        activities.append(
            Activity(
                content_type=content_type,
                object_id=building.id,
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
                    object_id=building.id,
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
    return building
