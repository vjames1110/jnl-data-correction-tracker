import { useState } from "react";

import { apiErrorMessage } from "../utils/finance";

const BLANK = {
  item_no: "",
  description: "",
  unit: "",
  scope_qty: "",
  rate: "",
  concrete_per_unit: "0",
  tmt_kg_per_unit: "0",
  is_active: true,
};

/**
 * Add / edit one contract (BOQ) item. Editing an item's rate never
 * changes the value of quantities already recorded - each DPR entry
 * and bill line keeps the rate it was entered at.
 */
export function DprItemForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
  error,
}) {
  const [form, setForm] = useState(
    initial
      ? {
          item_no: initial.item_no,
          description: initial.description,
          unit: initial.unit,
          scope_qty: initial.scope_qty,
          rate: initial.rate,
          concrete_per_unit: initial.concrete_per_unit,
          tmt_kg_per_unit: initial.tmt_kg_per_unit,
          is_active: initial.is_active,
        }
      : BLANK,
  );

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      item_no: form.item_no,
      description: form.description,
      unit: form.unit,
      scope_qty: form.scope_qty || "0",
      rate: form.rate || "0",
      concrete_per_unit: form.concrete_per_unit || "0",
      tmt_kg_per_unit: form.tmt_kg_per_unit || "0",
      ...(initial ? { is_active: form.is_active } : {}),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="form-field">
          <span>Item no.</span>
          <input
            type="text"
            value={form.item_no}
            onChange={(event) =>
              setField("item_no", event.target.value)
            }
            placeholder="e.g. 4.2"
          />
        </label>
        <label className="form-field">
          <span>Unit</span>
          <input
            type="text"
            value={form.unit}
            onChange={(event) =>
              setField("unit", event.target.value)
            }
            placeholder="e.g. cum"
          />
        </label>
        <label
          className="form-field"
          style={{ gridColumn: "1 / -1" }}
        >
          <span>Description</span>
          <input
            type="text"
            value={form.description}
            onChange={(event) =>
              setField("description", event.target.value)
            }
            required
          />
        </label>
        <label className="form-field">
          <span>Scope quantity</span>
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.scope_qty}
            onChange={(event) =>
              setField("scope_qty", event.target.value)
            }
          />
        </label>
        <label className="form-field">
          <span>Contract rate (₹)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.rate}
            onChange={(event) =>
              setField("rate", event.target.value)
            }
          />
        </label>
        <label className="form-field">
          <span>Concrete per unit (cum)</span>
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.concrete_per_unit}
            onChange={(event) =>
              setField(
                "concrete_per_unit",
                event.target.value,
              )
            }
          />
        </label>
        <label className="form-field">
          <span>TMT per unit (kg)</span>
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.tmt_kg_per_unit}
            onChange={(event) =>
              setField(
                "tmt_kg_per_unit",
                event.target.value,
              )
            }
          />
        </label>
        {initial ? (
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                setField("is_active", event.target.checked)
              }
            />
            Active (shown in the grid)
          </label>
        ) : null}
      </div>
      <p className="form-help">
        Concrete and TMT per unit are used later by the
        costing section - leave 0 if the item consumes
        neither.
      </p>

      <div className="management-panel__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={isPending}
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
      {error ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(error)}
        </div>
      ) : null}
    </form>
  );
}
