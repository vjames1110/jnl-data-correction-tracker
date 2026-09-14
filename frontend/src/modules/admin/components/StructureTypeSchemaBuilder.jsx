import { Plus, Trash2 } from "lucide-react";

const FIELD_TYPE_OPTIONS = [
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
  { value: "choice", label: "Choice (dropdown)" },
];

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

function Field({ label, children }) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      {children}
    </label>
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

  const removeField = (index) => {
    onChange(
      fields.filter((_, i) => i !== index),
    );
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
  };

  return (
    <div className="pm-builder">
      {fields.map((field, index) => (
        <div
          key={index}
          className="pm-builder-card"
        >
          <div className="pm-builder-card__header">
            <strong>
              Field {index + 1}
            </strong>
            <button
              type="button"
              className="icon-button icon-button--danger"
              onClick={() =>
                removeField(index)
              }
              aria-label="Remove field"
            >
              <Trash2 size={15} />
            </button>
          </div>
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
                onChange={(event) =>
                  updateField(index, {
                    type: event.target
                      .value,
                  })
                }
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
            ) : (
              <Field label="Default">
                <input
                  type={
                    field.type === "choice"
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
                <input
                  type="text"
                  value={optionsToText(
                    field.options,
                  )}
                  onChange={(event) =>
                    updateField(index, {
                      options: textToOptions(
                        event.target.value,
                      ),
                    })
                  }
                  placeholder="open:Open, pile:Pile"
                />
              </Field>
            ) : null}
          </div>
        </div>
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

function RowTemplateEditor({
  row,
  onChange,
  onRemove,
}) {
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
    <div className="pm-builder-subcard">
      <div className="pm-builder-card__header">
        <strong>Activity row</strong>
        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={onRemove}
          aria-label="Remove row"
        >
          <Trash2 size={14} />
        </button>
      </div>
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
    </div>
  );
}

function GroupTemplateEditor({
  group,
  configSchema,
  onChange,
  onRemove,
}) {
  const numericFields = configSchema.filter(
    (field) => field.type !== "boolean",
  );

  const updateRows = (rows) =>
    onChange({ ...group, rows });

  const addRow = () =>
    updateRows([
      ...(group.rows || []),
      { name: "", kind: "TASK" },
    ]);

  const addItemField = () =>
    onChange({
      ...group,
      item_fields: [
        ...(group.item_fields || []),
        { key: "", label_template: "", default: 0 },
      ],
    });

  return (
    <div className="pm-builder-card">
      <div className="pm-builder-card__header">
        <strong>{group.title || group.title_template || "New group"}</strong>
        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={onRemove}
          aria-label="Remove group"
        >
          <Trash2 size={15} />
        </button>
      </div>

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

        <Field
          label={
            group.kind === "static"
              ? "Group title"
              : "Group title (use {n} for repeat/chain, {side} for sides)"
          }
        >
          <input
            type="text"
            value={
              group.kind === "static"
                ? group.title || ""
                : group.title_template || ""
            }
            onChange={(event) =>
              onChange(
                group.kind === "static"
                  ? {
                      ...group,
                      title: event.target
                        .value,
                    }
                  : {
                      ...group,
                      title_template:
                        event.target.value,
                    },
              )
            }
            placeholder={
              group.kind === "static"
                ? "e.g. Box structure"
                : "e.g. Abutment A{n}"
            }
          />
        </Field>

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
                <Field label="Default">
                  <input
                    type="number"
                    value={itemField.default}
                    onChange={(event) => {
                      const next = [
                        ...group.item_fields,
                      ];
                      next[index] = {
                        ...itemField,
                        default: Number(
                          event.target.value,
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
            <RowTemplateEditor
              key={index}
              row={row}
              onChange={(nextRow) => {
                const rows = [
                  ...group.rows,
                ];
                rows[index] = nextRow;
                updateRows(rows);
              }}
              onRemove={() =>
                updateRows(
                  group.rows.filter(
                    (_, i) => i !== index,
                  ),
                )
              }
            />
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
    </div>
  );
}

export function GroupTemplatesBuilder({
  groups,
  configSchema,
  onChange,
}) {
  const updateGroup = (index, next) => {
    const nextGroups = [...groups];
    nextGroups[index] = next;
    onChange(nextGroups);
  };

  const addGroup = () =>
    onChange([
      ...groups,
      { kind: "static", title: "", rows: [] },
    ]);

  return (
    <div className="pm-builder">
      {groups.map((group, index) => (
        <GroupTemplateEditor
          key={index}
          group={group}
          configSchema={configSchema}
          onChange={(next) =>
            updateGroup(index, next)
          }
          onRemove={() =>
            onChange(
              groups.filter(
                (_, i) => i !== index,
              ),
            )
          }
        />
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
