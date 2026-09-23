import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  useConcreteProduction,
  useCreateConcreteProduction,
  useDeleteConcreteProduction,
} from "../../../hooks/useProjectMonitor";
import { apiErrorMessage, todayIso } from "../utils/finance";
import { formatCurrency, formatDate, formatQty } from "../utils/status";

const BLANK = {
  date: "",
  grade: "",
  cum: "",
  cement_cost: "",
  aggregate_cost: "",
  sand_cost: "",
  other_cost: "",
  remarks: "",
};

function AddProductionForm({ siteId }) {
  const createRow = useCreateConcreteProduction();
  const [form, setForm] = useState(() => ({
    ...BLANK,
    date: todayIso(),
  }));

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await createRow.mutateAsync({
        site: siteId,
        date: form.date,
        grade: form.grade,
        cum: form.cum,
        cement_cost: form.cement_cost || 0,
        aggregate_cost: form.aggregate_cost || 0,
        sand_cost: form.sand_cost || 0,
        other_cost: form.other_cost || 0,
        remarks: form.remarks,
      });
      setForm((current) => ({
        ...BLANK,
        date: current.date,
      }));
    } catch {
      // Shown by the inline alert.
    }
  };

  return (
    <form
      className="form-grid pm-hr-form print-hidden"
      onSubmit={handleSubmit}
    >
      <label className="form-field">
        <span>Date</span>
        <input
          type="date"
          value={form.date}
          max={todayIso()}
          onChange={(event) =>
            setField("date", event.target.value)
          }
          required
        />
      </label>
      <label className="form-field">
        <span>Grade</span>
        <input
          type="text"
          value={form.grade}
          placeholder="M25"
          onChange={(event) =>
            setField("grade", event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Cum poured</span>
        <input
          type="number"
          step="0.001"
          min="0"
          value={form.cum}
          onChange={(event) =>
            setField("cum", event.target.value)
          }
          required
        />
      </label>
      <label className="form-field">
        <span>Cement cost (₹)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.cement_cost}
          onChange={(event) =>
            setField("cement_cost", event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Aggregate cost (₹)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.aggregate_cost}
          onChange={(event) =>
            setField("aggregate_cost", event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Sand cost (₹)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.sand_cost}
          onChange={(event) =>
            setField("sand_cost", event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Other cost (₹)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.other_cost}
          onChange={(event) =>
            setField("other_cost", event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Remarks</span>
        <input
          type="text"
          value={form.remarks}
          onChange={(event) =>
            setField("remarks", event.target.value)
          }
        />
      </label>
      <div className="pm-inline-row">
        <button
          type="submit"
          className="button button--primary"
          disabled={createRow.isPending}
        >
          <Plus size={16} /> Record production
        </button>
      </div>
      {createRow.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(createRow.error)}
        </div>
      ) : null}
    </form>
  );
}

/**
 * The stores-recorded actual cost of concrete produced on a day.
 * When a row exists for a day, it REPLACES that day's estimated cost
 * on the cost table - it never adds to it.
 */
export function ConcreteProductionPanel({
  siteId,
  range,
  canEnter,
}) {
  const productionQuery = useConcreteProduction(
    siteId,
    range,
    true,
  );
  const deleteRow = useDeleteConcreteProduction();
  const rows = productionQuery.data ?? [];

  return (
    <div className="pm-stack">
      {canEnter ? (
        <AddProductionForm siteId={siteId} />
      ) : null}

      {deleteRow.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(deleteRow.error)}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="pm-timeline-empty">
          No stores figures recorded in this range - concrete cost
          is estimated from DPR execution at the w.e.f. rate.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Grade</th>
                <th className="pm-num">Cum</th>
                <th className="pm-num">Total cost</th>
                <th>Remarks</th>
                {canEnter ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.date)}</td>
                  <td>{row.grade || "-"}</td>
                  <td className="pm-num">
                    {formatQty(row.cum)}
                  </td>
                  <td className="pm-num">
                    {formatCurrency(row.total_cost)}
                  </td>
                  <td>{row.remarks || "-"}</td>
                  {canEnter ? (
                    <td>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        aria-label="Delete production entry"
                        title="Delete"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete concrete production for ${formatDate(row.date)}?`,
                            )
                          ) {
                            deleteRow.mutate(row.id);
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
