import { Trash2 } from "lucide-react";
import { useState } from "react";

import {
  useCreateDprEscalation,
  useDeleteDprEscalation,
  useDprEscalations,
} from "../../../hooks/useProjectMonitor";
import { apiErrorMessage } from "../utils/finance";
import { formatDate } from "../utils/status";

const BLANK = { effective_from: "", percent: "", note: "" };

/**
 * The contract's escalation, as dated steps. Each step is the TOTAL
 * escalation over the bid rate from that date (it is not added to the
 * step before it). New DPR entries and bills from that date are priced
 * at bid rate x (1 + total %); work already recorded keeps the rate it
 * was entered at, so adding or removing a step never rewrites history.
 */
export function EscalationPanel({ siteId, canEnter }) {
  const [form, setForm] = useState(BLANK);
  const escalations = useDprEscalations(siteId, true);
  const createEscalation = useCreateDprEscalation();
  const deleteEscalation = useDeleteDprEscalation();
  const rows = escalations.data ?? [];

  const handleAdd = async (event) => {
    event.preventDefault();
    try {
      await createEscalation.mutateAsync({
        site: siteId,
        effective_from: form.effective_from,
        percent: form.percent,
        note: form.note,
      });
      setForm(BLANK);
    } catch {
      // The inline alert below shows the error.
    }
  };

  const handleDelete = (row) => {
    if (
      window.confirm(
        `Delete the escalation from ${formatDate(row.effective_from)}? Entries and bills already recorded keep the rate they were entered at.`,
      )
    ) {
      deleteEscalation.mutate(row.id);
    }
  };

  return (
    <section className="pm-escalation">
      <h3>Escalation</h3>
      <p className="form-help">
        Enter the <strong>total</strong> escalation over the bid
        rate from a date - a later step replaces the one before
        it, it is not added to it. New entries and bills from
        that date are priced at the bid rate plus that
        percentage; work already recorded keeps its rate.
      </p>

      {rows.length === 0 ? (
        <p className="pm-timeline-empty">
          No escalation yet - all work is priced at the bid rate.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table">
            <thead>
              <tr>
                <th>From</th>
                <th>Total escalation</th>
                <th>Note</th>
                {canEnter ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.effective_from)}</td>
                  <td>
                    {Number(row.percent) > 0 ? "+" : ""}
                    {Number(row.percent)}%
                  </td>
                  <td>{row.note || "-"}</td>
                  {canEnter ? (
                    <td>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        aria-label={`Delete escalation from ${formatDate(row.effective_from)}`}
                        onClick={() => handleDelete(row)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEnter ? (
        <form
          className="pm-escalation__form"
          onSubmit={handleAdd}
        >
          <label className="form-field">
            <span>Effective from</span>
            <input
              type="date"
              value={form.effective_from}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  effective_from: event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Total escalation %</span>
            <input
              type="number"
              step="0.001"
              min="-500"
              max="500"
              value={form.percent}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  percent: event.target.value,
                }))
              }
              placeholder="e.g. 4.5"
              required
            />
          </label>
          <label className="form-field">
            <span>Note (optional)</span>
            <input
              type="text"
              maxLength={300}
              value={form.note}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
            />
          </label>
          <button
            type="submit"
            className="button button--primary"
            disabled={createEscalation.isPending}
          >
            Add escalation
          </button>
        </form>
      ) : null}
      {createEscalation.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(createEscalation.error)}
        </div>
      ) : null}
      {deleteEscalation.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(deleteEscalation.error)}
        </div>
      ) : null}
    </section>
  );
}
