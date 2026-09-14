from django.db import migrations

MINOR_CONFIG_SCHEMA = [
    {"key": "w", "label": "Box size - width (m)", "type": "number", "default": 3},
    {"key": "h", "label": "Box size - height (m)", "type": "number", "default": 3},
    {"key": "cells", "label": "No. of cells", "type": "number", "default": 1},
    {"key": "barrel", "label": "Barrel length (m)", "type": "number", "default": 12},
    {
        "key": "returns",
        "label": "Return walls",
        "type": "choice",
        "default": 4,
        "options": [
            {"value": 2, "label": "2"},
            {"value": 4, "label": "4"},
        ],
    },
    {
        "key": "stairs",
        "label": "Staircases",
        "type": "choice",
        "default": 2,
        "options": [
            {"value": 0, "label": "0"},
            {"value": 1, "label": "1"},
            {"value": 2, "label": "2"},
        ],
    },
    {"key": "apron", "label": "Apron", "type": "boolean", "default": True},
]

MINOR_GROUP_TEMPLATES = [
    {
        "kind": "static",
        "title": "Box structure",
        "rows": [
            {"name": "Box raft", "kind": "TASK"},
            {"name": "Box wall", "kind": "TASK"},
            {"name": "Box slab", "kind": "TASK"},
            {
                "name": "R/W {n}",
                "kind": "TASK",
                "repeat": 4,
                "na_when": {"type": "index_gt", "field": "returns"},
            },
            {"name": "Drop wall", "kind": "TASK"},
            {"name": "Curtain wall", "kind": "TASK"},
            {"name": "Bell mouth", "kind": "TASK"},
            {
                "name": "Apron",
                "kind": "TASK",
                "na_when": {"type": "is_false", "field": "apron"},
            },
            {"name": "Bell mouth filling", "kind": "TASK"},
            {"name": "Pitching", "kind": "TASK"},
            {
                "name": "Staircase {n}",
                "kind": "TASK",
                "repeat": 2,
                "na_when": {"type": "index_gt", "field": "stairs"},
            },
            {"name": "Ballast retainer", "kind": "TASK"},
            {"name": "Coping", "kind": "TASK"},
            {"name": "Painting", "kind": "TASK"},
        ],
    },
]

MINOR_DESCRIPTION = (
    "{cells}×{w}×{h} m box · barrel {barrel} m · {returns} return "
    "walls · {stairs} staircase(s) · apron {apron}"
)

RUB_CONFIG_SCHEMA = [
    {"key": "w", "label": "Box size - width (m)", "type": "number", "default": 6},
    {"key": "h", "label": "Box size - height (m)", "type": "number", "default": 4.5},
    {"key": "cells", "label": "No. of cells", "type": "number", "default": 1},
    {"key": "barrel", "label": "Barrel length (m)", "type": "number", "default": 14},
    {
        "key": "returns",
        "label": "Return walls",
        "type": "choice",
        "default": 4,
        "options": [
            {"value": 2, "label": "2"},
            {"value": 4, "label": "4"},
        ],
    },
    {"key": "raftLHS", "label": "Approach raft LHS (m)", "type": "number", "default": 60},
    {"key": "raftRHS", "label": "Approach raft RHS (m)", "type": "number", "default": 60},
    {"key": "wallLHS", "label": "Approach wall LHS (m)", "type": "number", "default": 120},
    {"key": "wallRHS", "label": "Approach wall RHS (m)", "type": "number", "default": 120},
    {
        "key": "sheeting",
        "label": "Sheeting of approach road",
        "type": "boolean",
        "default": True,
    },
]

