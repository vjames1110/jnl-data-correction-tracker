import { CheckCircle2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { SurfaceCard } from "../../../components/common/SurfaceCard";

function AddMiscUsageForm({
  materials,
  submitting,
  onAdd,
}) {
  const [form, setForm] = useState({
    item: "",
    quantity: "",
  });

  const selected = materials.find(
    (item) => item.id === form.item,
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.item || !form.quantity) {
      return;
    }
    const saved = await onAdd({
      item: form.item,
      quantity: form.quantity,
    });
    if (saved) {
      setForm({ item: "", quantity: "" });
    }
  };

  return (
    <form
      className="site-toolbar"
      onSubmit={handleSubmit}
    >
      <label className="filter-control">
        <span>Material</span>
        <select
          value={form.item}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              item: event.target.value,
            }))
          }
          disabled={!materials.length}
          required
        >
          <option value="" disabled hidden>
            {materials.length
              ? "Select material"
              : "All materials already logged"}
          </option>
          {materials.map((item) => (
            <option key={item.id} value={item.id}>
              {item.item_name}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-control">
        <span>
          Consumed Quantity
          {selected?.uom
            ? ` (${selected.uom})`
            : ""}
        </span>
        <input
          type="number"
          step="0.001"
          min="0"
          value={form.quantity}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              quantity: event.target.value,
            }))
          }
          required
        />
      </label>
      <button
        type="submit"
        className="button button--primary"
        disabled={submitting || !materials.length}
      >
        <Plus size={15} />
        Add Usage
      </button>
    </form>
  );
}

function MiscUsageRow({
  row,
  isEditable,
  saving,
  onUpdate,
  onDelete,
}) {
  const [isEditing, setIsEditing] =
    useState(false);
  const [quantity, setQuantity] = useState(
    row.quantity,
  );

  const handleSave = async () => {
    if (!quantity) {
      return;
    }
    const saved = await onUpdate(row, quantity);
    if (saved) {
      setIsEditing(false);
    }
  };

  return (
    <tr>
      <td>
        <strong>{row.item_code}</strong>
        <span className="table-subtext">
          {row.item_name}
        </span>
      </td>
      <td>{row.uom}</td>
      <td>
        {isEditing ? (
          <input
            type="number"
            step="0.001"
            min="0"
            value={quantity}
            onChange={(event) =>
              setQuantity(event.target.value)
            }
            className="entry-row-input"
            aria-label={`Consumed quantity of ${row.item_name}`}
            autoFocus
          />
        ) : (
          <>
            {row.quantity}
            {row.queued ? (
              <span
                className="status-chip status-chip--warning"
                title="Saved on this device, waiting to sync"
                style={{ marginLeft: 8 }}
              >
                Queued
              </span>
            ) : null}
          </>
        )}
      </td>
      {isEditable ? (
        <td>
          {isEditing ? (
            <div className="table-actions">
              <button
                type="button"
                className="button button--tertiary"
                onClick={handleSave}
                disabled={saving}
              >
                <CheckCircle2 size={15} />
                Save
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setQuantity(row.quantity);
                  setIsEditing(false);
                }}
                aria-label="Cancel edit"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="table-actions">
              <button
                type="button"
                className="icon-button"
                onClick={() => setIsEditing(true)}
                aria-label={`Edit ${row.item_name} usage`}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                className="icon-button icon-button--danger"
                onClick={() => onDelete(row)}
                aria-label={`Delete ${row.item_name} usage`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </td>
      ) : null}
    </tr>
  );
}

/**
 * Miscellaneous use of a recipe material - quantity consumed on
 * work other than the production it is reconciled against (e.g.
 * aggregate or cement used for a boundary wall). Only the consumed
 * quantity is entered; the server deducts it from the material's
 * consumption before working out variance, so it is not mistaken for
 * an unexplained loss against the production output.
 *
 * Purely presentational: the page owns the data, the offline queue
 * and the saves (``onAdd``/``onUpdate``/``onDelete`` resolve to
 * whether the change was accepted, so a rejected one keeps the form
 * as typed).
 */
export function MiscUsageCard({
  rows,
  materials,
  isEditable,
  submitting,
  error,
  onAdd,
  onUpdate,
  onDelete,
}) {
  return (
    <SurfaceCard className="print-hidden">
      <div className="surface-card__header">
        <h2>Miscellaneous Use</h2>
      </div>
      <div className="surface-card__body">
        {isEditable ? (
          <AddMiscUsageForm
            materials={materials}
            submitting={submitting}
            onAdd={onAdd}
          />
        ) : null}
        <p className="table-subtext">
          Materials used for work other than
          production this month (for example
          aggregate, sand or cement used on a
          boundary wall). Enter only the consumed
          quantity - it is deducted from the
          material&apos;s consumption, so the
          variance reflects production use only.
        </p>
        {error ? (
          <div className="inline-alert inline-alert--error">
            {error}
          </div>
        ) : null}
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>UOM</th>
                <th>Consumed Quantity</th>
                {isEditable ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <MiscUsageRow
                  key={`${row.id}-${row.quantity}`}
                  row={row}
                  isEditable={isEditable}
                  saving={submitting}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
              {!rows.length ? (
                <tr>
                  <td
                    colSpan={isEditable ? 4 : 3}
                    className="table-empty-state"
                  >
                    No miscellaneous use recorded
                    for this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </SurfaceCard>
  );
}
