import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

const FIELD_TYPE_OPTIONS = [
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
  { value: "choice", label: "Choice (dropdown)" },
  { value: "text", label: "Text" },
  {
    value: "group_list",
    label: "Repeatable list (e.g. Platforms)",
  },
];

const FIELD_TYPE_LABELS = {
  number: "Number",
  boolean: "Yes / No",
  choice: "Choice",
  text: "Text",
  group_list: "Repeatable list",
};

const GROUP_KIND_LABELS = {
  static: "Static",
  repeat: "Repeat",
  sides: "Sides",
  chain: "Chain",
};

const ITEM_FIELD_TYPE_OPTIONS = [
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
  { value: "choice", label: "Choice (dropdown)" },
  { value: "text", label: "Text" },
];

function defaultForType(type, previousDefault) {
  if (type === "boolean") return false;
  if (type === "text") return "";
  if (type === "group_list") return [];
  if (type === "number") return 0;
  return previousDefault ?? "";
}

const GROUP_KIND_OPTIONS = [
  {
    value: "static",
    label:
      "Static - one fixed group (e.g. Box structure)",
  },
  {
    value: "repeat",
    label:
      "Repeat - one group per count (e.g. per Abutment)",
  },
  {
    value: "sides",
    label:
      "Sides - repeats over LHS / RHS",
  },
  {
    value: "chain",
    label:
      "Chain - a repeating step sequence (e.g. per Span)",
  },
];

const NA_TYPE_OPTIONS = [
  { value: "", label: "No condition" },
  {
    value: "index_gt",
    label:
      "Row number is greater than a field",
  },
  {
    value: "is_false",
    label: "A Yes/No field is No",
  },
  {
    value: "lte_zero",
    label: "A number field is zero or blank",
  },
  {
    value: "equals",
    label: "A field equals a value",
  },
];

function optionsToText(options) {
  return (options || [])
    .map(
      (option) =>
        `${option.value}:${option.label}`,
    )
    .join(", ");
}

function textToOptions(text) {
  return text
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [value, ...rest] = pair.split(
        ":",
      );
      const label = rest
        .join(":")
        .trim();
      const trimmedValue = value.trim();
      const numeric = Number(trimmedValue);
      return {
        value: Number.isNaN(numeric)
          ? trimmedValue
          : numeric,
        label: label || trimmedValue,
      };
    });
}

/**
 * The "value:label, value:label" choice-options text box. Deliberately
 * keeps its OWN local text while typing, committing to real options
 * only on blur/Enter - the previous version fed the input's ``value``
 * straight from ``optionsToText(parsedOptions)``, so every keystroke
 * re-parsed and re-formatted the whole string (a bare "p" typed after
 * a comma, with no ":" yet, round-tripped to "p:p"), snapping the text
 * under the user's cursor and making it impossible to type normally.
 */
function OptionsTextInput({ options, onChange }) {
  const [syncedOptions, setSyncedOptions] =
    useState(options);
  const [text, setText] = useState(() =>
    optionsToText(options),
  );

  // Only re-derive the displayed text when ``options`` changed for a
  // reason OTHER than this input's own edit (switching fields, an
  // external reset) - never mid-typing, since committing only
  // happens on blur/Enter below.
  if (options !== syncedOptions) {
    setSyncedOptions(options);
    setText(optionsToText(options));
  }

  const commit = () => {
    onChange(textToOptions(text));
  };

  return (
    <input
      type="text"
      value={text}
      onChange={(event) =>
        setText(event.target.value)
      }
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
      placeholder="open:Open, pile:Pile"
    />
  );
}

function Field({ label, children }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/**
 * Tracks which items in a list are expanded, by index - used to keep
 * every list in this builder (input fields, activity groups, activity
 * rows) collapsed to a one-line summary by default, since a real
 * structure type (a Major Bridge has ~8 groups, each with several
 * rows) used to open every single field on every row all at once,
 * which is exactly the "difficult to understand" wall of inputs this
 * redesign replaces. Shifts indices on removal so a card below the
 * one just deleted keeps whatever expand state it already had, rather
 * than inheriting the deleted card's.
 */
function useExpandableIndices() {
  const [expanded, setExpanded] = useState(
    () => new Set(),
  );

  const isExpanded = (index) => expanded.has(index);

  const toggle = (index) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });

  const expand = (index) =>
    setExpanded((current) =>
      new Set(current).add(index),
    );

  const onRemove = (removedIndex) =>
    setExpanded((current) => {
      const next = new Set();
      current.forEach((index) => {
        if (index === removedIndex) {
          return;
        }
        next.add(
          index > removedIndex ? index - 1 : index,
        );
      });
      return next;
    });

  // Moving an item swaps its position with a neighbour - its expand
  // state must move with it, not stay behind at the old position.
  const swap = (indexA, indexB) =>
    setExpanded((current) => {
      const hadA = current.has(indexA);
      const hadB = current.has(indexB);
      const next = new Set(current);
      if (hadA) {
        next.add(indexB);
      } else {
        next.delete(indexB);
      }
      if (hadB) {
        next.add(indexA);
      } else {
        next.delete(indexA);
      }
      return next;
    });

  return { isExpanded, toggle, expand, onRemove, swap };
}

