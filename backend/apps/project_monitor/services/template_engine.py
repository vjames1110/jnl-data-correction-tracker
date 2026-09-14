"""
The generic engine that turns an admin-authored (or, for Buildings,
Python-authored) ``config_schema`` + ``group_templates`` pair into an
ordered list of activity groups/rows - shared by every Project
Monitor section that generates its activity sheet from a parametric
form (Structures' per-type ``StructureTypeDefinition`` master;
Buildings' one fixed shape in ``building_generator.py``).

``config_schema`` - a list of the parametric input fields the "Add a
structure"/"Add a building" form renders, each::

    {"key": "returns", "label": "Return walls", "type": "choice",
     "default": 4, "options": [{"value": 2, "label": "2"},
                                {"value": 4, "label": "4"}]}

``type`` is one of ``"number"``, ``"boolean"``, ``"choice"``. There is
no separate "count" type - a plain "number" field (e.g. ``spans``,
``abuts``) can be referenced as a ``count_field`` by any group
template below; every count is clamped to ``MAX_COUNT`` at render
time regardless of what the schema configures, so a malformed
definition can't bulk-create an unbounded number of rows.

``group_templates`` - a list of group templates, each with a
``"kind"``:

- ``"static"`` - one fixed group. ``{title, subtitle_template, rows}``.
  A row may set ``"repeat": N`` to generate N copies named with
  ``{n}`` (1-based) - e.g. Minor Bridge's "R/W {n}" x4.
- ``"repeat"`` - one group PER INDEX, count driven by
  ``count_field`` (e.g. Major Bridge's Abutments/Piers; a Building's
  floors). Supports per-index ``item_fields`` (e.g. a height/piles
  number per abutment - the key becomes a top-level config array,
  e.g. ``abutH``/``abutPiles``), an optional ``leading_row`` gated by
  ``leading_row_when`` (e.g. a "Pile" row only when foundation is
  "pile"), and a title via ``title_template`` (``{n}``), the
  positional ``title_by_position`` (``{"first": ..., "last": ...,
  "middle": ...}`` with ``{n}``/``{m}=n-1``, used by ROB's
  Abutment-A1/Pier-P.../Abutment-A2 substructure naming), or
  ``title_rule: "floor_ordinal"`` (index 1 -> "Ground Floor", index 2
  -> "1st Floor", index 3 -> "2nd Floor", ... - used by Buildings).
- ``"sides"`` - repeats over LHS/RHS. ``separate_groups: true``
  produces two groups (ROB's "Approach LHS"/"Approach RHS");
  ``false`` concatenates both sides' rows into ONE group plus an
  optional trailing ``shared_rows`` list (RUB's single "Approach
  roads" group). Row/subtitle templates may contain ``{side}``.
- ``"chain"`` - a repeating "step chain" (Major's per-span
  Bearings/Girder/Deck rows; ROB's per-gap Girder G1/G2/...).
  ``count_field`` (+ optional integer ``count_offset``, e.g. ``-1``
  for ROB's "one girder between each pair of substructures").
  ``group_per_item: true`` makes one group per index (title via
  ``title_template`` with ``{n}``, subtitle may use
  ``{between:count_field}``/``{girder_scope_suffix:field}`` - see
  below); ``false`` (Major) puts every index's rows into ONE group,
  each row's name prefixed via ``name_prefix_template`` (``{n}``).

Row templates (used everywhere above) share one shape::

    {"name": "...", "kind": "TASK"|"LENGTH", "unit": "m",
     "qty_field": "raft{side}" | "item:piles", "is_doc": false,
     "material_tracked": false,
     "na_when": {...}, "show_when": {...}, "variant_field": "...",
     "variants": {"jnl": [...rows...], "rly": [...]}}

- ``na_when`` marks the row Not Applicable: ``{"type": "index_gt",
  "field": "returns"}`` (row's loop index > that config field),
  ``{"type": "is_false", "field": "apron"}``, ``{"type":
  "lte_zero", "field": "raft{side}"}`` (``{side}`` substituted
  first).
- ``show_when``: ``{"field": "girderScope", "equals": "jnl"}`` -
  the row is omitted entirely when false (used for ROB's optional
  "Girder fabrication / casting" step, and a Building's foundation
  Pile row).
- ``variant_field``/``variants``: replaces this ONE row template
  with a *different list* of row templates chosen by that config
  field's value (used for Major/ROB's JNL-vs-Railway girder step
  split, and a Building's Footing-vs-Raft foundation row) - a
  ``"default"`` key in ``variants`` is used when the field's value
  matches no other key.
- ``material_tracked``: layers an independent, separately-logged
  Material status (Not ordered/PO placed/.../Received) on top of the
  row's physical-progress status - used on a Building's MEP-type
  finishing activities (flooring, electrical, etc).

Template strings (``subtitle_template``, ``description_template``)
support ``{field_key}`` (plain config value; a boolean renders as
"yes"/"no"), ``{item:field_key}`` (current repeat-item's value),
``{choice_label:field_key}`` (the human label of a choice field's
current value), ``{foundation:found_field}`` or
``{foundation:found_field:piles_item_field}`` ("N piles" or "Open
foundation" - the piles item field defaults to ``"piles"`` when
omitted, but Major Bridge's Abutment/Pier groups each need their own
name, e.g. ``{foundation:abutFound:abutPiles}``),
``{between:count_field}`` ("A1 and P1" style, from the chain row's
position), and ``{girder_scope_suffix:field_key}`` (empty for
"jnl", " · fabrication by Railway"/"other agency" otherwise).
"""

