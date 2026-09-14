import { useState } from "react";

function buildDefaultConfig(definition) {
  const config = {};
  (definition.config_schema || []).forEach(
    (field) => {
      config[field.key] =
        field.type === "boolean"
          ? Boolean(field.default)
          : field.default;
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
      <label className="filter-control">
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
      <label className="filter-control">
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

  return (
    <label className="filter-control">
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
              className="filter-control"
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

export function AddStructureForm({
  structureTypes,
  onCreate,
  onCancel,
  isPending,
  error,
}) {
  const [structureTypeId, setStructureTypeId] =
    useState(
      structureTypes[0]?.id || "",
    );
  const [name, setName] = useState("");
  const [chainageKm, setChainageKm] =
    useState("");
  const [config, setConfig] = useState(() =>
    structureTypes[0]
      ? buildDefaultConfig(structureTypes[0])
      : {},
  );

  const definition = structureTypes.find(
    (item) => item.id === structureTypeId,
  );

  if (!definition) {
    return null;
  }

  const countFieldKeys =
    countFieldKeysFor(definition);

  const handleTypeChange = (value) => {
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
        <label className="filter-control">
          <span>Type</span>
          <select
            value={structureTypeId}
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
        <label className="filter-control">
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
        <label className="filter-control">
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
        ).map((field) => (
          <ConfigField
            key={field.key}
            field={field}
            value={config[field.key]}
            onChange={(value) =>
              setFieldValue(field, value)
            }
          />
        ))}
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

      <div className="management-panel__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={isPending}
        >
          Generate sheet
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