function moveItem(list, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= list.length) {
    return list;
  }
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function Badge({ tone, children }) {
  return (
    <span
      className={`pm-builder-badge${tone ? ` pm-builder-badge--${tone}` : ""}`}
    >
      {children}
    </span>
  );
}

/**
 * One collapsible card - a click-to-expand header (chevron, title,
 * summary badges) plus Move up/down and Remove buttons, with the
 * card's real editor only rendered while expanded. Used for every
 * list this builder shows (input fields, activity groups, activity
 * rows), so scanning a structure type with many of them means seeing
 * a short list of titles first, not every field on every row at once
 * - and reordering one is a button press, not a cut-and-retype.
 */
function CollapsibleCard({
  className = "pm-builder-card",
  expanded,
  onToggle,
  title,
  badges,
  onMoveUp,
  onMoveDown,
  onRemove,
  removeLabel,
  children,
}) {
  return (
    <div className={className}>
      <div className="pm-builder-card__header">
        <button
          type="button"
          className="pm-builder-card__toggle"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <ChevronDown
            size={16}
            className="pm-builder-card__chevron"
          />
          <span className="pm-builder-card__title">
            <strong>{title}</strong>
            {badges ? (
              <span className="pm-builder-card__badges">
                {badges}
              </span>
            ) : null}
          </span>
        </button>
        {onMoveUp || onMoveDown ? (
          <span className="pm-builder-card__move">
            <button
              type="button"
              className="icon-button"
              onClick={onMoveUp}
              disabled={!onMoveUp}
              aria-label="Move up"
              title="Move up"
            >
              <ChevronUp size={15} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={onMoveDown}
              disabled={!onMoveDown}
              aria-label="Move down"
              title="Move down"
            >
              <ChevronDown size={15} />
            </button>
          </span>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            className="icon-button icon-button--danger"
            onClick={onRemove}
            aria-label={removeLabel}
          >
            <Trash2 size={15} />
          </button>
        ) : null}
      </div>
      {expanded ? children : null}
    </div>
  );
}

function GroupListItemFieldsEditor({
  fields,
  onChange,
}) {
  const items = fields || [];
  const {
    isExpanded,
    toggle,
    expand,
    onRemove: shiftAfterRemove,
    swap,
  } = useExpandableIndices();

  const updateItem = (index, patch) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
    shiftAfterRemove(index);
  };

  const moveItemAt = (index, direction) => {
    onChange(moveItem(items, index, direction));
    swap(index, index + direction);
  };

  const addItem = () => {
    onChange([
      ...items,
      { key: "", label: "", type: "text", default: "" },
    ]);
    expand(items.length);
  };

  return (
    <div className="pm-builder-nested">
      <div className="pm-builder-card__header">
        <strong>Fields for each item</strong>
      </div>
      {items.map((itemField, index) => (
        <CollapsibleCard
          key={index}
          className="pm-builder-subcard"
          expanded={isExpanded(index)}
          onToggle={() => toggle(index)}
          title={
            itemField.label ||
            itemField.key ||
            `Field ${index + 1}`
          }
          badges={
            <Badge>
              {FIELD_TYPE_LABELS[itemField.type] ||
                itemField.type}
            </Badge>
          }
          onMoveUp={
            index > 0
              ? () => moveItemAt(index, -1)
              : undefined
          }
          onMoveDown={
            index < items.length - 1
              ? () => moveItemAt(index, 1)
              : undefined
          }
          onRemove={() => removeItem(index)}
          removeLabel="Remove item field"
        >
          <div className="form-grid">
          <Field label="Key (unique)">
            <input
              type="text"
              value={itemField.key}
              onChange={(event) =>
                updateItem(index, {
                  key: event.target.value,
                })
              }
              placeholder="e.g. name"
            />
          </Field>
          <Field label="Label">
            <input
              type="text"
              value={itemField.label}
              onChange={(event) =>
                updateItem(index, {
                  label: event.target.value,
                })
              }
              placeholder="e.g. Name of Platform"
            />
          </Field>
          <Field label="Field type">
            <select
              value={itemField.type}
              onChange={(event) => {
                const nextType =
                  event.target.value;
                updateItem(index, {
                  type: nextType,
                  default: defaultForType(
                    nextType,
                    itemField.default,
                  ),
                });
              }}
            >
              {ITEM_FIELD_TYPE_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </Field>
          {itemField.type === "boolean" ? (
            <Field label="Default">
              <select
                value={
                  itemField.default
                    ? "1"
                    : "0"
                }
                onChange={(event) =>
                  updateItem(index, {
                    default:
                      event.target.value ===
                      "1",
                  })
                }
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </Field>
          ) : (
            <Field label="Default">
              <input
                type={
                  itemField.type === "number"
                    ? "number"
                    : "text"
                }
                value={itemField.default ?? ""}
                onChange={(event) =>
                  updateItem(index, {
                    default:
                      itemField.type ===
                      "number"
                        ? Number(
                            event.target
                              .value,
                          )
                        : event.target.value,
                  })
                }
              />
            </Field>
          )}
          {itemField.type === "choice" ? (
            <Field label="Options - comma-separated value:label pairs">
              <OptionsTextInput
                options={itemField.options}
                onChange={(options) =>
                  updateItem(index, { options })
                }
              />
            </Field>
          ) : null}
          </div>
        </CollapsibleCard>
      ))}
      <button
        type="button"
        className="button button--secondary"
        onClick={addItem}
      >
        <Plus size={14} /> Add item field
      </button>
    </div>
  );
}