import re
from decimal import Decimal

from apps.project_monitor.models import (
    ActivityKind,
    ActivityStatus,
    MaterialStatus,
)

MAX_COUNT = 30

_PLACEHOLDER_RE = re.compile(r"\{([^{}]+)\}")

_VALID_FIELD_TYPES = {"number", "boolean", "choice"}
_VALID_GROUP_KINDS = {
    "static",
    "repeat",
    "sides",
    "chain",
}
_VALID_ROW_KINDS = {"TASK", "LENGTH"}
_VALID_NA_TYPES = {
    "index_gt",
    "is_false",
    "lte_zero",
    "equals",
}


def validate_definition_schema(
    config_schema, group_templates
):
    """
    Structural validation for a ``config_schema``/``group_templates``
    pair - catches the mistakes that would otherwise silently render
    an empty or broken "Add a structure" form, with an error message
    that names exactly which field/group/row is wrong. Returns a
    list of human-readable error strings (empty = valid).
    """

    errors = []

    if not isinstance(config_schema, list):
        errors.append(
            "config_schema must be a list of "
            "field definitions."
        )
        config_schema = []

    for index, field in enumerate(config_schema):
        prefix = f"config_schema[{index}]"
        if not isinstance(field, dict):
            errors.append(
                f"{prefix}: must be an object."
            )
            continue
        key = field.get("key")
        if not key or not isinstance(key, str):
            errors.append(
                f"{prefix}: missing a 'key'."
            )
        field_type = field.get(
            "type", "number"
        )
        if field_type not in _VALID_FIELD_TYPES:
            errors.append(
                f"{prefix} ('{key}'): type must "
                "be one of "
                f"{sorted(_VALID_FIELD_TYPES)}."
            )
        if (
            field_type == "choice"
            and not field.get("options")
        ):
            errors.append(
                f"{prefix} ('{key}'): a choice "
                "field needs 'options'."
            )

    if (
        not isinstance(group_templates, list)
        or not group_templates
    ):
        errors.append(
            "group_templates must be a "
            "non-empty list of group "
            "definitions."
        )
        group_templates = []

    def _check_row(row, path):
        if not isinstance(row, dict):
            errors.append(
                f"{path}: must be an object."
            )
            return
        if (
            not row.get("name")
            and "variant_field" not in row
        ):
            errors.append(
                f"{path}: needs a 'name'."
            )
        if (
            row.get("kind", "TASK")
            not in _VALID_ROW_KINDS
        ):
            errors.append(
                f"{path}: kind must be TASK or "
                "LENGTH."
            )
        na_when = row.get("na_when")
        if (
            na_when
            and na_when.get("type")
            not in _VALID_NA_TYPES
        ):
            errors.append(
                f"{path}: na_when.type must be "
                f"one of {sorted(_VALID_NA_TYPES)}."
            )
        if "variant_field" in row and not row.get(
            "variants"
        ):
            errors.append(
                f"{path}: variant_field needs a "
                "'variants' map."
            )

    for group_index, group in enumerate(
        group_templates
    ):
        prefix = f"group_templates[{group_index}]"
        if not isinstance(group, dict):
            errors.append(
                f"{prefix}: must be an object."
            )
            continue
        kind = group.get("kind", "static")
        if kind not in _VALID_GROUP_KINDS:
            errors.append(
                f"{prefix}: kind must be one of "
                f"{sorted(_VALID_GROUP_KINDS)}."
            )
            continue
        if kind in (
            "repeat",
            "chain",
        ) and not group.get("count_field"):
            errors.append(
                f"{prefix} ({kind}): needs a "
                "'count_field'."
            )
        if (
            kind == "repeat"
            and not group.get("title_template")
            and not group.get(
                "title_by_position"
            )
            and not group.get("title_rule")
        ):
            errors.append(
                f"{prefix} (repeat): needs a "
                "'title_template', "
                "'title_by_position' or "
                "'title_rule'."
            )
        if kind == "static" and not group.get(
            "title"
        ):
            errors.append(
                f"{prefix} (static): needs a "
                "'title'."
            )

        rows = group.get("rows", [])
        if not isinstance(rows, list):
            errors.append(
                f"{prefix}: 'rows' must be a "
                "list."
            )
            rows = []
        for row_index, row in enumerate(rows):
            _check_row(
                row,
                f"{prefix}.rows[{row_index}]",
            )
        for row_index, row in enumerate(
            group.get("shared_rows", []) or []
        ):
            _check_row(
                row,
                f"{prefix}.shared_rows[{row_index}]",
            )

    return errors


