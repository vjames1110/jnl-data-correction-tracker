import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { SlideDownForm } from "./SlideDownForm";

function defaultScalarValue(field) {
  if (field.type === "boolean") {
    return Boolean(field.default);
  }
  if (field.type === "text") {
    return field.default ?? "";
  }
  return field.default;
}

function buildDefaultConfig(definition) {
  const config = {};
  (definition.config_schema || []).forEach(
    (field) => {
      config[field.key] =
        field.type === "group_list"
          ? (field.default ?? [])
          : defaultScalarValue(field);
    },
  );
  (definition.group_templates || []).forEach(
    (group) => {
      if (group.kind !== "repeat") {
        return;
      }
      const count =
        Number(config[group.count_field]) || 0;
      (group.item_fields || []).forEach(
        (itemField) => {
          config[itemField.key] = Array.from(
            { length: count },
            () => itemField.default ?? 0,
          );
        },
      );
    },
  );
  return config;
}

function countFieldKeysFor(definition) {
  return new Set(
    (definition.group_templates || [])
      .filter((group) => group.kind === "repeat")
      .map((group) => group.count_field),
  );
}

function resizeItemFields(
  definition,
  config,
  countFieldKey,
  count,
) {
  const next = { ...config };
  (definition.group_templates || []).forEach(
    (group) => {
      if (
        group.kind !== "repeat" ||
        group.count_field !== countFieldKey
      ) {
        return;
      }
      (group.item_fields || []).forEach(
        (itemField) => {
          const current =
            next[itemField.key] || [];
          next[itemField.key] = Array.from(
            { length: count },
            (_, index) =>
              current[index] ??
              itemField.default ??
              0,
          );
        },
      );
    },
  );
  return next;
}

