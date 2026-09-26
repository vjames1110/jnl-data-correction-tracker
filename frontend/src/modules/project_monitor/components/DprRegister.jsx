import { Trash2 } from "lucide-react";
import { useState } from "react";

import {
  useCreateDprEntry,
  useDeleteDprEntry,
  useDprEntries,
} from "../../../hooks/useProjectMonitor";
import {
  apiErrorMessage,
  todayIso,
} from "../utils/finance";
import {
  formatCurrency,
  formatDate,
  formatQty,
} from "../utils/status";
import { DprMeasurementRegister } from "./DprMeasurementRegister";

const SOURCE_LABELS = {
  MANUAL_GRID: "Grid",
  DETAILED: "Detailed",
  EXCEL: "Excel",
};

function DetailedEntryForm({ siteId, items }) {
  const createEntry = useCreateDprEntry();
  const [form, setForm] = useState({
    date: todayIso(),
    item: "",
    qty: "",
    location: "",
    agency: "",
    remarks: "",
  });

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await createEntry.mutateAsync({
        site: siteId,
        ...form,
      });
      setForm((current) => ({
        ...current,
        qty: "",
        location: "",
        agency: "",
        remarks: "",
      }));
    } catch {
      // Shown by the inline alert.
    }
  };

  return (
    <details className="pm-detailed-entry print-hidden">
      <summary>
        Detailed entry (with location / agency / remarks)
      </summary>
      <form className="form-grid" onSubmit={handleSubmit}>
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
          <span>Item</span>
          <select
            value={form.item}
            onChange={(event) =>
              setField("item", event.target.value)
            }
            required
          >
            <option value="">Select item</option>
            {items
              .filter((item) => item.is_active)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_no ? `${item.item_no} - ` : ""}
                  {item.description}
                </option>
              ))}
          </select>
        </label>
        <label className="form-field">
          <span>Quantity</span>
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.qty}
            onChange={(event) =>
              setField("qty", event.target.value)
            }
            required
          />
        </label>
        <label className="form-field">
          <span>Location / chainage</span>
          <input
            type="text"
            value={form.location}
            onChange={(event) =>
              setField("location", event.target.value)
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
            disabled={createEntry.isPending}
          >
            Add DPR entry
          </button>
        </div>
      </form>
      {createEntry.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(createEntry.error)}
        </div>
      ) : null}
    </details>
  );
}

/**
 * Every DPR entry, newest first, with the value at the rate it was
 * entered at. Deleting is limited by the same day-lock as editing.
 */
export function DprRegister({ siteId, items, canEnter }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [item, setItem] = useState("");
  const params = {
    site: siteId,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(item ? { item } : {}),
  };
  const entriesQuery = useDprEntries(params, true);
  const deleteEntry = useDeleteDprEntry();
  const entries = entriesQuery.data?.entries ?? [];

  return (
    <div>
      {canEnter ? (
        <DetailedEntryForm siteId={siteId} items={items} />
      ) : null}

      <div className="pm-inline-row print-hidden">
        <label className="form-field">
          <span>From</span>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>To</span>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <label
          className="form-field"
          style={{ minWidth: 240 }}
        >
          <span>Item</span>
          <select
            value={item}
            onChange={(event) => setItem(event.target.value)}
          >
            <option value="">All items</option>
            {items.map((entryItem) => (
              <option
                key={entryItem.id}
                value={entryItem.id}
              >
                {entryItem.item_no
                  ? `${entryItem.item_no} - `
                  : ""}
                {entryItem.description}
              </option>
            ))}
          </select>
        </label>
      </div>

      {deleteEntry.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(deleteEntry.error)}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="pm-timeline-empty">
          No DPR entries for this selection.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Value</th>
                <th>Location</th>
                <th>Agency</th>
                <th>Remarks</th>
                <th>Source</th>
                <th>By</th>
                {canEnter ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.date)}</td>
                  <td className="pm-report__col-task">
                    {entry.item_no
                      ? `${entry.item_no} - `
                      : ""}
                    {entry.description}
                  </td>
                  <td>
                    {formatQty(entry.qty)} {entry.unit}
                  </td>
                  <td>{formatCurrency(entry.value)}</td>
                  <td>{entry.location || "-"}</td>
                  <td>{entry.agency || "-"}</td>
                  <td>{entry.remarks || "-"}</td>
                  <td>
                    {SOURCE_LABELS[entry.source] ||
                      entry.source}
                  </td>
                  <td>{entry.entered_by || "-"}</td>
                  {canEnter ? (
                    <td>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        onClick={() =>
                          deleteEntry.mutate(entry.id)
                        }
                        aria-label="Delete DPR entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              <tr className="pm-dpr-grid__total">
                <td colSpan={3}>Total</td>
                <td>
                  {formatCurrency(
                    entriesQuery.data?.total_value,
                  )}
                </td>
                <td colSpan={canEnter ? 6 : 5} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {entriesQuery.data?.truncated ? (
        <p className="pm-timeline-empty">
          Showing the newest 1000 entries - narrow the dates
          to see the rest.
        </p>
      ) : null}
      <DprMeasurementRegister
        params={params}
        items={items}
        entries={entries}
      />
    </div>
  );
}