def _row(
    name,
    *,
    kind=ActivityKind.TASK,
    total=0,
    unit="",
    na=False,
    is_doc=False,
    material_tracked=False,
):
    return {
        "name": name,
        "kind": kind,
        "total_qty": Decimal(str(total or 0)),
        "unit": unit,
        "status": (
            ActivityStatus.NOT_APPLICABLE
            if na
            else ActivityStatus.NOT_STARTED
        ),
        "is_doc": is_doc,
        "material_tracked": material_tracked,
        "material_status": (
            MaterialStatus.NOT_ORDERED
            if material_tracked
            else None
        ),
    }


def doc_rows():
    return [
        _row("GAD approval", is_doc=True),
        _row(
            "Structural drawing approval",
            is_doc=True,
        ),
    ]


def _clamped_count(value):
    try:
        value = int(value)
    except (TypeError, ValueError):
        value = 0
    return max(0, min(MAX_COUNT, value))


def _resize_number_list(values, length, default):
    values = (
        values if isinstance(values, list) else []
    )
    out = []
    for i in range(length):
        try:
            out.append(float(values[i]))
        except (
            IndexError,
            TypeError,
            ValueError,
        ):
            try:
                out.append(float(default))
            except (TypeError, ValueError):
                out.append(0.0)
    return out


def normalize_config(definition, raw):
    """
    Coerce/clamp the raw request payload against
    ``definition.config_schema`` (scalar fields) and every
    ``"repeat"`` group's ``item_fields`` (per-index arrays) - the
    one place a malformed or hostile payload gets neutralized before
    ``render_groups`` ever loops over it.
    """

    raw = raw if isinstance(raw, dict) else {}
    config = {}

    for field in definition.config_schema or []:
        key = field.get("key")
        if not key:
            continue
        field_type = field.get("type", "number")
        default = field.get("default")
        value = raw.get(key, default)

        if field_type == "boolean":
            config[key] = bool(value)
        elif field_type == "choice":
            options = [
                option.get("value")
                for option in field.get(
                    "options", []
                )
            ]
            config[key] = (
                value
                if (not options or value in options)
                else default
            )
        else:
            try:
                config[key] = float(value)
            except (TypeError, ValueError):
                try:
                    config[key] = float(
                        default or 0
                    )
                except (TypeError, ValueError):
                    config[key] = 0.0

    for group in definition.group_templates or []:
        kind = group.get("kind")
        count_field = group.get("count_field")
        if kind not in (
            "repeat",
            "chain",
        ) or not count_field:
            continue

        count = _clamped_count(
            config.get(count_field, 0)
        )
        config[count_field] = count

        if kind != "repeat":
            continue

        for item_field in group.get(
            "item_fields", []
        ):
            key = item_field.get("key")
            if not key:
                continue
            config[key] = _resize_number_list(
                raw.get(key),
                count,
                item_field.get("default", 0),
            )

    return config


