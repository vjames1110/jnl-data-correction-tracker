"""
A proper "Foot Over Bridge" structure type - replaces whatever "FOB"
row may already exist (a hand-copy of Major Bridge, made through the
Admin UI before this type existed) with the real schema: Station Name
and Chainage/Ramp as free-typed text, a repeatable "Platforms" list
(name, column height, has lift/staircase/ramp, foundation, no. of
piles - a genuinely new "group_list" field type, see
``services.template_engine``), and the fixed monitoring activities
(Footing/Civil/Girder/Deck/Staircase/Lift/ACP/Flooring) confirmed by
the director. Platforms are pure data capture - the activity list is
the same regardless of how many platforms are added or what they
carry, matching what was actually asked for rather than inventing
per-platform activity repetition.

``update_or_create`` on ``code="FOB"`` means this replaces an
existing hand-made row in place rather than requiring it to be deleted
first; any structures already generated from the OLD schema are
untouched (activities are generated once, at creation time).
"""

from django.db import migrations

_FOUNDATION_OPTIONS = [
    {"value": "open", "label": "Open"},
    {"value": "pile", "label": "Pile"},
]
_GIRDER_SCOPE_OPTIONS = [
    {"value": "jnl", "label": "JNL scope"},
    {"value": "rly", "label": "Railway scope"},
    {"value": "other", "label": "Other agency"},
]

FOB_PLATFORM_FIELDS = [
    {
        "key": "name",
        "label": "Name of Platform",
        "type": "text",
        "default": "",
    },
    {
        "key": "colHeight",
        "label": "Column height (m)",
        "type": "number",
        "default": 6,
    },
    {
        "key": "hasLift",
        "label": "Has Lift",
        "type": "boolean",
        "default": False,
    },
    {
        "key": "hasStaircase",
        "label": "Staircase",
        "type": "boolean",
        "default": True,
    },
    {
        "key": "hasRamp",
        "label": "Ramp",
        "type": "boolean",
        "default": False,
    },
    {
        "key": "foundation",
        "label": "Foundation",
        "type": "choice",
        "default": "open",
        "options": _FOUNDATION_OPTIONS,
    },
    {
        "key": "noOfPile",
        "label": "No. of pile",
        "type": "number",
        "default": 0,
    },
]

FOB_CONFIG_SCHEMA = [
    {
        "key": "stationName",
        "label": "Station Name",
        "type": "text",
        "default": "",
    },
    {
        "key": "chainageRamp",
        "label": "Chainage/Ramp",
        "type": "text",
        "default": "",
    },
    {
        "key": "spans",
        "label": "No. of spans",
        "type": "number",
        "default": 2,
    },
    {
        "key": "girderScope",
        "label": "Girder Fabrication & Launching",
        "type": "choice",
        "default": "jnl",
        "options": _GIRDER_SCOPE_OPTIONS,
    },
    {
        "key": "platforms",
        "label": "Platforms",
        "type": "group_list",
        "default": [],
        "fields": FOB_PLATFORM_FIELDS,
    },
]

FOB_GROUP_TEMPLATES = [
    {
        "kind": "static",
        "title": "Footing",
        "rows": [
            {"name": "Main Footing", "kind": "TASK"},
            {"name": "Stair Footing", "kind": "TASK"},
            {"name": "Lift Pit", "kind": "TASK"},
            {"name": "Escalator Column", "kind": "TASK"},
            {"name": "Escalator Pit", "kind": "TASK"},
        ],
    },
    {
        "kind": "static",
        "title": "Civil",
        "rows": [
            {"name": "Stair Concrete", "kind": "TASK"},
            {"name": "Name of Civil team", "kind": "TASK"},
            {"name": "Main column launching", "kind": "TASK"},
        ],
    },
    {
        "kind": "static",
        "title": "Girder",
        "rows": [
            {"name": "Girder Fabrication", "kind": "TASK"},
            {"name": "Fabrication Team", "kind": "TASK"},
        ],
    },
    {
        "kind": "static",
        "title": "Deck",
        "rows": [
            {"name": "Deck sheet", "kind": "TASK"},
            {"name": "Deck Slab", "kind": "TASK"},
        ],
    },
    {
        "kind": "static",
        "title": "Staircase",
        "rows": [
            {
                "name": "Staircase fabrication and erection",
                "kind": "TASK",
            },
        ],
    },
    {
        "kind": "static",
        "title": "Lift",
        "rows": [
            {"name": "Lift Framework", "kind": "TASK"},
            {"name": "Escalator Frame erection", "kind": "TASK"},
            {"name": "Gangway materials", "kind": "TASK"},
            {"name": "Gangway roof", "kind": "TASK"},
            {"name": "Stairway & Esc roof", "kind": "TASK"},
            {"name": "Fabrication team", "kind": "TASK"},
        ],
    },
    {
        "kind": "static",
        "title": "ACP",
        "rows": [
            {"name": "ACP for lift", "kind": "TASK"},
            {"name": "Fixing team", "kind": "TASK"},
        ],
    },
    {
        "kind": "static",
        "title": "Flooring",
        "rows": [
            {"name": "Flooring granite", "kind": "TASK"},
            {"name": "Laying team", "kind": "TASK"},
        ],
    },
]

FOB_DESCRIPTION = (
    "{stationName} · {spans} spans · girders: "
    "{choice_label:girderScope}"
)

FOB_TYPE = {
    "code": "FOB",
    "name": "FOB (Foot Over Bridge)",
    "description_template": FOB_DESCRIPTION,
    "config_schema": FOB_CONFIG_SCHEMA,
    "group_templates": FOB_GROUP_TEMPLATES,
    "include_approval_docs": True,
    "display_order": 5,
}


def seed_fob_type(apps, schema_editor):
    StructureTypeDefinition = apps.get_model(
        "project_monitor", "StructureTypeDefinition"
    )
    StructureTypeDefinition.objects.update_or_create(
        code=FOB_TYPE["code"], defaults=FOB_TYPE
    )


def remove_fob_type(apps, schema_editor):
    StructureTypeDefinition = apps.get_model(
        "project_monitor", "StructureTypeDefinition"
    )
    StructureTypeDefinition.objects.filter(
        code=FOB_TYPE["code"]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("project_monitor", "0025_costingboqitem"),
    ]

    operations = [
        migrations.RunPython(
            seed_fob_type, remove_fob_type
        ),
    ]
