import { Lock, Pencil, Trash2, Unlock } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "../utils/finance";
import {
  formatCurrency,
  formatDate,
  formatQty,
} from "../utils/status";

function dayLabel(iso) {
  return `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;
}

function sum(rows, field) {
  return rows.reduce(
    (total, row) => total + Number(row[field] || 0),
    0,
  );
}

/**
 * The daily quantity grid: one row per contract item, one column per
 * day (today back 30). Only days the server marks editable are inputs
 * - the rest are read-only with a lock (an Admin-unlocked day shows
 * an open lock). Typing a day's TOTAL and pressing Save DPR sends
 * only the changed cells; detailed/Excel entries on that day are kept
 * by the server and the grid figure fills the remainder above them.
 */
export function DprGrid({
  grid,
  canEnter,
  onSave,
  isSaving,
  onEditItem,
  onDeleteItem,
}) {
  const [pending, setPending] = useState({});
  const [saveResult, setSaveResult] = useState(null);
  const [saveError, setSaveError] = useState("");
  const dirtyCount = Object.keys(pending).length;

  const setCell = (itemId, date, value, existing) => {
    const key = `${itemId}|${date}`;
    setPending((current) => {
      const next = { ...current };
      if (Number(value || 0) === Number(existing || 0)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaveError("");
    setSaveResult(null);
    const edits = Object.entries(pending).map(
      ([key, value]) => {
        const [item, date] = key.split("|");
        return { item, date, qty: Number(value || 0) };
      },
    );
    try {
      const result = await onSave(edits);
      setSaveResult(result);
      setPending({});
    } catch (error) {
      setSaveError(apiErrorMessage(error));
    }
  };

  const { items, dates } = grid;
  const visibleItems = items;

  return (
    <div className="pm-dpr">
      <div className="pm-dpr__bar print-hidden">
        <span className="sub">
          Type the day&apos;s total quantity beside Balance and
          press <strong>Save DPR</strong>. Today and the
          previous {grid.edit_window_days} days are editable;
          older days are locked unless an Admin unlocks them.
        </span>
        {canEnter ? (
          <button
            type="button"
            className="button button--primary"
            onClick={handleSave}
            disabled={!dirtyCount || isSaving}
          >
            {isSaving
              ? "Saving..."
              : dirtyCount
                ? `Save DPR (${dirtyCount})`
                : "Save DPR"}
          </button>
        ) : null}
      </div>

      {saveError ? (
        <div className="inline-alert inline-alert--error">
          {saveError}
        </div>
      ) : null}
      {saveResult ? (
        <div className="inline-alert">
          Saved {saveResult.saved} cell(s).
          {saveResult.skipped_locked.length
            ? ` ${saveResult.skipped_locked.length} skipped - day locked.`
            : ""}
          {saveResult.below_detailed.length
            ? ` ${saveResult.below_detailed.length} left unchanged - lower than the detailed entries already recorded for that day.`
            : ""}
        </div>
      ) : null}

      {visibleItems.length === 0 ? (
        <p className="pm-timeline-empty">
          No contract items yet. Add one, or import your item
          list from Excel.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-dpr-grid">
            <thead>
              <tr>
                <th className="pm-dpr-grid__sticky pm-dpr-grid__sticky--1">
                  Item
                </th>
                <th className="pm-dpr-grid__sticky pm-dpr-grid__sticky--2">
                  Description
                </th>
                <th>Unit</th>
                <th>Scope</th>
                <th>Rate</th>
                <th>Amount</th>
                <th>% of contract</th>
                <th>Executed</th>
                <th>Executed ₹</th>
                <th>Billed</th>
                <th>Balance</th>
                {dates.map((day) => (
                  <th
                    key={day.date}
                    className={
                      day.editable
                        ? "pm-dpr-grid__day"
                        : "pm-dpr-grid__day pm-dpr-grid__day--locked"
                    }
                    title={
                      day.editable
                        ? formatDate(day.date)
                        : day.unlocked_by_admin
                          ? `${formatDate(day.date)} - unlocked by an Admin`
                          : `${formatDate(day.date)} - locked`
                    }
                  >
                    {dayLabel(day.date)}
                    {day.unlocked_by_admin ? (
                      <Unlock size={10} />
                    ) : !day.editable ? (
                      <Lock size={10} />
                    ) : null}
                  </th>
                ))}
                <th>Conc (cum/unit)</th>
                <th>TMT (kg/unit)</th>
                {canEnter ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr
                  key={item.id}
                  className={
                    !item.is_active
                      ? "pm-dpr-grid__row--inactive"
                      : !item.is_major
                        ? "pm-dpr-grid__row--minor"
                        : ""
                  }
                >
                  <td className="pm-dpr-grid__sticky pm-dpr-grid__sticky--1">
                    {item.item_no || "-"}
                  </td>
                  <td className="pm-dpr-grid__sticky pm-dpr-grid__sticky--2 pm-dpr-grid__desc">
                    {item.description}
                  </td>
                  <td>{item.unit || "-"}</td>
                  <td>{formatQty(item.scope_qty)}</td>
                  <td>{formatCurrency(item.rate)}</td>
                  <td>{formatCurrency(item.amount)}</td>
                  <td
                    className={
                      item.is_major
                        ? "pm-dpr-grid__major"
                        : ""
                    }
                  >
                    {item.percent_of_contract === null
                      ? "-"
                      : `${item.percent_of_contract}%`}
                  </td>
                  <td>{formatQty(item.executed_qty)}</td>
                  <td>
                    {formatCurrency(item.executed_value)}
                  </td>
                  <td>{formatQty(item.billed_qty)}</td>
                  <td>{formatQty(item.balance_qty)}</td>
                  {dates.map((day) => {
                    const key = `${item.id}|${day.date}`;
                    const existing = item.days[day.date];
                    const editable =
                      canEnter &&
                      day.editable &&
                      item.is_active;
                    return (
                      <td
                        key={day.date}
                        className={
                          day.editable
                            ? "pm-dpr-grid__cell"
                            : "pm-dpr-grid__cell pm-dpr-grid__cell--locked"
                        }
                      >
                        {editable ? (
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            aria-label={`${item.description} on ${formatDate(day.date)}`}
                            value={
                              key in pending
                                ? pending[key]
                                : existing === undefined
                                  ? ""
                                  : formatQty(existing)
                            }
                            onChange={(event) =>
                              setCell(
                                item.id,
                                day.date,
                                event.target.value,
                                existing,
                              )
                            }
                          />
                        ) : existing === undefined ? (
                          "-"
                        ) : (
                          formatQty(existing)
                        )}
                      </td>
                    );
                  })}
                  <td>{formatQty(item.concrete_per_unit)}</td>
                  <td>{formatQty(item.tmt_kg_per_unit)}</td>
                  {canEnter ? (
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onEditItem(item)}
                          aria-label="Edit item"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button--danger"
                          onClick={() => onDeleteItem(item)}
                          aria-label="Delete item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="pm-dpr-grid__total">
                <td
                  className="pm-dpr-grid__sticky pm-dpr-grid__sticky--1"
                  colSpan={2}
                >
                  Total
                </td>
                <td colSpan={3} />
                <td>{formatCurrency(sum(items, "amount"))}</td>
                <td />
                <td />
                <td>
                  {formatCurrency(sum(items, "executed_value"))}
                </td>
                <td colSpan={2} />
                {dates.map((day) => (
                  <td key={day.date}>
                    {Number(day.value)
                      ? formatCurrency(day.value)
                      : "-"}
                  </td>
                ))}
                <td colSpan={canEnter ? 3 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