def _display_value(value):
    if isinstance(value, bool):
        return "yes" if value else "no"
    if value is None:
        return "?"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _choice_label(definition, field_key, config):
    value = config.get(field_key)
    for field in definition.config_schema or []:
        if field.get("key") == field_key:
            for option in field.get(
                "options", []
            ):
                if option.get("value") == value:
                    return option.get(
                        "label", str(value)
                    )
    return str(value)


def _foundation_label(
    token, config, item
):
    found_field, _, piles_field = token.partition(
        ":"
    )
    piles_field = piles_field or "piles"
    if config.get(found_field) == "pile":
        piles = (
            item.get(piles_field)
            if item
            else config.get(piles_field)
        )
        return (
            f"{_display_value(piles) if piles is not None else '?'}"
            " piles"
        )
    return "Open foundation"


def _position_label(index, total):
    if index == 1:
        return "A1"
    if index == total:
        return "A2"
    return f"P{index - 1}"


def _between_label(field_key, config, index):
    total = _clamped_count(
        config.get(field_key) or 0
    )
    return (
        f"{_position_label(index, total)} and "
        f"{_position_label(index + 1, total)}"
    )


def _girder_scope_suffix(field_key, config):
    value = config.get(field_key)
    if value == "jnl" or not value:
        return ""
    agency = (
        "Railway" if value == "rly" else "other agency"
    )
    return f" · fabrication by {agency}"


def ordinal(number):
    if 10 <= number % 100 <= 20:
        suffix = "th"
    else:
        suffix = {
            1: "st",
            2: "nd",
            3: "rd",
        }.get(number % 10, "th")
    return f"{number}{suffix}"


def floor_label(index):
    """
    A Building's floor-group title: index 1 is always Ground Floor,
    every index after that is the ordinal floor above it (index 2 ->
    "1st Floor", index 3 -> "2nd Floor", ...).
    """

    if index == 1:
        return "Ground Floor"
    return f"{ordinal(index - 1)} Floor"


def _fill_template(
    template,
    config,
    *,
    definition=None,
    item=None,
    index=None,
):
    if not template:
        return ""

    def replace(match):
        token = match.group(1)
        if token == "n":
            return (
                str(index)
                if index is not None
                else ""
            )
        if token.startswith("item:"):
            value = (
                (item or {}).get(token[5:])
            )
            return _display_value(value)
        if token.startswith("choice_label:"):
            return _choice_label(
                definition,
                token[len("choice_label:"):],
                config,
            )
        if token.startswith("foundation:"):
            return _foundation_label(
                token[len("foundation:"):],
                config,
                item,
            )
        if token.startswith("between:"):
            return _between_label(
                token[len("between:"):],
                config,
                index,
            )
        if token.startswith(
            "girder_scope_suffix:"
        ):
            return _girder_scope_suffix(
                token[
                    len(
                        "girder_scope_suffix:"
                    ):
                ],
                config,
            )
        return _display_value(
            config.get(token)
        )

    return _PLACEHOLDER_RE.sub(replace, template)


def _evaluate_na_when(
    condition, config, *, index=None, side=None
):
    if not condition:
        return False

    field = condition.get("field", "")
    if side:
        field = field.replace("{side}", side)
    condition_type = condition.get("type")

    if condition_type == "index_gt":
        return index is not None and index > (
            config.get(field) or 0
        )
    if condition_type == "is_false":
        return not config.get(field)
    if condition_type == "lte_zero":
        return not (
            (config.get(field) or 0) > 0
        )
    if condition_type == "equals":
        return config.get(field) == condition.get(
            "value"
        )
    return False


def _evaluate_show_when(condition, config):
    if not condition:
        return True
    return config.get(
        condition.get("field")
    ) == condition.get("equals")


