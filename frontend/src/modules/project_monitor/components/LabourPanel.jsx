import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  useCreateLabour,
  useDeleteLabour,
  useLabourEntries,
} from "../../../hooks/useProjectMonitor";
import {
  apiErrorMessage,
  parseNumber,
  todayIso,
} from "../utils/finance";
import {
  formatCurrency,
  formatDate,
  formatQty,
} from "../utils/status";
import { HrUploadControls } from "./HrUploadControls";

const CATEGORY_SUGGESTIONS = [
  "Mason",
  "Helper",
  "Carpenter",
  "Bar bender",
  "Shuttering",
  "Electrician",
  "Plumber",
  "Painter",
  "Welder",
  "Fitter",
  "Driver",
  "Operator",
  "Watchman",
];

const BLANK = {
  date: "",
  category: "",
  nos: "",
  rate: "",
  amount: "",
  agency: "",
  remarks: "",
};

function LabourForm({ siteId }) {
  const createLabour = useCreateLabour();
  const [form, setForm] = useState({
    ...BLANK,
    date: todayIso(),
  });

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const previewAmount =
    form.amount !== ""
      ? Number(form.amount)
      : (parseNumber(form.nos) ?? 0) *
        (parseNumber(form.rate) ?? 0);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await createLabour.mutateAsync({
        site: siteId,
        date: form.date,
        category: form.category,
        nos: parseNumber(form.nos),
        rate: parseNumber(form.rate) ?? 0,
        amount: parseNumber(form.amount),
        agency: form.agency,
        remarks: form.remarks,
      });
      setForm((current) => ({
        ...BLANK,
        date: current.date,
        category: current.category,
        agency: current.agency,
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
        <span>Category</span>
        <input
          type="text"
          list="pm-labour-categories"
          value={form.category}
          onChange={(event) =>
            setField("category", event.target.value)
          }
          required
        />
        <datalist id="pm-labour-categories">
          {CATEGORY_SUGGESTIONS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="form-field">
        <span>Nos on site</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.nos}
          onChange={(event) =>
            setField("nos", event.target.value)
          }
          required
        />
      </label>
      <label className="form-field">
        <span>Daily rate (₹)</span>
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
        <span>Amount (₹) - blank = nos × rate</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.amount}
          onChange={(event) =>
            setField("amount", event.target.value)
          }
          placeholder={
            previewAmount ? String(previewAmount) : ""
          }
        />
      </label>
      <label className="form-field">
        <span>Agency</span>
        <input
          type="text"
          value={form.agency}
          onChange={(event) =>
            setField("agency", event.target.value)
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
          disabled={createLabour.isPending}
        >
          <Plus size={16} /> Add labour
        </button>
      </div>
      {createLabour.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(createLabour.error)}
        </div>
      ) : null}
    </form>
  );
}

/** Daily contract labour: entry form, bulk upload and the register. */
export function LabourPanel({ siteId, month, canEnter }) {
  const labourQuery = useLabourEntries(siteId, month, true);
  const deleteLabour = useDeleteLabour();
  const entries = labourQuery.data ?? [];

  return (
    <div className="pm-stack">
      {canEnter ? (
        <>
          <LabourForm siteId={siteId} />
          <HrUploadControls siteId={siteId} />
        </>
      ) : null}

      {deleteLabour.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(deleteLabour.error)}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="pm-timeline-empty">
          No labour recorded for this month.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table pm-hr-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th className="pm-num">Nos</th>
                <th className="pm-num">Rate</th>
                <th className="pm-num">Amount</th>
                <th>Agency</th>
                <th>Remarks</th>
                {canEnter ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.date)}</td>
                  <td>{entry.category}</td>
                  <td className="pm-num">
                    {formatQty(entry.nos)}
                  </td>
                  <td className="pm-num">
                    {formatCurrency(entry.rate)}
                  </td>
                  <td className="pm-num">
                    {formatCurrency(entry.amount)}
                  </td>
                  <td>{entry.agency || "-"}</td>
                  <td>{entry.remarks || "-"}</td>
                  {canEnter ? (
                    <td>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        aria-label="Delete labour entry"
                        title="Delete"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete ${entry.category} (${formatDate(entry.date)})?`,
                            )
                          ) {
                            deleteLabour.mutate(entry.id);
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