function ConfigField({ field, value, onChange }) {
  if (field.type === "boolean") {
    return (
      <label className="form-field">
        <span>{field.label}</span>
        <select
          value={value ? "1" : "0"}
          onChange={(event) =>
            onChange(
              event.target.value === "1",
            )
          }
        >
          <option value="1">Yes</option>
          <option value="0">No</option>
        </select>
      </label>
    );
  }

  if (field.type === "choice") {
    return (
      <label className="form-field">
        <span>{field.label}</span>
        <select
          value={String(value ?? "")}
          onChange={(event) => {
            const raw = event.target.value;
            const matched = (
              field.options || []
            ).find(
              (option) =>
                String(option.value) === raw,
            );
            onChange(
              matched ? matched.value : raw,
            );
          }}
        >
          {(field.options || []).map(
            (option) => (
              <option
                key={String(option.value)}
                value={String(option.value)}
              >
                {option.label}
              </option>
            ),
          )}
        </select>
      </label>
    );
  }

  if (field.type === "text") {
    return (
      <label className="form-field">
        <span>{field.label}</span>
        <input
          type="text"
          value={value ?? ""}
          onChange={(event) =>
            onChange(event.target.value)
          }
        />
      </label>
    );
  }

  return (
    <label className="form-field">
      <span>{field.label}</span>
      <input
        type="number"
        step="0.1"
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

function defaultGroupListItem(fields) {
  return Object.fromEntries(
    (fields || []).map((field) => [
      field.key,
      defaultScalarValue(field),
    ]),
  );
}

/** The mini form for one item of a repeatable ("group_list") field -
 * e.g. one platform's Name/Column height/Has Lift/... - reusing
 * ``ConfigField`` for its own sub-fields since they're the same
 * number/boolean/choice/text scalars, just one level deeper. */
function GroupListItemForm({
  fields,
  initial,
  onSave,
  onCancel,
}) {
  const [values, setValues] = useState(
    () => initial || defaultGroupListItem(fields),
  );

  const setValue = (key, value) =>
    setValues((current) => ({
      ...current,
      [key]: value,
    }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(values);
  };

  return (
    <form
      className="pm-boq-slide__form"
      onSubmit={handleSubmit}
    >
      <div className="pm-boq-slide__row">
        {fields.map((field) => (
          <ConfigField
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={(value) =>
              setValue(field.key, value)
            }
          />
        ))}
      </div>
      <div className="pm-slide-panel__actions">
        <button
          type="submit"
          className="button button--primary"
        >
          Save
        </button>
        <button
          type="button"
          className="button button--tertiary"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * A repeatable "group_list" config field (e.g. "Platforms"): the
 * items added so far, an "Add" form that slides down the same way
 * every other Project Monitor form now does, and a click-to-edit on
 * each item already added.
 */
function GroupListField({ field, value, onChange }) {
  const [openIndex, setOpenIndex] = useState(null);
  const items = value || [];
  const itemLabel = field.item_label || field.label;
  const nameKey = field.fields?.[0]?.key;

  const closeForm = () => setOpenIndex(null);

  const handleAdd = (item) => {
    onChange([...items, item]);
    closeForm();
  };

  const handleUpdate = (index, item) => {
    onChange(
      items.map((current, i) =>
        i === index ? item : current,
      ),
    );
    closeForm();
  };

  const handleRemove = (index) => {
    onChange(items.filter((_, i) => i !== index));
    if (openIndex === index) {
      closeForm();
    }
  };

  return (
    <div
      className="form-field"
      style={{ gridColumn: "1 / -1" }}
    >
      <span>{field.label}</span>

      {items.length > 0 ? (
        <ul className="pm-group-list">
          {items.map((item, index) => (
            <li
              key={index}
              className="pm-group-list__item"
            >
              <div className="pm-group-list__row">
                <span>
                  {(nameKey && item[nameKey]) ||
                    `${itemLabel} ${index + 1}`}
                </span>
                <div className="table-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Edit ${itemLabel} ${index + 1}`}
                    onClick={() =>
                      setOpenIndex((current) =>
                        current === index
                          ? null
                          : index,
                      )
                    }
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    aria-label={`Remove ${itemLabel} ${index + 1}`}
                    onClick={() =>
                      handleRemove(index)
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {openIndex === index ? (
                <SlideDownForm
                  eyebrow={field.label}
                  title={`Edit ${itemLabel} ${index + 1}`}
                  onClose={closeForm}
                >
                  <GroupListItemForm
                    fields={field.fields || []}
                    initial={item}
                    onSave={(next) =>
                      handleUpdate(index, next)
                    }
                    onCancel={closeForm}
                  />
                </SlideDownForm>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {openIndex === "new" ? (
        <SlideDownForm
          eyebrow={field.label}
          title={`Add ${itemLabel}`}
          onClose={closeForm}
        >
          <GroupListItemForm
            fields={field.fields || []}
            onSave={handleAdd}
            onCancel={closeForm}
          />
        </SlideDownForm>
      ) : (
        <button
          type="button"
          className="button button--secondary button--sm"
          onClick={() => setOpenIndex("new")}
        >
          <Plus size={14} /> Add {itemLabel}
        </button>
      )}
    </div>
  );
}

function RepeatGroupItemFields({
  group,
  config,
  onArrayValueChange,
}) {
  const count =
    Number(config[group.count_field]) || 0;
  if (!count) {
    return null;
  }

  return (
    <>
      {(group.item_fields || []).map(
        (itemField) => {
          const label = (
            itemField.label_template ||
            itemField.key
          )
            .replace("{n}", "")
            .replace(/\s+/g, " ")
            .trim();
          return (
            <label
              key={itemField.key}
              className="form-field"
              style={{
                gridColumn: "1 / -1",
              }}
            >
              <span>{label}</span>
              <div className="pm-inline-row">
                {Array.from({
                  length: count,
                }).map((_, index) => (
                  <span
                    key={`${itemField.key}-${index}`}
                    className="pm-inline-row"
                  >
                    {index + 1}
                    <input
                      type="number"
                      style={{ width: 65 }}
                      value={
                        (
                          config[
                            itemField.key
                          ] || []
                        )[index] ?? ""
                      }
                      onChange={(event) =>
                        onArrayValueChange(
                          itemField.key,
                          index,
                          event.target
                            .value,
                        )
                      }
                    />
                  </span>
                ))}
              </div>
            </label>
          );
        },
      )}
    </>
  );
}

/**
 * "Add a structure", and - given ``initialStructure`` - "Edit a
 * structure": the exact same parametric form, since editing means
 * re-running the same inputs the sheet was originally generated
 * from. The type is locked once a structure exists (its schema is
 * what the current sheet was built against); to change type, delete
 * the structure and add it again.
 */
export function AddStructureForm({
  structureTypes,
  initialStructure,
  onCreate,
  onSave,
  onCancel,
  isPending,
  error,
}) {
  const isEditing = Boolean(initialStructure);
  const [structureTypeId, setStructureTypeId] =
    useState(
      isEditing
        ? initialStructure.structure_type
        : structureTypes[0]?.id || "",
    );
  const [name, setName] = useState(
    isEditing ? initialStructure.name : "",
  );
  const [chainageKm, setChainageKm] = useState(
    isEditing
      ? (initialStructure.chainage_km ?? "")
      : "",
  );
  const [config, setConfig] = useState(() => {
    if (isEditing) {
      return { ...initialStructure.config };
    }
    return structureTypes[0]
      ? buildDefaultConfig(structureTypes[0])
      : {};
  });

  const definition = structureTypes.find(
    (item) => item.id === structureTypeId,
  );

  if (!definition) {
    return null;
  }

  const countFieldKeys =
    countFieldKeysFor(definition);

  const handleTypeChange = (value) => {
    if (isEditing) {
      return;
    }
    const next = structureTypes.find(
      (item) => item.id === value,
    );
    setStructureTypeId(value);
    setConfig(
      next ? buildDefaultConfig(next) : {},
    );
  };

  const setFieldValue = (field, value) => {
    setConfig((current) => {
      if (
        !countFieldKeys.has(field.key)
      ) {
        return {
          ...current,
          [field.key]: value,
        };
      }
      const count = Math.max(
        0,
        Number(value) || 0,
      );
      return resizeItemFields(
        definition,
        { ...current, [field.key]: value },
        field.key,
        count,
      );
    });
  };

  const setArrayValue = (key, index, value) =>
    setConfig((current) => {
      const arr = [
        ...(current[key] || []),
      ];
      arr[index] = value;
      return { ...current, [key]: arr };
    });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isEditing) {
      onSave({
        name,
        chainage_km: chainageKm || null,
        config,
      });
      return;
    }
    onCreate(
      {
        structure_type: structureTypeId,
        name,
        chainage_km: chainageKm || null,
        config,
      },
      {
        onSuccess: () => {
          setName("");
          setChainageKm("");
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="form-field">
          <span>
            Type
            {isEditing
              ? " (cannot be changed - delete and re-add to change it)"
              : ""}
          </span>
          <select
            value={structureTypeId}
            disabled={isEditing}
            onChange={(event) =>
              handleTypeChange(
                event.target.value,
              )
            }
          >
            {structureTypes.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Structure ID / name</span>
          <input
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="e.g. Br. No. 214"
            required
          />
        </label>
        <label className="form-field">
          <span>Chainage (km)</span>
          <input
            type="number"
            step="0.001"
            value={chainageKm}
            onChange={(event) =>
              setChainageKm(
                event.target.value,
              )
            }
            placeholder="12.345"
          />
        </label>
        {(
          definition.config_schema || []
        ).map((field) =>
          field.type === "group_list" ? (
            <GroupListField
              key={field.key}
              field={field}
              value={config[field.key]}
              onChange={(value) =>
                setFieldValue(field, value)
              }
            />
          ) : (
            <ConfigField
              key={field.key}
              field={field}
              value={config[field.key]}
              onChange={(value) =>
                setFieldValue(field, value)
              }
            />
          ),
        )}
        {(
          definition.group_templates || []
        )
          .filter(
            (group) =>
              group.kind === "repeat",
          )
          .map((group) => (
            <RepeatGroupItemFields
              key={group.count_field}
              group={group}
              config={config}
              onArrayValueChange={
                setArrayValue
              }
            />
          ))}
      </div>

      <div className="pm-slide-panel__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={isPending}
        >
          {isEditing
            ? "Save changes"
            : "Generate sheet"}
        </button>
        <button
          type="button"
          className="button button--tertiary"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
      {error ? (
        <div className="inline-alert inline-alert--error">
          {error.message}
        </div>
      ) : null}
    </form>
  );
}
