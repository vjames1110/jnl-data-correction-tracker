"""
The two field types added to the Structure Type schema engine for the
FOB rebuild: a free-typed ``"text"`` field, and a ``"group_list"``
field (a repeatable list of hand-added items, each with its own
number/boolean/choice/text sub-fields - e.g. "Platforms"). Both are
pure data capture: neither drives group/row generation the way a
``count_field``/``item_fields`` group template does.
"""

from types import SimpleNamespace

from apps.project_monitor.services.template_engine import (
    MAX_COUNT,
    normalize_config,
    validate_definition_schema,
)

PLATFORM_FIELDS = [
    {"key": "name", "label": "Name of Platform", "type": "text"},
    {
        "key": "colHeight",
        "label": "Col height (m)",
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
        "key": "foundation",
        "label": "Foundation",
        "type": "choice",
        "default": "open",
        "options": [
            {"value": "open", "label": "Open"},
            {"value": "pile", "label": "Pile"},
        ],
    },
]


def definition(config_schema, group_templates=None):
    return SimpleNamespace(
        config_schema=config_schema,
        group_templates=group_templates
        or [{"kind": "static", "title": "X", "rows": [{"name": "Row"}]}],
    )


class TestValidation:
    def test_a_text_field_is_valid(self):
        errors = validate_definition_schema(
            [{"key": "stationName", "type": "text"}],
            [{"kind": "static", "title": "X", "rows": [{"name": "Row"}]}],
        )

        assert errors == []

    def test_a_group_list_field_needs_a_fields_list(self):
        errors = validate_definition_schema(
            [{"key": "platforms", "type": "group_list"}],
            [{"kind": "static", "title": "X", "rows": [{"name": "Row"}]}],
        )

        assert any("fields" in message for message in errors)

    def test_a_valid_group_list_field_passes(self):
        errors = validate_definition_schema(
            [
                {
                    "key": "platforms",
                    "type": "group_list",
                    "fields": PLATFORM_FIELDS,
                }
            ],
            [{"kind": "static", "title": "X", "rows": [{"name": "Row"}]}],
        )

        assert errors == []

    def test_a_group_list_item_field_cannot_itself_be_a_group_list(self):
        errors = validate_definition_schema(
            [
                {
                    "key": "platforms",
                    "type": "group_list",
                    "fields": [
                        {"key": "nested", "type": "group_list", "fields": []}
                    ],
                }
            ],
            [{"kind": "static", "title": "X", "rows": [{"name": "Row"}]}],
        )

        assert any("type must be one of" in message for message in errors)

    def test_a_choice_item_field_needs_options(self):
        errors = validate_definition_schema(
            [
                {
                    "key": "platforms",
                    "type": "group_list",
                    "fields": [
                        {"key": "foundation", "type": "choice"}
                    ],
                }
            ],
            [{"kind": "static", "title": "X", "rows": [{"name": "Row"}]}],
        )

        assert any("needs 'options'" in message for message in errors)


class TestNormalization:
    def test_a_text_field_is_kept_as_a_string(self):
        config = normalize_config(
            definition([{"key": "stationName", "type": "text"}]),
            {"stationName": "Chunar"},
        )

        assert config["stationName"] == "Chunar"

    def test_a_text_field_defaults_to_an_empty_string(self):
        config = normalize_config(
            definition(
                [{"key": "stationName", "type": "text", "default": ""}]
            ),
            {},
        )

        assert config["stationName"] == ""

    def test_a_text_field_coerces_a_non_string_value(self):
        config = normalize_config(
            definition([{"key": "stationName", "type": "text"}]),
            {"stationName": 42},
        )

        assert config["stationName"] == "42"

    def test_a_group_list_normalizes_every_item_against_its_fields(self):
        config = normalize_config(
            definition(
                [
                    {
                        "key": "platforms",
                        "type": "group_list",
                        "fields": PLATFORM_FIELDS,
                    }
                ]
            ),
            {
                "platforms": [
                    {
                        "name": "Platform 1",
                        "colHeight": "7.5",
                        "hasLift": True,
                        "foundation": "pile",
                    },
                    {
                        "name": "Platform 2",
                        "colHeight": "bad-number",
                    },
                ]
            },
        )

        platforms = config["platforms"]
        assert len(platforms) == 2
        assert platforms[0] == {
            "name": "Platform 1",
            "colHeight": 7.5,
            "hasLift": True,
            "foundation": "pile",
        }
        # A bad number falls back to the field's own default; an
        # unset boolean/choice falls back to theirs too.
        assert platforms[1] == {
            "name": "Platform 2",
            "colHeight": 6.0,
            "hasLift": False,
            "foundation": "open",
        }

    def test_a_group_list_with_no_value_becomes_an_empty_list(self):
        config = normalize_config(
            definition(
                [
                    {
                        "key": "platforms",
                        "type": "group_list",
                        "fields": PLATFORM_FIELDS,
                    }
                ]
            ),
            {},
        )

        assert config["platforms"] == []

    def test_a_group_list_ignores_a_non_list_value(self):
        config = normalize_config(
            definition(
                [
                    {
                        "key": "platforms",
                        "type": "group_list",
                        "fields": PLATFORM_FIELDS,
                    }
                ]
            ),
            {"platforms": "not-a-list"},
        )

        assert config["platforms"] == []

    def test_a_group_list_is_capped_at_max_count(self):
        config = normalize_config(
            definition(
                [
                    {
                        "key": "platforms",
                        "type": "group_list",
                        "fields": PLATFORM_FIELDS,
                    }
                ]
            ),
            {
                "platforms": [
                    {"name": f"P{i}"} for i in range(MAX_COUNT + 10)
                ]
            },
        )

        assert len(config["platforms"]) == MAX_COUNT

    def test_a_group_list_item_that_is_not_an_object_is_replaced_with_defaults(
        self,
    ):
        config = normalize_config(
            definition(
                [
                    {
                        "key": "platforms",
                        "type": "group_list",
                        "fields": PLATFORM_FIELDS,
                    }
                ]
            ),
            {"platforms": ["not-an-object"]},
        )

        assert config["platforms"] == [
            {
                "name": "",
                "colHeight": 6.0,
                "hasLift": False,
                "foundation": "open",
            }
        ]
