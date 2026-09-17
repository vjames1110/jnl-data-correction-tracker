import { useState } from "react";

export function AddLinearItemForm({
  onCreate,
  onCancel,
  isPending,
  error,
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("M");

  const handleSubmit = (event) => {
    event.preventDefault();
    onCreate(
      { name, unit },
      {
        onSuccess: () => {
          setName("");
          setUnit("M");
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="form-field">
          <span>Linear item</span>
          <input
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="e.g. Earthwork (formation)"
            required
          />
        </label>
        <label className="form-field">
          <span>Unit</span>
          <select
            value={unit}
            onChange={(event) =>
              setUnit(event.target.value)
            }
          >
            <option value="M">
              Running metre (m)
            </option>
            <option value="CUM">
              Cubic metre (cum)
            </option>
            <option value="NOS">
              Numbers (nos)
            </option>
          </select>
        </label>
      </div>

      <div className="management-panel__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={isPending}
        >
          Add linear item
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
