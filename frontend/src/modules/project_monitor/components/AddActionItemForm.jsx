import { useState } from "react";

const BLANK_FORM = {
  name: "",
  responsibility: "",
  targetDate: "",
  remarks: "",
};

export function AddActionItemForm({
  onCreate,
  onCancel,
  isPending,
  error,
}) {
  const [form, setForm] = useState(BLANK_FORM);

  const setField = (field, value) =>
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onCreate(
      {
        name: form.name,
        responsibility: form.responsibility,
        remarks: form.remarks,
        target_date: form.targetDate || null,
      },
      {
        onSuccess: () => setForm(BLANK_FORM),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="form-field">
          <span>Action item</span>
          <input
            type="text"
            value={form.name}
            onChange={(event) =>
              setField(
                "name",
                event.target.value,
              )
            }
            placeholder="e.g. Follow up with Railway on land handover"
            required
          />
        </label>
        <label className="form-field">
          <span>Responsibility</span>
          <input
            type="text"
            value={form.responsibility}
            onChange={(event) =>
              setField(
                "responsibility",
                event.target.value,
              )
            }
            placeholder="e.g. Site Engineer - Rahul"
          />
        </label>
        <label className="form-field">
          <span>Target date</span>
          <input
            type="date"
            value={form.targetDate}
            onChange={(event) =>
              setField(
                "targetDate",
                event.target.value,
              )
            }
          />
        </label>
        <label className="form-field pm-drawer-form__full">
          <span>Remarks</span>
          <input
            type="text"
            value={form.remarks}
            onChange={(event) =>
              setField(
                "remarks",
                event.target.value,
              )
            }
            placeholder="Any persistent note about this item"
          />
        </label>
      </div>

      <div className="management-panel__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={isPending}
        >
          Add action item
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
