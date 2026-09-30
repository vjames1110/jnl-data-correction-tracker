"""
Two engine extensions from the same request: a ``"repeat"`` group's
per-index ``item_fields`` can now declare their own ``"type"`` (e.g.
``"text"`` for a human-entered abutment/pier name, not just a number),
and ``description_template``/``subtitle_template`` gain a
``{sum:list_field.item_field}`` aggregate placeholder (e.g. a FOB's
total pile count across every platform).
"""

from types import SimpleNamespace

from apps.project_monitor.services.template_engine import (
    normalize_config,
    render_description,
    render_groups,
    validate_definition_schema,
)

NAMED_ABUTMENTS_GROUP = {
    "kind": "repeat",
    "count_field": "abuts",
    "title_template": "Abutment A{n}",
    "subtitle_template": "{item:abutName} · Height {item:abutH} m",
    "item_fields": [
        {
            "key": "abutName",
            "label_template": "A{n} name",
            "type": "text",
            "default": "",
        },
        {
            "key": "abutH",
            "label_template": "A{n} height (m)",
            "default": 6,
        },
    ],
    "rows": [{"name": "Stem", "kind": "TASK"}],
}


def definition(config_schema, group_templates, description_template=""):
    return SimpleNamespace(
        config_schema=config_schema,
        group_templates=group_templates,
        description_template=description_template,
    )


class TestRepeatItemFieldTypeValidation:
    def test_a_text_item_field_on_a_repeat_group_is_valid(self):
        errors = validate_definition_schema(
            [{"key": "abuts", "type": "number", "default": 2}],
            [NAMED_ABUTMENTS_GROUP],
        )

        assert errors == []

    def test_an_invalid_item_field_type_is_rejected(self):
        errors = validate_definition_schema(
            [{"key": "abuts", "type": "number", "default": 2}],
            [
                {
                    **NAMED_ABUTMENTS_GROUP,
                    "item_fields": [
                        {
                            "key": "abutName",
                            "type": "group_list",
                        }
                    ],
                }
            ],
        )

        assert any(
            "type must be one of" in message
            for message in errors
        )

    def test_a_choice_item_field_on_a_repeat_group_needs_options(self):
        errors = validate_definition_schema(
            [{"key": "abuts", "type": "number", "default": 2}],
            [
                {
                    **NAMED_ABUTMENTS_GROUP,
                    "item_fields": [
                        {
                            "key": "abutGrade",
                            "type": "choice",
                        }
                    ],
                }
            ],
        )

        assert any(
            "needs 'options'" in message
            for message in errors
        )

    def test_an_item_field_missing_a_key_is_rejected(self):
        errors = validate_definition_schema(
            [{"key": "abuts", "type": "number", "default": 2}],
            [
                {
                    **NAMED_ABUTMENTS_GROUP,
                    "item_fields": [{"type": "text"}],
                }
            ],
        )

        assert any(
            "missing a 'key'" in message
            for message in errors
        )


class TestRepeatItemFieldTypeNormalization:
    def test_a_text_item_field_keeps_the_typed_names(self):
        config = normalize_config(
            definition(
                [{"key": "abuts", "type": "number", "default": 2}],
                [NAMED_ABUTMENTS_GROUP],
            ),
            {
                "abuts": 2,
                "abutName": ["North abutment", "South abutment"],
                "abutH": [6, 7],
            },
        )

        assert config["abutName"] == [
            "North abutment",
            "South abutment",
        ]
        assert config["abutH"] == [6.0, 7.0]

    def test_a_text_item_field_pads_missing_names_with_an_empty_string(
        self,
    ):
        config = normalize_config(
            definition(
                [{"key": "abuts", "type": "number", "default": 3}],
                [NAMED_ABUTMENTS_GROUP],
            ),
            {"abuts": 3, "abutName": ["Only one"]},
        )

        assert config["abutName"] == [
            "Only one",
            "",
            "",
        ]

    def test_a_text_item_field_coerces_a_non_string_value(self):
        config = normalize_config(
            definition(
                [{"key": "abuts", "type": "number", "default": 1}],
                [NAMED_ABUTMENTS_GROUP],
            ),
            {"abuts": 1, "abutName": [42]},
        )

        assert config["abutName"] == ["42"]

    def test_a_numeric_item_field_still_behaves_exactly_as_before(self):
        """Regression: the shared dispatch must not change existing
        numeric repeat-group behaviour (Major Bridge's abutH/
        abutPiles etc.)."""
        config = normalize_config(
            definition(
                [{"key": "abuts", "type": "number", "default": 2}],
                [NAMED_ABUTMENTS_GROUP],
            ),
            {"abuts": 2, "abutH": ["7.5", "bad-number"]},
        )

        assert config["abutH"] == [7.5, 6.0]


class TestRepeatGroupNamedTitleAndSubtitle:
    def test_the_group_title_stays_positional_but_the_subtitle_carries_the_name(
        self,
    ):
        config = normalize_config(
            definition(
                [{"key": "abuts", "type": "number", "default": 2}],
                [NAMED_ABUTMENTS_GROUP],
            ),
            {
                "abuts": 2,
                "abutName": ["North abutment", ""],
                "abutH": [6, 7],
            },
        )

        groups = render_groups(
            definition(
                [{"key": "abuts", "type": "number", "default": 2}],
                [NAMED_ABUTMENTS_GROUP],
            ),
            config,
        )

        assert groups[0]["title"] == "Abutment A1"
        assert (
            groups[0]["subtitle"]
            == "North abutment · Height 6 m"
        )
        assert groups[1]["title"] == "Abutment A2"
        # An unnamed abutment/pier still renders - just with an empty
        # name segment, a minor cosmetic wrinkle, not a functional one.
        assert (
            groups[1]["subtitle"] == " · Height 7 m"
        )


class TestSumPlaceholder:
    def test_sums_a_numeric_sub_field_across_every_group_list_item(self):
        config = {
            "platforms": [
                {"name": "Platform 1", "noOfPile": 6},
                {"name": "Platform 2", "noOfPile": 4},
            ]
        }

        result = render_description(
            definition(
                [],
                [],
                description_template="{sum:platforms.noOfPile} piles",
            ),
            config,
        )

        assert result == "10 piles"

    def test_sums_to_zero_when_the_list_is_empty(self):
        result = render_description(
            definition(
                [],
                [],
                description_template="{sum:platforms.noOfPile} piles",
            ),
            {"platforms": []},
        )

        assert result == "0 piles"

    def test_sums_to_zero_when_the_field_is_missing_entirely(self):
        result = render_description(
            definition(
                [],
                [],
                description_template="{sum:platforms.noOfPile} piles",
            ),
            {},
        )

        assert result == "0 piles"

    def test_ignores_items_with_a_non_numeric_sub_value(self):
        config = {
            "platforms": [
                {"name": "Platform 1", "noOfPile": 6},
                {"name": "Platform 2", "noOfPile": "n/a"},
            ]
        }

        result = render_description(
            definition(
                [],
                [],
                description_template="{sum:platforms.noOfPile} piles",
            ),
            config,
        )

        assert result == "6 piles"