RUB_GROUP_TEMPLATES = [
    {
        "kind": "static",
        "title": "Box structure",
        "rows": [
            {"name": "Box raft", "kind": "TASK"},
            {"name": "Box wall", "kind": "TASK"},
            {"name": "Box slab", "kind": "TASK"},
            {
                "name": "R/W {n}",
                "kind": "TASK",
                "repeat": 4,
                "na_when": {"type": "index_gt", "field": "returns"},
            },
        ],
    },
    {
        "kind": "sides",
        "separate_groups": False,
        "title": "Approach roads",
        "subtitle": "Raft & wall monitored by length (m)",
        "rows": [
            {
                "name": "Approach road raft – {side}",
                "kind": "LENGTH",
                "unit": "m",
                "qty_field": "raft{side}",
                "na_when": {"type": "lte_zero", "field": "raft{side}"},
            },
            {
                "name": "Approach road wall – {side}",
                "kind": "LENGTH",
                "unit": "m",
                "qty_field": "wall{side}",
                "na_when": {"type": "lte_zero", "field": "wall{side}"},
            },
        ],
        "shared_rows": [
            {"name": "Height gauge (both ends)", "kind": "TASK"},
            {"name": "Approach drain", "kind": "TASK"},
            {"name": "Speed breaker", "kind": "TASK"},
            {
                "name": "Sheeting of approach road",
                "kind": "TASK",
                "na_when": {"type": "is_false", "field": "sheeting"},
            },
        ],
    },
]

RUB_DESCRIPTION = (
    "{cells}×{w}×{h} m box · barrel {barrel} m · {returns} return "
    "walls · approach raft {raftLHS}/{raftRHS} m · wall "
    "{wallLHS}/{wallRHS} m"
)

_FOUNDATION_OPTIONS = [
    {"value": "open", "label": "Open"},
    {"value": "pile", "label": "Pile"},
]
_GIRDER_SCOPE_OPTIONS = [
    {"value": "jnl", "label": "JNL scope"},
    {"value": "rly", "label": "Railway scope"},
    {"value": "other", "label": "Other agency"},
]

MAJOR_CONFIG_SCHEMA = [
    {"key": "spans", "label": "No. of spans", "type": "number", "default": 3},
    {"key": "abuts", "label": "No. of abutments", "type": "number", "default": 2},
    {
        "key": "abutFound",
        "label": "Abutment foundation",
        "type": "choice",
        "default": "open",
        "options": _FOUNDATION_OPTIONS,
    },
    {"key": "piers", "label": "No. of piers", "type": "number", "default": 2},
    {
        "key": "pierFound",
        "label": "Pier foundation",
        "type": "choice",
        "default": "open",
        "options": _FOUNDATION_OPTIONS,
    },
    {
        "key": "girderScope",
        "label": "Girder fabrication & launching",
        "type": "choice",
        "default": "jnl",
        "options": _GIRDER_SCOPE_OPTIONS,
    },
]

MAJOR_GROUP_TEMPLATES = [
    {
        "kind": "repeat",
        "count_field": "abuts",
        "title_template": "Abutment A{n}",
        "subtitle_template": "Height {item:abutH} m · {foundation:abutFound:abutPiles}",
        "item_fields": [
            {"key": "abutH", "label_template": "A{n} height (m)", "default": 6},
            {"key": "abutPiles", "label_template": "A{n} piles (nos)", "default": 8},
        ],
        "leading_row_when": {"field": "abutFound", "equals": "pile"},
        "leading_row": {
            "name": "Pile",
            "kind": "LENGTH",
            "unit": "nos",
            "qty_field": "item:abutPiles",
        },
        "rows": [
            {"name": "Raft / Pile cap", "kind": "TASK"},
            {"name": "Stem", "kind": "TASK"},
            {"name": "Cap", "kind": "TASK"},
            {"name": "Pedestal", "kind": "TASK"},
            {"name": "Dirt wall / Ballast retainer", "kind": "TASK"},
            {"name": "Bell mouth wall", "kind": "TASK"},
            {"name": "Filling of bell mouth", "kind": "TASK"},
            {"name": "Pitching", "kind": "TASK"},
            {"name": "Staircase", "kind": "TASK"},
        ],
    },
    {
        "kind": "repeat",
        "count_field": "piers",
        "title_template": "Pier P{n}",
        "subtitle_template": "Height {item:pierH} m · {foundation:pierFound:pierPiles}",
        "item_fields": [
            {"key": "pierH", "label_template": "P{n} height (m)", "default": 8},
            {"key": "pierPiles", "label_template": "P{n} piles (nos)", "default": 8},
        ],
        "leading_row_when": {"field": "pierFound", "equals": "pile"},
        "leading_row": {
            "name": "Pile",
            "kind": "LENGTH",
            "unit": "nos",
            "qty_field": "item:pierPiles",
        },
        "rows": [
            {"name": "Raft / Pile cap", "kind": "TASK"},
            {"name": "Stem", "kind": "TASK"},
            {"name": "Cap", "kind": "TASK"},
            {"name": "Pedestal", "kind": "TASK"},
        ],
    },
    {
        "kind": "chain",
        "count_field": "spans",
        "group_per_item": False,
        "title": "Superstructure (span-wise)",
        "subtitle_template": "{spans} span(s) · Girder scope: {choice_label:girderScope}",
        "name_prefix_template": "S{n} – ",
        "rows": [
            {"name": "Bearings", "kind": "TASK"},
            {
                "name": "",
                "kind": "TASK",
                "variant_field": "girderScope",
                "variants": {
                    "jnl": [
                        {"name": "Girder fabrication", "kind": "TASK"},
                        {"name": "Girder launching", "kind": "TASK"},
                    ],
                    "rly": [
                        {
                            "name": (
                                "Girder fabrication & launching (by "
                                "Railway) – follow-up"
                            ),
                            "kind": "TASK",
                        },
                    ],
                    "other": [
                        {
                            "name": (
                                "Girder fabrication & launching (by "
                                "other agency) – follow-up"
                            ),
                            "kind": "TASK",
                        },
                    ],
                    "default": [
                        {
                            "name": (
                                "Girder fabrication & launching (by "
                                "other agency) – follow-up"
                            ),
                            "kind": "TASK",
                        },
                    ],
                },
            },
            {"name": "Deck slab / Ballast wall", "kind": "TASK"},
        ],
    },
]