def _resolve_row_value(
    row_template,
    config,
    *,
    item=None,
    index=None,
    side=None,
):
    name = row_template.get("name", "")
    if index is not None:
        name = name.replace("{n}", str(index))
    if side is not None:
        name = name.replace("{side}", side)

    qty_field = row_template.get("qty_field")
    total = 0
    if qty_field:
        resolved_field = (
            qty_field.replace("{side}", side)
            if side
            else qty_field
        )
        if resolved_field.startswith("item:"):
            total = (item or {}).get(
                resolved_field[5:], 0
            )
        else:
            total = config.get(
                resolved_field, 0
            )

    na = _evaluate_na_when(
        row_template.get("na_when"),
        config,
        index=index,
        side=side,
    )

    return _row(
        name,
        kind=ActivityKind(
            row_template.get("kind", "TASK")
        ),
        total=total,
        unit=row_template.get("unit", ""),
        na=na,
        is_doc=row_template.get(
            "is_doc", False
        ),
        material_tracked=row_template.get(
            "material_tracked", False
        ),
    )


def _resolve_variant_or_conditional(
    row_template,
    config,
    *,
    item=None,
    index=None,
    side=None,
):
    if "variant_field" in row_template:
        value = config.get(
            row_template["variant_field"]
        )
        variants = row_template.get(
            "variants", {}
        )
        alt_templates = variants.get(
            value, variants.get("default", [])
        )
        return [
            _resolve_row_value(
                alt,
                config,
                item=item,
                index=index,
                side=side,
            )
            for alt in alt_templates
        ]

    if not _evaluate_show_when(
        row_template.get("show_when"), config
    ):
        return []

    return [
        _resolve_row_value(
            row_template,
            config,
            item=item,
            index=index,
            side=side,
        )
    ]


def _expand_static_rows(row_templates, config):
    rows = []
    for row_template in row_templates:
        repeat = row_template.get("repeat")
        if repeat:
            for index in range(1, repeat + 1):
                rows.append(
                    _resolve_row_value(
                        row_template,
                        config,
                        index=index,
                    )
                )
        else:
            rows.extend(
                _resolve_variant_or_conditional(
                    row_template, config
                )
            )
    return rows


def _render_static_group(group_template, config):
    return [
        {
            "title": group_template.get(
                "title", ""
            ),
            "subtitle": _fill_template(
                group_template.get(
                    "subtitle_template", ""
                ),
                config,
            ),
            "rows": _expand_static_rows(
                group_template.get("rows", []),
                config,
            ),
        }
    ]


def _render_repeat_group(
    group_template, definition, config
):
    count_field = group_template["count_field"]
    count = _clamped_count(
        config.get(count_field, 0)
    )
    item_fields = group_template.get(
        "item_fields", []
    )
    title_by_position = group_template.get(
        "title_by_position"
    )
    title_rule = group_template.get(
        "title_rule"
    )
    leading_row = group_template.get(
        "leading_row"
    )
    leading_row_when = group_template.get(
        "leading_row_when"
    )

    groups = []
    for index in range(1, count + 1):
        item = {}
        for item_field in item_fields:
            key = item_field.get("key")
            values = config.get(key) or []
            item[key] = (
                values[index - 1]
                if index - 1 < len(values)
                else item_field.get("default")
            )

        rows = []
        if leading_row and _evaluate_show_when(
            leading_row_when, config
        ):
            rows.append(
                _resolve_row_value(
                    leading_row,
                    config,
                    item=item,
                    index=index,
                )
            )
        for row_template in group_template.get(
            "rows", []
        ):
            rows.extend(
                _resolve_variant_or_conditional(
                    row_template,
                    config,
                    item=item,
                    index=index,
                )
            )

        if title_rule == "floor_ordinal":
            title = floor_label(index)
        elif title_by_position:
            if index == 1:
                title = title_by_position.get(
                    "first", ""
                ).replace("{n}", str(index))
            elif index == count:
                title = title_by_position.get(
                    "last", ""
                ).replace("{n}", str(index))
            else:
                title = (
                    title_by_position.get(
                        "middle", ""
                    )
                    .replace(
                        "{m}", str(index - 1)
                    )
                    .replace("{n}", str(index))
                )
        else:
            title = group_template.get(
                "title_template", ""
            ).replace("{n}", str(index))

        subtitle = _fill_template(
            group_template.get(
                "subtitle_template", ""
            ),
            config,
            definition=definition,
            item=item,
            index=index,
        )

        groups.append(
            {
                "title": title,
                "subtitle": subtitle,
                "rows": rows,
            }
        )
    return groups


