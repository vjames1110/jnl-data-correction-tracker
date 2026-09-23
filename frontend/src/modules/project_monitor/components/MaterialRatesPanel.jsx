import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  useCreateMaterialRate,
  useDeleteMaterialRate,
  useMaterialRates,
} from "../../../hooks/useProjectMonitor";
import { apiErrorMessage, todayIso } from "../utils/finance";
import { formatCurrency, formatDate } from "../utils/status";

const KINDS = [
  { value: "CONCRETE", label: "Concrete (per cum)" },
  { value: "TMT", label: "TMT steel (per MT)" },
];

const BLANK = {
  kind: "CONCRETE",
  effective_from: todayIso(),
  rate: "",
};

function AddRateForm({ siteId }) {
  const createRate = useCreateMaterialRate();
  const [form, setForm] = useState(BLANK);

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await createRate.mutateAsync({
        site: siteId,
        kind: form.kind,
        effective_from: form.effective_from,
        rate: form.rate,
      });
      setForm((current) => ({ ...BLANK, kind: current.kind }));
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
        <span>Material</span>
        <select
          value={form.kind}
          onChange={(event) =>
            setField("kind", event.target.value)
          }
        >
          {KINDS.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>Effective from</span>
        <input
          type="date"
          value={form.effective_from}
          onChange={(event) =>
            setField("effective_from", event.target.value)
          }
          required
        />
      </label>
      <label className="form-field">
        <span>Rate (₹)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.rate}
          onChange={(event) =>
            setField("rate", event.target.value)
          }
          required
        />
      </label>
      <div className="pm-inline-row">
        <button
          type="submit"
          className="button button--primary"
          disabled={createRate.isPending}
        >
          <Plus size={16} /> Add rate
        </button>
      </div>
      {createRate.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(createRate.error)}
        </div>
      ) : null}
    </form>
  );
}

/**
 * The w.e.f. rate used to cost concrete and TMT: append a new dated
 * row rather than editing history, same convention as Reconciliation
 * standards. Costing always uses the latest row on or before the day
 * being costed.
 */
export function MaterialRatesPanel({ siteId, canEnter }) {
  const ratesQuery = useMaterialRates(siteId, true);
  const deleteRate = useDeleteMaterialRate();
  const rates = ratesQuery.data ?? [];

  return (
    <div className="pm-stack">
      {canEnter ? <AddRateForm siteId={siteId} /> : null}

      {deleteRate.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(deleteRate.error)}
        </div>
      ) : null}

      {rates.length === 0 ? (
        <p className="pm-timeline-empty">
          No material rates recorded yet - concrete and TMT cost
          will show as 0 until one is added.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Effective from</th>
                <th className="pm-num">Rate</th>
                {canEnter ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.id}>
                  <td>
                    {
                      KINDS.find(
                        (kind) => kind.value === rate.kind,
                      )?.label ?? rate.kind
                    }
                  </td>
                  <td>{formatDate(rate.effective_from)}</td>
                  <td className="pm-num">
                    {formatCurrency(rate.rate)}
                  </td>
                  {canEnter ? (
                    <td>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        aria-label="Delete rate"
                        title="Delete"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete this ${rate.kind.toLowerCase()} rate?`,
                            )
                          ) {
                            deleteRate.mutate(rate.id);
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