MAJOR_DESCRIPTION = (
    "{spans} spans · {abuts} abutments ({abutFound}) · {piers} "
    "piers ({pierFound}) · girders: {choice_label:girderScope}"
)

ROB_CONFIG_SCHEMA = [
    {"key": "subs", "label": "No. of abutments + piers", "type": "number", "default": 2},
    {
        "key": "found",
        "label": "Foundation",
        "type": "choice",
        "default": "open",
        "options": _FOUNDATION_OPTIONS,
    },
    {
        "key": "girderScope",
        "label": "Girder fabrication",
        "type": "choice",
        "default": "jnl",
        "options": _GIRDER_SCOPE_OPTIONS,
    },
    {"key": "rwLHS", "label": "Retaining wall LHS (m) — 0 if nil", "type": "number", "default": 0},
    {"key": "reLHS", "label": "RE wall LHS (sqm) — 0 if nil", "type": "number", "default": 0},
    {"key": "fillLHS", "label": "Filling behind wall LHS (cum)", "type": "number", "default": 5000},
    {"key": "cbLHS", "label": "Crash barrier LHS (rm)", "type": "number", "default": 300},
    {"key": "roadLHS", "label": "Road laying LHS (rm)", "type": "number", "default": 150},
    {"key": "rwRHS", "label": "Retaining wall RHS (m) — 0 if nil", "type": "number", "default": 0},
    {"key": "reRHS", "label": "RE wall RHS (sqm) — 0 if nil", "type": "number", "default": 0},
    {"key": "fillRHS", "label": "Filling behind wall RHS (cum)", "type": "number", "default": 5000},
    {"key": "cbRHS", "label": "Crash barrier RHS (rm)", "type": "number", "default": 300},
    {"key": "roadRHS", "label": "Road laying RHS (rm)", "type": "number", "default": 150},
]

