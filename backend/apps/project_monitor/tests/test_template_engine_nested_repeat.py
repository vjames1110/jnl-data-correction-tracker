"""
The ``"nested_repeat"`` group kind - a group of groups, for a
structure made of several named units (ESP A/B/C), each itself built
from several identical numbered sub-units (PC-01/PC-02/PC-03), each
carrying the same task list. Reuses the existing "chain" row-prefixing
mechanism inside an outer loop, so each outer unit renders as one
ordinary activity group whose prefixed row names
("PC-01 – Task"/"PC-02 – Task") the frontend already auto-pivots into
a sub-unit x task table - no new data shape, no frontend changes.
"""

from types import SimpleNamespace

from apps.project_monitor.services.template_engine import (
    alpha_label,
    normalize_config,
    render_groups,
    validate_definition_schema,
)

ESP_GROUP = {
    "kind": "nested_repeat",
    "count_field": "espCount",
    "title_template": "ESP {alpha}",
    "child_count_field": "pcCount",
    "child_label_template": "PC-{nn}",
    "rows": [
        {"name": "Foundation", "kind": "TASK"},
        {"name": "Casting", "kind": "TASK"},
    ],
}

CONFIG_SCHEMA = [
    {"key": "espCount", "type": "number", "default": 3},
    {"key": "pcCount", "type": "number", "default": 2},
]


def definition(group_templates=None):
    return SimpleNamespace(
        config_schema=CONFIG_SCHEMA,
        group_templates=group_templates or [ESP_GROUP],
    )


class TestAlphaLabel:
    def test_single_letters(self):
        assert alpha_label(1) == "A"
        assert alpha_label(2) == "B"
        assert alpha_label(26) == "Z"

    def test_double_letters_after_z(self):
        assert alpha_label(27) == "AA"
        assert alpha_label(28) == "AB"
        assert alpha_label(52) == "AZ"
        assert alpha_label(53) == "BA"


class TestNestedRepeatValidation:
    def test_a_valid_nested_repeat_group_passes(self):
        errors = validate_definition_schema(
            CONFIG_SCHEMA, [ESP_GROUP]
        )

        assert errors == []

    def test_missing_count_field_is_rejected(self):
        group = {**ESP_GROUP}
        del group["count_field"]

        errors = validate_definition_schema(
            CONFIG_SCHEMA, [group]
        )

        assert any(
            "count_field" in message
            for message in errors
        )

    def test_missing_child_count_field_is_rejected(self):
        group = {**ESP_GROUP}
        del group["child_count_field"]

        errors = validate_definition_schema(
            CONFIG_SCHEMA, [group]
        )

        assert any(
            "child_count_field" in message
            for message in errors
        )

    def test_missing_child_label_template_is_rejected(self):
        group = {**ESP_GROUP}
        del group["child_label_template"]

        errors = validate_definition_schema(
            CONFIG_SCHEMA, [group]
        )

        assert any(
            "child_label_template" in message
            for message in errors
        )

    def test_missing_title_template_is_rejected(self):
        group = {**ESP_GROUP}
        del group["title_template"]

        errors = validate_definition_schema(
            CONFIG_SCHEMA, [group]
        )

        assert any(
            "title_template" in message
            for message in errors
        )


class TestNestedRepeatNormalization:
    def test_both_counts_are_clamped(self):
        config = normalize_config(
            definition(),
            {"espCount": 999, "pcCount": -5},
        )

        assert config["espCount"] == 30
        assert config["pcCount"] == 0


class TestNestedRepeatRendering:
    def test_one_group_per_outer_unit_titled_with_alpha(
        self,
    ):
        config = normalize_config(
            definition(),
            {"espCount": 3, "pcCount": 2},
        )

        groups = render_groups(
            definition(), config
        )

        assert [
            group["title"] for group in groups
        ] == ["ESP A", "ESP B", "ESP C"]

    def test_rows_are_prefixed_with_the_zero_padded_child_label(
        self,
    ):
        config = normalize_config(
            definition(),
            {"espCount": 1, "pcCount": 3},
        )

        groups = render_groups(
            definition(), config
        )

        names = [
            row["name"] for row in groups[0]["rows"]
        ]
        assert names == [
            "PC-01 – Foundation",
            "PC-01 – Casting",
            "PC-02 – Foundation",
            "PC-02 – Casting",
            "PC-03 – Foundation",
            "PC-03 – Casting",
        ]

    def test_every_outer_unit_gets_the_same_rows(
        self,
    ):
        config = normalize_config(
            definition(),
            {"espCount": 2, "pcCount": 2},
        )

        groups = render_groups(
            definition(), config
        )

        assert len(groups[0]["rows"]) == len(
            groups[1]["rows"]
        ) == 4

    def test_zero_child_count_means_an_empty_group(
        self,
    ):
        config = normalize_config(
            definition(),
            {"espCount": 2, "pcCount": 0},
        )

        groups = render_groups(
            definition(), config
        )

        assert len(groups) == 2
        assert groups[0]["rows"] == []

    def test_zero_outer_count_means_no_groups(
        self,
    ):
        config = normalize_config(
            definition(),
            {"espCount": 0, "pcCount": 3},
        )

        groups = render_groups(
            definition(), config
        )

        assert groups == []

    def test_plain_n_token_also_works_for_both_levels(
        self,
    ):
        group = {
            **ESP_GROUP,
            "title_template": "Unit {n}",
            "child_label_template": "Item {n}",
        }
        config = normalize_config(
            definition([group]),
            {"espCount": 2, "pcCount": 1},
        )

        groups = render_groups(
            definition([group]), config
        )

        assert groups[0]["title"] == "Unit 1"
        assert (
            groups[0]["rows"][0]["name"]
            == "Item 1 – Foundation"
        )

    def test_na_when_is_evaluated_against_the_child_index(
        self,
    ):
        group = {
            **ESP_GROUP,
            "rows": [
                {
                    "name": "Only first two",
                    "kind": "TASK",
                    "na_when": {
                        "type": "index_gt",
                        "field": "pcCount",
                    },
                },
            ],
        }
        config = normalize_config(
            definition([group]),
            {"espCount": 1, "pcCount": 2},
        )

        groups = render_groups(
            definition([group]), config
        )

        statuses = [
            row["status"] for row in groups[0]["rows"]
        ]
        # na_when's index_gt compares the row's own
        # (child) index against the field's value - here
        # pcCount (2), so neither PC-01 nor PC-02 exceeds
        # it and both stay NOT_STARTED.
        assert statuses == [
            "NOT_STARTED",
            "NOT_STARTED",
        ]
