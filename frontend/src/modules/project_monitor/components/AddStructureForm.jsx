import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  useCreateStructureLocation,
  useDeleteStructureLocation,
} from "../../../hooks/useProjectMonitor";
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

/** Same idea as ``defaultScalarValue`` but for a "repeat" group's
 * per-index ``item_fields`` (number/text only today) - a text item
 * (e.g. an abutment's name) pads with "", never the number fallback. */
function defaultItemFieldValue(itemField) {
  if (itemField.type === "text") {
    return itemField.default ?? "";
  }
  return itemField.default ?? 0;
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
            () => defaultItemFieldValue(itemField),
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
              defaultItemFieldValue(itemField),
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
 * number/boolean/choice/text scalars, just one level deeper.
 *
 * This is deliberately a <div>, not a <form>: it always renders
 * inside the structure's own outer <form>, and a nested <form> is
 * invalid HTML that browsers handle inconsistently - the Save
 * button's click can end up submitting the OUTER form instead
 * (a real navigation/refresh, with the platform never added). */
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

  return (
    <div className="pm-boq-slide__form">
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
          type="button"
          className="button button--primary"
          onClick={() => onSave(values)}
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
    </div>
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

const LOCATION_TYPE_LABEL = {
  CHAINAGE: "Chainage",
  RAMP: "Ramp",
};

/**
 * A structure's own list of named Chainage/Ramp references - only
 * meaningful once the structure exists (each entry is its own API
 * record, not part of ``config``), so this only ever renders while
 * editing, never on the initial "Add a structure" form. Adding the
 * first one takes over the plain top-level "Chainage (km)" field,
 * which the server then keeps in sync automatically (the smallest
 * Chainage-type value here) rather than the two ever disagreeing.
 */
function StructureLocationsManager({ structure }) {
  const siteId = structure.site;
  const createLocation =
    useCreateStructureLocation(siteId);
  const deleteLocation =
    useDeleteStructureLocation(siteId);
  const [isAdding, setIsAdding] = useState(false);
  const [locationType, setLocationType] =
    useState("CHAINAGE");
  const [name, setName] = useState("");
  const [chainageKm, setChainageKm] = useState("");
  const [remarks, setRemarks] = useState("");

  const locations = structure.locations || [];

  const resetForm = () => {
    setLocationType("CHAINAGE");
    setName("");
    setChainageKm("");
    setRemarks("");
    setIsAdding(false);
  };

  const handleAdd = (event) => {
    event.preventDefault();
    createLocation.mutate(
      {
        structureId: structure.id,
        payload: {
          location_type: locationType,
          name,
          chainage_km: chainageKm || null,
          remarks,
        },
      },
      { onSuccess: resetForm },
    );
  };

  return (
    <div
      className="form-field"
      style={{ gridColumn: "1 / -1" }}
    >
      <span>Chainage / Ramp locations</span>

      {locations.length > 0 ? (
        <ul className="pm-group-list">
          {locations.map((location) => (
            <li
              key={location.id}
              className="pm-group-list__item"
            >
              <div className="pm-group-list__row">
                <span>
                  {LOCATION_TYPE_LABEL[
                    location.location_type
                  ] || location.location_type}
                  {location.name
                    ? ` · ${location.name}`
                    : ""}
                  {location.chainage_km != null
                    ? ` · ${location.chainage_km} km`
                    : ""}
                </span>
                <div className="table-actions">
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    aria-label={`Remove ${location.name || LOCATION_TYPE_LABEL[location.location_type] || location.location_type}`}
                    disabled={
                      deleteLocation.isPending
                    }
                    onClick={() =>
                      deleteLocation.mutate(
                        location.id,
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {isAdding ? (
        <SlideDownForm
          eyebrow="Locations"
          title="Add a chainage or ramp"
          onClose={resetForm}
        >
          <form
            className="pm-boq-slide__form"
            onSubmit={handleAdd}
          >
            <div className="pm-boq-slide__row">
              <label className="form-field">
                <span>Type</span>
                <select
                  value={locationType}
                  onChange={(event) =>
                    setLocationType(
                      event.target.value,
                    )
                  }
                >
                  <option value="CHAINAGE">
                    Chainage
                  </option>
                  <option value="RAMP">
                    Ramp
                  </option>
                </select>
              </label>
              <label className="form-field">
                <span>Name (optional)</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. Down line, R2"
                />
              </label>
              <label className="form-field">
                <span>
                  Value (km)
                  {locationType === "RAMP"
                    ? " - optional"
                    : ""}
                </span>
                <input
                  type="number"
                  step="0.001"
                  value={chainageKm}
                  onChange={(event) =>
                    setChainageKm(
                      event.target.value,
                    )
                  }
                />
              </label>
              <label className="form-field">
                <span>Remarks (optional)</span>
                <input
                  type="text"
                  value={remarks}
                  onChange={(event) =>
                    setRemarks(event.target.value)
                  }
                />
              </label>
            </div>
            <div className="pm-slide-panel__actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={createLocation.isPending}
              >
                Save
              </button>
              <button
                type="button"
                className="button button--tertiary"
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
            {createLocation.isError ? (
              <div className="inline-alert inline-alert--error">
                {createLocation.error.message}
              </div>
            ) : null}
          </form>
        </SlideDownForm>
      ) : (
        <button
          type="button"
          className="button button--secondary button--sm"
          onClick={() => setIsAdding(true)}
        >
          <Plus size={14} /> Add chainage/ramp
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
                      type={
                        itemField.type === "text"
                          ? "text"
                          : "number"
                      }
                      style={{
                        width:
                          itemField.type === "text"
                            ? 120
                            : 65,
                      }}
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
  const [
    syncedChainageKm,
    setSyncedChainageKm,
  ] = useState(
    isEditing ? initialStructure.chainage_km : undefined,
  );
  const hasLocations =
    isEditing &&
    (initialStructure.locations || []).length > 0;
  // Once a Chainage/Ramp location exists, the server keeps this
  // field in sync automatically (see StructureLocationsManager) -
  // follow it here too, so the (now disabled) field never shows a
  // stale value left over from before the first location was added.
  if (
    isEditing &&
    initialStructure.chainage_km !== syncedChainageKm
  ) {
    setSyncedChainageKm(initialStructure.chainage_km);
    setChainageKm(
      initialStructure.chainage_km ?? "",
    );
  }
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
          <span>
            Chainage (km)
            {hasLocations
              ? " - managed automatically from the Chainage/Ramp locations below"
              : ""}
          </span>
          <input
            type="number"
            step="0.001"
            value={chainageKm}
            disabled={hasLocations}
            onChange={(event) =>
              setChainageKm(
                event.target.value,
              )
            }
            placeholder="12.345"
          />
        </label>
        {isEditing ? (
          <StructureLocationsManager
            structure={initialStructure}
          />
        ) : (
          <p
            className="pm-timeline-empty"
            style={{ gridColumn: "1 / -1" }}
          >
            Chainage/Ramp locations (named, and
            more than one) can be added once
            this structure is created.
          </p>
        )}
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