ROB_GROUP_TEMPLATES = [
    {
        "kind": "repeat",
        "count_field": "subs",
        "title_by_position": {
            "first": "Abutment A1",
            "last": "Abutment A2",
            "middle": "Pier P{m}",
        },
        "subtitle_template": "{foundation:found}",
        "item_fields": [
            {"key": "piles", "label_template": "{n} piles (nos)", "default": 8},
        ],
        "leading_row_when": {"field": "found", "equals": "pile"},
        "leading_row": {
            "name": "Pile",
            "kind": "LENGTH",
            "unit": "nos",
            "qty_field": "item:piles",
        },
        "rows": [
            {"name": "Raft", "kind": "TASK"},
            {"name": "Stem", "kind": "TASK"},
            {"name": "Pier cap", "kind": "TASK"},
            {"name": "Pedestal", "kind": "TASK"},
        ],
    },
    {
        "kind": "chain",
        "count_field": "subs",
        "count_offset": -1,
        "group_per_item": True,
        "title_template": "Girder G{n}",
        "subtitle_template": "between {between:subs}{girder_scope_suffix:girderScope}",
        "rows": [
            {"name": "Bearings", "kind": "TASK"},
            {
                "name": "Girder fabrication / casting",
                "kind": "TASK",
                "show_when": {"field": "girderScope", "equals": "jnl"},
            },
            {"name": "Girder launching", "kind": "TASK"},
            {"name": "Deck slab", "kind": "TASK"},
        ],
    },
    {
        "kind": "sides",
        "separate_groups": True,
        "title_template": "Approach {side}",
        "subtitle_template": "Retaining wall {rw{side}} m · RE wall {re{side}} sqm",
        "rows": [
            {
                "name": "Retaining wall",
                "kind": "LENGTH",
                "unit": "m",
                "qty_field": "rw{side}",
                "na_when": {"type": "lte_zero", "field": "rw{side}"},
            },
            {
                "name": "RE wall",
                "kind": "LENGTH",
                "unit": "sqm",
                "qty_field": "re{side}",
                "na_when": {"type": "lte_zero", "field": "re{side}"},
            },
            {
                "name": "Filling behind wall",
                "kind": "LENGTH",
                "unit": "cum",
                "qty_field": "fill{side}",
                "na_when": {"type": "lte_zero", "field": "fill{side}"},
            },
            {
                "name": "Crash barrier",
                "kind": "LENGTH",
                "unit": "m",
                "qty_field": "cb{side}",
                "na_when": {"type": "lte_zero", "field": "cb{side}"},
            },
            {
                "name": "Road laying",
                "kind": "LENGTH",
                "unit": "m",
                "qty_field": "road{side}",
                "na_when": {"type": "lte_zero", "field": "road{side}"},
            },
        ],
    },
]

ROB_DESCRIPTION = (
    "{subs} substructures ({found}) · girders: "
    "{choice_label:girderScope}"
)

BUILTIN_TYPES = [
    {
        "code": "MINOR",
        "name": "Minor Bridge",
        "description_template": MINOR_DESCRIPTION,
        "config_schema": MINOR_CONFIG_SCHEMA,
        "group_templates": MINOR_GROUP_TEMPLATES,
        "display_order": 1,
    },
    {
        "code": "MAJOR",
        "name": "Major Bridge",
        "description_template": MAJOR_DESCRIPTION,
        "config_schema": MAJOR_CONFIG_SCHEMA,
        "group_templates": MAJOR_GROUP_TEMPLATES,
        "display_order": 2,
    },
    {
        "code": "RUB",
        "name": "RUB",
        "description_template": RUB_DESCRIPTION,
        "config_schema": RUB_CONFIG_SCHEMA,
        "group_templates": RUB_GROUP_TEMPLATES,
        "display_order": 3,
    },
    {
        "code": "ROB",
        "name": "ROB",
        "description_template": ROB_DESCRIPTION,
        "config_schema": ROB_CONFIG_SCHEMA,
        "group_templates": ROB_GROUP_TEMPLATES,
        "display_order": 4,
    },
]


def seed_builtin_types(apps, schema_editor):
    StructureTypeDefinition = apps.get_model(
        "project_monitor", "StructureTypeDefinition"
    )
    for payload in BUILTIN_TYPES:
        StructureTypeDefinition.objects.update_or_create(
            code=payload["code"],
            defaults=payload,
        )


def remove_builtin_types(apps, schema_editor):
    StructureTypeDefinition = apps.get_model(
        "project_monitor", "StructureTypeDefinition"
    )
    StructureTypeDefinition.objects.filter(
        code__in=[item["code"] for item in BUILTIN_TYPES]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("project_monitor", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            seed_builtin_types, remove_builtin_types
        ),
    ]