export function ConfigSchemaBuilder({
  fields,
  onChange,
}) {
  const updateField = (index, patch) => {
    const next = [...fields];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const {
    isExpanded,
    toggle,
    expand,
    onRemove: shiftAfterRemove,
    swap,
  } = useExpandableIndices();

  const removeField = (index) => {
    onChange(
      fields.filter((_, i) => i !== index),
    );
    shiftAfterRemove(index);
  };

  const moveField = (index, direction) => {
    onChange(moveItem(fields, index, direction));
    swap(index, index + direction);
  };

  const addField = () => {
    onChange([
      ...fields,
      {
        key: "",
        label: "",
        type: "number",
        default: 0,
        options: [],
      },
    ]);
    expand(fields.length);
  };

  return (
    <div className="pm-builder">
      {fields.map((field, index) => (
        <CollapsibleCard
          key={index}
          expanded={isExpanded(index)}
          onToggle={() => toggle(index)}
          title={
            field.label ||
            field.key ||
            `Field ${index + 1}`
          }
          badges={
            <Badge>
              {FIELD_TYPE_LABELS[field.type] ||
                field.type}
            </Badge>
          }
          onMoveUp={
            index > 0
              ? () => moveField(index, -1)
              : undefined
          }
          onMoveDown={
            index < fields.length - 1
              ? () => moveField(index, 1)
              : undefined
          }
          onRemove={() => removeField(index)}
          removeLabel="Remove field"
        >
          <div className="form-grid">
            <Field label="Key (used in formulas below, no spaces)">
              <input
                type="text"
                value={field.key}
                onChange={(event) =>
                  updateField(index, {
                    key: event.target.value,
                  })
                }
                placeholder="e.g. spans"
              />
            </Field>
            <Field label="Label shown on the Add-structure form">
              <input
                type="text"
                value={field.label}
                onChange={(event) =>
                  updateField(index, {
                    label:
                      event.target.value,
                  })
                }
                placeholder="e.g. No. of spans"
              />
            </Field>
            <Field label="Field type">
              <select
                value={field.type}
                onChange={(event) => {
                  const nextType =
                    event.target.value;
                  updateField(index, {
                    type: nextType,
                    default: defaultForType(
                      nextType,
                      field.default,
                    ),
                    ...(nextType ===
                    "group_list"
                      ? {
                          fields:
                            field.fields ||
                            [],
                        }
                      : {}),
                  });
                }}
              >
                {FIELD_TYPE_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </Field>
            {field.type === "boolean" ? (
              <Field label="Default">
                <select
                  value={
                    field.default
                      ? "1"
                      : "0"
                  }
                  onChange={(event) =>
                    updateField(index, {
                      default:
                        event.target
                          .value === "1",
                    })
                  }
                >
                  <option value="1">
                    Yes
                  </option>
                  <option value="0">
                    No
                  </option>
                </select>
              </Field>
            ) : field.type ===
              "group_list" ? (
              <Field label="Item label (e.g. Platform)">
                <input
                  type="text"
                  value={
                    field.item_label || ""
                  }
                  onChange={(event) =>
                    updateField(index, {
                      item_label:
                        event.target.value,
                    })
                  }
                  placeholder="e.g. Platform"
                />
              </Field>
            ) : (
              <Field label="Default">
                <input
                  type={
                    field.type === "choice" ||
                    field.type === "text"
                      ? "text"
                      : "number"
                  }
                  value={field.default ?? ""}
                  onChange={(event) =>
                    updateField(index, {
                      default:
                        field.type ===
                        "number"
                          ? Number(
                              event.target
                                .value,
                            )
                          : event.target
                              .value,
                    })
                  }
                />
              </Field>
            )}
            {field.type === "choice" ? (
              <Field label="Options - comma-separated value:label pairs">
                <OptionsTextInput
                  options={field.options}
                  onChange={(options) =>
                    updateField(index, {
                      options,
                    })
                  }
                />
              </Field>
            ) : null}
          </div>
          {field.type === "group_list" ? (
            <GroupListItemFieldsEditor
              fields={field.fields}
              onChange={(nextFields) =>
                updateField(index, {
                  fields: nextFields,
                })
              }
            />
          ) : null}
        </CollapsibleCard>
      ))}
      <button
        type="button"
        className="button button--secondary"
        onClick={addField}
      >
        <Plus size={15} /> Add input field
      </button>
    </div>
  );
}

function RowTemplateEditor({ row, onChange }) {
  const naType = row.na_when?.type || "";
  const showWhen = row.show_when || null;

  const setNaWhen = (patch) => {
    if (patch === null) {
      const next = { ...row };
      delete next.na_when;
      onChange(next);
      return;
    }
    onChange({
      ...row,
      na_when: { ...row.na_when, ...patch },
    });
  };

  const setShowWhen = (patch) => {
    if (patch === null) {
      const next = { ...row };
      delete next.show_when;
      onChange(next);
      return;
    }
    onChange({
      ...row,
      show_when: {
        ...row.show_when,
        ...patch,
      },
    });
  };

  return (
      <div className="form-grid">
        <Field label="Activity name (use {n} for a repeated/chained row)">
          <input
            type="text"
            value={row.name || ""}
            onChange={(event) =>
              onChange({
                ...row,
                name: event.target.value,
              })
            }
            placeholder="e.g. Box raft"
          />
        </Field>
        <Field label="Tracked as">
          <select
            value={row.kind || "TASK"}
            onChange={(event) =>
              onChange({
                ...row,
                kind: event.target.value,
              })
            }
          >
            <option value="TASK">
              % complete
            </option>
            <option value="LENGTH">
              Quantity against a total
            </option>
          </select>
        </Field>
        {row.kind === "LENGTH" ? (
          <>
            <Field label="Unit">
              <input
                type="text"
                value={row.unit || ""}
                onChange={(event) =>
                  onChange({
                    ...row,
                    unit: event.target
                      .value,
                  })
                }
                placeholder="e.g. m, nos, sqm"
              />
            </Field>
            <Field label="Total quantity comes from field">
              <input
                type="text"
                value={row.qty_field || ""}
                onChange={(event) =>
                  onChange({
                    ...row,
                    qty_field:
                      event.target.value,
                  })
                }
                placeholder="e.g. raftLHS or item:piles"
              />
            </Field>
          </>
        ) : null}
        <Field label="Repeat this row N times (optional, e.g. R/W {n})">
          <input
            type="number"
            min="0"
            value={row.repeat || ""}
            onChange={(event) =>
              onChange({
                ...row,
                repeat: event.target.value
                  ? Number(
                      event.target.value,
                    )
                  : undefined,
              })
            }
          />
        </Field>
        <Field label="Mark N/A when">
          <select
            value={naType}
            onChange={(event) =>
              event.target.value
                ? setNaWhen({
                    type: event.target
                      .value,
                  })
                : setNaWhen(null)
            }
          >
            {NA_TYPE_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        {naType ? (
          <Field label="...comparing to field">
            <input
              type="text"
              value={row.na_when?.field || ""}
              onChange={(event) =>
                setNaWhen({
                  field: event.target.value,
                })
              }
              placeholder="e.g. returns"
            />
          </Field>
        ) : null}
        {naType === "equals" ? (
          <Field label="...equal to value">
            <input
              type="text"
              value={row.na_when?.value ?? ""}
              onChange={(event) =>
                setNaWhen({
                  value: event.target.value,
                })
              }
            />
          </Field>
        ) : null}
        <Field label="Only include this row when field (optional)">
          <input
            type="text"
            value={showWhen?.field || ""}
            onChange={(event) =>
              event.target.value
                ? setShowWhen({
                    field:
                      event.target.value,
                  })
                : setShowWhen(null)
            }
            placeholder="e.g. girderScope"
          />
        </Field>
        {showWhen ? (
          <Field label="...equals">
            <input
              type="text"
              value={showWhen.equals ?? ""}
              onChange={(event) =>
                setShowWhen({
                  equals:
                    event.target.value,
                })
              }
              placeholder="e.g. jnl"
            />
          </Field>
        ) : null}
      </div>
  );
}

const NAMING_MODE_OPTIONS = [
  {
    value: "template",
    label: "Same pattern for every item (use {n})",
  },
  {
    value: "by_position",
    label: "Different text for the first / middle / last item",
  },
  {
    value: "floor_ordinal",
    label:
      "Floor ordinal (Ground Floor, First Floor, Second Floor, ...)",
  },
];

function groupHeaderLabel(group) {
  if (group.title) {
    return group.title;
  }
  if (group.title_rule === "floor_ordinal") {
    return "Floor ordinal (Ground Floor, ...)";
  }
  if (group.title_by_position) {
    return (
      group.title_by_position.first ||
      group.title_by_position.middle ||
      group.title_by_position.last ||
      "New group"
    );
  }
  return group.title_template || "New group";
}

function namingModeOf(group) {
  if (group.title_rule === "floor_ordinal") {
    return "floor_ordinal";
  }
  if (group.title_by_position) {
    return "by_position";
  }
  return "template";
}

/**
 * How a "repeat" group's per-item title is worked out - the engine
 * supports three different, mutually-exclusive mechanisms
 * (``title_template`` with {n}, ``title_by_position`` for a named
 * first/middle/last, or the fixed ``title_rule: "floor_ordinal"``),
 * but only one used to have any editor at all: switching kind used to
 * always show a single {n} text box bound to ``title_template``, even
 * when the group actually used one of the other two mechanisms - so
 * the box looked blank and typing into it silently did nothing, since
 * the other mechanism still won at render time. This picks the
 * mechanism explicitly and only shows the fields that mechanism
 * actually uses, clearing the other two so exactly one is ever set.
 * "sides"/"chain" groups only ever support the {n} template, so they
 * keep the plain single box.
 */
function GroupNamingField({ group, onChange }) {
  if (group.kind !== "repeat") {
    return (
      <Field label="Group title (use {n} for repeat/chain, {side} for sides)">
        <input
          type="text"
          value={group.title_template || ""}
          onChange={(event) =>
            onChange({
              ...group,
              title_template: event.target.value,
            })
          }
          placeholder="e.g. Return wall {n}"
        />
      </Field>
    );
  }

  const mode = namingModeOf(group);

  const setMode = (nextMode) => {
    const rest = { ...group };
    delete rest.title_template;
    delete rest.title_by_position;
    delete rest.title_rule;

    if (nextMode === "floor_ordinal") {
      onChange({ ...rest, title_rule: "floor_ordinal" });
    } else if (nextMode === "by_position") {
      onChange({
        ...rest,
        title_by_position: group.title_by_position || {
          first: "",
          middle: "",
          last: "",
        },
      });
    } else {
      onChange({ ...rest, title_template: group.title_template || "" });
    }
  };

  return (
    <>
      <Field label="How are these named?">
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          {NAMING_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      {mode === "template" ? (
        <Field label="Title pattern">
          <input
            type="text"
            value={group.title_template || ""}
            onChange={(event) =>
              onChange({
                ...group,
                title_template: event.target.value,
              })
            }
            placeholder="e.g. Abutment A{n}"
          />
        </Field>
      ) : null}

      {mode === "by_position" ? (
        <>
          <Field label="First item">
            <input
              type="text"
              value={group.title_by_position?.first || ""}
              onChange={(event) =>
                onChange({
                  ...group,
                  title_by_position: {
                    ...group.title_by_position,
                    first: event.target.value,
                  },
                })
              }
              placeholder="e.g. Abutment A1"
            />
          </Field>
          <Field label="Middle items (use {n})">
            <input
              type="text"
              value={group.title_by_position?.middle || ""}
              onChange={(event) =>
                onChange({
                  ...group,
                  title_by_position: {
                    ...group.title_by_position,
                    middle: event.target.value,
                  },
                })
              }
              placeholder="e.g. Pier P{m}"
            />
          </Field>
          <Field label="Last item">
            <input
              type="text"
              value={group.title_by_position?.last || ""}
              onChange={(event) =>
                onChange({
                  ...group,
                  title_by_position: {
                    ...group.title_by_position,
                    last: event.target.value,
                  },
                })
              }
              placeholder="e.g. Abutment A2"
            />
          </Field>
        </>
      ) : null}

      {mode === "floor_ordinal" ? (
        <Field label="Preview">
          <p className="sub">
            Ground Floor, First Floor, Second Floor, ... in order - a
            fixed rule, nothing to type in.
          </p>
        </Field>
      ) : null}
    </>
  );
}

function GroupBadges({ group }) {
  const rowCount = (group.rows || []).length;
  return (
    <>
      <Badge>
        {GROUP_KIND_LABELS[group.kind] || "Static"}
      </Badge>
      <Badge tone="muted">
        {rowCount} {rowCount === 1 ? "row" : "rows"}
      </Badge>
    </>
  );
}

function RowBadges({ row }) {
  return (
    <>
      <Badge tone="muted">
        {row.kind === "LENGTH"
          ? "Quantity"
          : "% complete"}
      </Badge>
      {row.repeat ? (
        <Badge tone="muted">×{row.repeat}</Badge>
      ) : null}
      {row.na_when ? (
        <Badge tone="warning">Conditional N/A</Badge>
      ) : null}
    </>
  );
}

function groupOutlineMeta(group) {
  const kind = group.kind || "static";
  if (kind === "repeat") {
    return `repeats per "${group.count_field || "?"}"`;
  }
  if (kind === "chain") {
    return `chain per "${group.count_field || "?"}"${
      group.count_offset
        ? ` (offset ${group.count_offset})`
        : ""
    }`;
  }
  if (kind === "sides") {
    return "one per side (LHS/RHS)";
  }
  return null;
}

function rowOutlineLabel(row) {
  const name = row.name || "(unnamed row)";
  return row.repeat ? `${name} × ${row.repeat}` : name;
}

/**
 * A scannable table of contents for the whole activity-group schema -
 * every group's title and its row names, in order - so a structure
 * type with several groups (a Major Bridge has around eight) can be
 * sanity-checked at a glance instead of by opening each group's own
 * card. Purely a read-out of the config as typed, not a simulation of
 * the generator (it doesn't know a structure's actual field values),
 * so it shows the naming pattern rather than resolved counts.
 */
export function GroupTemplatesOutline({ groups }) {
  if (!groups.length) {
    return (
      <p className="pm-timeline-empty">
        No activity groups yet - add one to see what this sheet
        will contain.
      </p>
    );
  }
  return (
    <div className="pm-builder-outline">
      <ol className="pm-builder-outline__list">
        {groups.map((group, index) => {
          const meta = groupOutlineMeta(group);
          return (
            <li key={index}>
              <strong>{groupHeaderLabel(group)}</strong>
              {meta ? (
                <span className="sub"> &middot; {meta}</span>
              ) : null}
              {group.rows?.length ? (
                <ul>
                  {group.rows.map((row, rowIndex) => (
                    <li key={rowIndex}>
                      {rowOutlineLabel(row)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pm-timeline-empty">
                  No activity rows yet.
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function GroupTemplateEditor({
  group,
  configSchema,
  onChange,
}) {
  const numericFields = configSchema.filter(
    (field) => field.type === "number",
  );

  const updateRows = (rows) =>
    onChange({ ...group, rows });

  const {
    isExpanded: isRowExpanded,
    toggle: toggleRow,
    expand: expandRow,
    onRemove: shiftRowsAfterRemove,
    swap: swapRows,
  } = useExpandableIndices();

  const addRow = () => {
    expandRow((group.rows || []).length);
    updateRows([
      ...(group.rows || []),
      { name: "", kind: "TASK" },
    ]);
  };

  const moveRow = (index, direction) => {
    updateRows(moveItem(group.rows || [], index, direction));
    swapRows(index, index + direction);
  };

  const addItemField = () =>
    onChange({
      ...group,
      item_fields: [
        ...(group.item_fields || []),
        {
          key: "",
          label_template: "",
          type: "number",
          default: 0,
        },
      ],
    });

  return (
    <>
      <div className="form-grid">
        <Field label="Shape">
          <select
            value={group.kind || "static"}
            onChange={(event) =>
              onChange({
                ...group,
                kind: event.target.value,
              })
            }
          >
            {GROUP_KIND_OPTIONS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ),
            )}
          </select>
        </Field>

        {group.kind === "static" ? (
          <Field label="Group title">
            <input
              type="text"
              value={group.title || ""}
              onChange={(event) =>
                onChange({
                  ...group,
                  title: event.target.value,
                })
              }
              placeholder="e.g. Box structure"
            />
          </Field>
        ) : (
          <GroupNamingField
            group={group}
            onChange={onChange}
          />
        )}

        <Field label="Subtitle template (optional)">
          <input
            type="text"
            value={
              group.subtitle_template ||
              group.subtitle ||
              ""
            }
            onChange={(event) =>
              onChange(
                group.kind === "static"
                  ? {
                      ...group,
                      subtitle:
                        event.target.value,
                    }
                  : {
                      ...group,
                      subtitle_template:
                        event.target.value,
                    },
              )
            }
            placeholder="e.g. {spans} span(s)"
          />
        </Field>

        {group.kind === "repeat" ||
        group.kind === "chain" ? (
          <Field label="Repeat count comes from field">
            <select
              value={group.count_field || ""}
              onChange={(event) =>
                onChange({
                  ...group,
                  count_field:
                    event.target.value,
                })
              }
            >
              <option value="">
                - select a field -
              </option>
              {numericFields.map((field) => (
                <option
                  key={field.key}
                  value={field.key}
                >
                  {field.label || field.key}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {group.kind === "chain" ? (
          <>
            <Field label="Count offset (e.g. -1 for one-fewer-than-count)">
              <input
                type="number"
                value={
                  group.count_offset || 0
                }
                onChange={(event) =>
                  onChange({
                    ...group,
                    count_offset: Number(
                      event.target.value,
                    ),
                  })
                }
              />
            </Field>
            <Field label="One group per step, or one combined group?">
              <select
                value={
                  group.group_per_item
                    ? "1"
                    : "0"
                }
                onChange={(event) =>
                  onChange({
                    ...group,
                    group_per_item:
                      event.target
                        .value === "1",
                  })
                }
              >
                <option value="0">
                  One combined group (rows
                  prefixed S1, S2, ...)
                </option>
                <option value="1">
                  One group per step (e.g.
                  Girder G1, G2, ...)
                </option>
              </select>
            </Field>
            {!group.group_per_item ? (
              <Field label="Row name prefix (use {n})">
                <input
                  type="text"
                  value={
                    group.name_prefix_template ||
                    ""
                  }
                  onChange={(event) =>
                    onChange({
                      ...group,
                      name_prefix_template:
                        event.target.value,
                    })
                  }
                  placeholder="S{n} – "
                />
              </Field>
            ) : null}
          </>
        ) : null}

        {group.kind === "sides" ? (
          <Field label="Layout">
            <select
              value={
                group.separate_groups
                  ? "1"
                  : "0"
              }
              onChange={(event) =>
                onChange({
                  ...group,
                  separate_groups:
                    event.target.value ===
                    "1",
                })
              }
            >
              <option value="0">
                One combined group (LHS
                rows then RHS rows)
              </option>
              <option value="1">
                Two separate groups
                (Approach LHS / Approach
                RHS)
              </option>
            </select>
          </Field>
        ) : null}
      </div>

      {group.kind === "repeat" ? (
        <div className="pm-builder-nested">
          <div className="pm-builder-card__header">
            <strong>
              Per-index inputs (e.g. a
              height/piles number per
              abutment)
            </strong>
          </div>
          {(group.item_fields || []).map(
            (itemField, index) => (
              <div
                key={index}
                className="form-grid"
              >
                <Field label="Key (unique)">
                  <input
                    type="text"
                    value={itemField.key}
                    onChange={(event) => {
                      const next = [
                        ...group.item_fields,
                      ];
                      next[index] = {
                        ...itemField,
                        key: event.target
                          .value,
                      };
                      onChange({
                        ...group,
                        item_fields: next,
                      });
                    }}
                    placeholder="e.g. abutH"
                  />
                </Field>
                <Field label="Label (use {n})">
                  <input
                    type="text"
                    value={
                      itemField.label_template
                    }
                    onChange={(event) => {
                      const next = [
                        ...group.item_fields,
                      ];
                      next[index] = {
                        ...itemField,
                        label_template:
                          event.target.value,
                      };
                      onChange({
                        ...group,
                        item_fields: next,
                      });
                    }}
                    placeholder="A{n} height (m)"
                  />
                </Field>
                <Field label="Field type">
                  <select
                    value={
                      itemField.type || "number"
                    }
                    onChange={(event) => {
                      const nextType =
                        event.target.value;
                      const next = [
                        ...group.item_fields,
                      ];
                      next[index] = {
                        ...itemField,
                        type: nextType,
                        default: defaultForType(
                          nextType,
                          itemField.default,
                        ),
                      };
                      onChange({
                        ...group,
                        item_fields: next,
                      });
                    }}
                  >
                    {ITEM_FIELD_TYPE_OPTIONS.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label="Default">
                  <input
                    type={
                      itemField.type === "text"
                        ? "text"
                        : "number"
                    }
                    value={itemField.default ?? ""}
                    onChange={(event) => {
                      const next = [
                        ...group.item_fields,
                      ];
                      next[index] = {
                        ...itemField,
                        default:
                          itemField.type ===
                          "text"
                            ? event.target.value
                            : Number(
                                event.target
                                  .value,
                              ),
                      };
                      onChange({
                        ...group,
                        item_fields: next,
                      });
                    }}
                  />
                </Field>
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  onClick={() =>
                    onChange({
                      ...group,
                      item_fields:
                        group.item_fields.filter(
                          (_, i) =>
                            i !== index,
                        ),
                    })
                  }
                  aria-label="Remove input"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          )}
          <button
            type="button"
            className="button button--secondary"
            onClick={addItemField}
          >
            <Plus size={14} /> Add per-index
            input
          </button>

          <div className="pm-builder-card__header">
            <strong>
              Leading row (optional, e.g.
              a Pile row only when
              foundation is Pile)
            </strong>
          </div>
          <div className="form-grid">
            <Field label="Only add when field">
              <input
                type="text"
                value={
                  group.leading_row_when
                    ?.field || ""
                }
                onChange={(event) =>
                  onChange({
                    ...group,
                    leading_row_when: event
                      .target.value
                      ? {
                          ...group.leading_row_when,
                          field:
                            event.target
                              .value,
                        }
                      : undefined,
                  })
                }
                placeholder="e.g. abutFound"
              />
            </Field>
            <Field label="...equals">
              <input
                type="text"
                value={
                  group.leading_row_when
                    ?.equals || ""
                }
                onChange={(event) =>
                  onChange({
                    ...group,
                    leading_row_when: {
                      ...group.leading_row_when,
                      equals:
                        event.target.value,
                    },
                  })
                }
                placeholder="pile"
              />
            </Field>
            <Field label="Row name">
              <input
                type="text"
                value={
                  group.leading_row?.name ||
                  ""
                }
                onChange={(event) =>
                  onChange({
                    ...group,
                    leading_row: {
                      ...group.leading_row,
                      name: event.target
                        .value,
                      kind: "LENGTH",
                    },
                  })
                }
                placeholder="Pile"
              />
            </Field>
            <Field label="Unit">
              <input
                type="text"
                value={
                  group.leading_row?.unit ||
                  ""
                }
                onChange={(event) =>
                  onChange({
                    ...group,
                    leading_row: {
                      ...group.leading_row,
                      unit: event.target
                        .value,
                    },
                  })
                }
                placeholder="nos"
              />
            </Field>
            <Field label="Total quantity comes from per-index input">
              <input
                type="text"
                value={
                  group.leading_row
                    ?.qty_field || ""
                }
                onChange={(event) =>
                  onChange({
                    ...group,
                    leading_row: {
                      ...group.leading_row,
                      qty_field:
                        event.target.value,
                    },
                  })
                }
                placeholder="item:abutPiles"
              />
            </Field>
          </div>
        </div>
      ) : null}

      <div className="pm-builder-nested">
        <div className="pm-builder-card__header">
          <strong>Activity rows</strong>
        </div>
        {(group.rows || []).map(
          (row, index) => (
            <CollapsibleCard
              key={index}
              className="pm-builder-subcard"
              expanded={isRowExpanded(index)}
              onToggle={() => toggleRow(index)}
              title={
                row.name || `Row ${index + 1}`
              }
              badges={<RowBadges row={row} />}
              onMoveUp={
                index > 0
                  ? () => moveRow(index, -1)
                  : undefined
              }
              onMoveDown={
                index < group.rows.length - 1
                  ? () => moveRow(index, 1)
                  : undefined
              }
              onRemove={() => {
                updateRows(
                  group.rows.filter(
                    (_, i) => i !== index,
                  ),
                );
                shiftRowsAfterRemove(index);
              }}
              removeLabel="Remove row"
            >
              <RowTemplateEditor
                row={row}
                onChange={(nextRow) => {
                  const rows = [
                    ...group.rows,
                  ];
                  rows[index] = nextRow;
                  updateRows(rows);
                }}
              />
            </CollapsibleCard>
          ),
        )}
        <button
          type="button"
          className="button button--secondary"
          onClick={addRow}
        >
          <Plus size={14} /> Add activity
          row
        </button>
      </div>
    </>
  );
}

export function GroupTemplatesBuilder({
  groups,
  configSchema,
  onChange,
}) {
  const {
    isExpanded,
    toggle,
    expand,
    onRemove: shiftAfterRemove,
    swap,
  } = useExpandableIndices();

  const updateGroup = (index, next) => {
    const nextGroups = [...groups];
    nextGroups[index] = next;
    onChange(nextGroups);
  };

  const addGroup = () => {
    onChange([
      ...groups,
      { kind: "static", title: "", rows: [] },
    ]);
    expand(groups.length);
  };

  const removeGroup = (index) => {
    onChange(
      groups.filter((_, i) => i !== index),
    );
    shiftAfterRemove(index);
  };

  const moveGroup = (index, direction) => {
    onChange(moveItem(groups, index, direction));
    swap(index, index + direction);
  };

  return (
    <div className="pm-builder">
      {groups.map((group, index) => (
        <CollapsibleCard
          key={index}
          expanded={isExpanded(index)}
          onToggle={() => toggle(index)}
          title={groupHeaderLabel(group)}
          badges={<GroupBadges group={group} />}
          onMoveUp={
            index > 0
              ? () => moveGroup(index, -1)
              : undefined
          }
          onMoveDown={
            index < groups.length - 1
              ? () => moveGroup(index, 1)
              : undefined
          }
          onRemove={() => removeGroup(index)}
          removeLabel="Remove group"
        >
          <GroupTemplateEditor
            group={group}
            configSchema={configSchema}
            onChange={(next) =>
              updateGroup(index, next)
            }
          />
        </CollapsibleCard>
      ))}
      <button
        type="button"
        className="button button--secondary"
        onClick={addGroup}
      >
        <Plus size={15} /> Add activity
        group
      </button>
    </div>
  );
}