def _render_sides_group(group_template, config):
    row_templates = group_template.get(
        "rows", []
    )
    shared_row_templates = group_template.get(
        "shared_rows", []
    )
    separate = group_template.get(
        "separate_groups", False
    )

    if separate:
        groups = []
        for side in ("LHS", "RHS"):
            rows = []
            for row_template in row_templates:
                rows.extend(
                    _resolve_variant_or_conditional(
                        row_template,
                        config,
                        side=side,
                    )
                )
            title = group_template.get(
                "title_template",
                "Approach {side}",
            ).replace("{side}", side)
            subtitle_template = (
                group_template.get(
                    "subtitle_template", ""
                ).replace("{side}", side)
            )
            groups.append(
                {
                    "title": title,
                    "subtitle": _fill_template(
                        subtitle_template,
                        config,
                    ),
                    "rows": rows,
                }
            )
        return groups

    rows = []
    for side in ("LHS", "RHS"):
        for row_template in row_templates:
            rows.extend(
                _resolve_variant_or_conditional(
                    row_template,
                    config,
                    side=side,
                )
            )
    for row_template in shared_row_templates:
        rows.extend(
            _resolve_variant_or_conditional(
                row_template, config
            )
        )

    return [
        {
            "title": group_template.get(
                "title", ""
            ),
            "subtitle": group_template.get(
                "subtitle", ""
            ),
            "rows": rows,
        }
    ]


def _render_chain_group(
    group_template, definition, config
):
    count_field = group_template["count_field"]
    offset = group_template.get(
        "count_offset", 0
    )
    count = max(
        0,
        _clamped_count(
            config.get(count_field, 0)
        )
        + offset,
    )
    group_per_item = group_template.get(
        "group_per_item", False
    )

    if group_per_item:
        groups = []
        for index in range(1, count + 1):
            rows = []
            for row_template in group_template.get(
                "rows", []
            ):
                rows.extend(
                    _resolve_variant_or_conditional(
                        row_template,
                        config,
                        index=index,
                    )
                )
            title = group_template.get(
                "title_template", ""
            ).replace("{n}", str(index))
            subtitle = _fill_template(
                group_template.get(
                    "subtitle_template", ""
                ),
                config,
                definition=definition,
                index=index,
            )
            groups.append(
                {
                    "title": title,
                    "subtitle": subtitle,
                    "rows": rows,
                }
            )
        return groups

    name_prefix_template = group_template.get(
        "name_prefix_template", ""
    )
    rows = []
    for index in range(1, count + 1):
        prefix = name_prefix_template.replace(
            "{n}", str(index)
        )
        for row_template in group_template.get(
            "rows", []
        ):
            for row in _resolve_variant_or_conditional(
                row_template,
                config,
                index=index,
            ):
                row["name"] = (
                    f"{prefix}{row['name']}"
                )
                rows.append(row)

    subtitle = _fill_template(
        group_template.get(
            "subtitle_template", ""
        ),
        config,
        definition=definition,
    )
    return [
        {
            "title": group_template.get(
                "title", ""
            ),
            "subtitle": subtitle,
            "rows": rows,
        }
    ]


def render_groups(definition, config):
    groups = []
    for group_template in (
        definition.group_templates or []
    ):
        kind = group_template.get(
            "kind", "static"
        )
        if kind == "static":
            groups.extend(
                _render_static_group(
                    group_template, config
                )
            )
        elif kind == "repeat":
            groups.extend(
                _render_repeat_group(
                    group_template,
                    definition,
                    config,
                )
            )
        elif kind == "sides":
            groups.extend(
                _render_sides_group(
                    group_template, config
                )
            )
        elif kind == "chain":
            groups.extend(
                _render_chain_group(
                    group_template,
                    definition,
                    config,
                )
            )
    return groups


def render_description(definition, config):
    return _fill_template(
        definition.description_template,
        config,
        definition=definition,
    )
