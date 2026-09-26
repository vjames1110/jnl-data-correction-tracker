import {
  ChevronDown,
  ChevronRight,
  Columns3,
  Lock,
  Pencil,
  Plus,
  Ruler,
  Trash2,
  Unlock,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { apiErrorMessage } from "../utils/finance";
import { compareWithEntered } from "../utils/measurement";
import {
  formatCurrency,
  formatDate,
  formatQty,
  formatRate,
} from "../utils/status";
import { DprMeasurementSheet } from "./DprMeasurementSheet";

const COLUMNS_KEY = "pm-dpr-grid-columns";

// Extra Railway BOQ columns, tucked behind the "Columns" chooser so
// the (already wide) grid does not grow unless they are wanted.
const OPTIONAL_COLUMNS = [
  { key: "authority", label: "Authority rate" },
  { key: "percent", label: "Tender %" },
  { key: "escalation", label: "Escalation" },
  { key: "today", label: "Rate today" },
];

function dayLabel(iso) {
  return `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;
}

function sum(rows, field) {
  return rows.reduce(
    (total, row) => total + Number(row[field] || 0),
    0,
  );
}

function loadColumns() {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(COLUMNS_KEY) || "[]",
    );
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function percentText(value) {
  return value === null || value === undefined
    ? "-"
    : `${Number(value)}%`;
}

function optionalCell(column, item) {
  if (item.is_heading) {
    return "";
  }
  if (column === "authority") {
    return item.authority_rate === null ||
      item.authority_rate === undefined
      ? "-"
      : formatRate(item.authority_rate);
  }
  if (column === "percent") {
    if (
      item.authority_rate === null ||
      item.authority_rate === undefined
    ) {
      return "-";
    }
    return `${percentText(item.applied_tender_percent)}${
      item.tender_percent === null ||
      item.tender_percent === undefined
        ? ""
        : " *"
    }`;
  }
  if (column === "escalation") {
    return Number(item.escalation_percent)
      ? percentText(item.escalation_percent)
      : "-";
  }
  return formatRate(item.effective_rate);
}

/**
 * The daily quantity grid: one row per contract item, one column per
 * day (today back 30). Items sit in their BOQ groups (a group row adds
 * up the items under it and takes no entries). Only days the server
 * marks editable are inputs - the rest are read-only with a lock (an
 * Admin-unlocked day shows an open lock). Typing a day's TOTAL and
 * pressing Save DPR sends only the changed cells; detailed/Excel
 * entries on that day are kept by the server and the grid figure fills
 * the remainder above them.
 */
export function DprGrid({
  grid,
  siteId,
  canEnter,
  onSave,
  isSaving,
  onEditItem,
  onDeleteItem,
  onAddChild,
}) {
  const [pending, setPending] = useState({});
  const [saveResult, setSaveResult] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [shownColumns, setShownColumns] = useState(loadColumns);
  // The cell (item x day) whose measurement sheet is open below its row.
  const [openSheet, setOpenSheet] = useState(null);
  const dirtyCount = Object.keys(pending).length;

  const { items, dates } = grid;
  const byId = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const groups = items.filter((item) => item.is_heading);
  const leaves = items.filter((item) => !item.is_heading);

  const isHidden = (item) => {
    let node = item;
    let guard = 0;
    while (node?.parent_id && guard < 10) {
      if (collapsed.has(node.parent_id)) {
        return true;
      }
      node = byId.get(node.parent_id);
      guard += 1;
    }
    return false;
  };
  const visibleItems = items.filter((item) => !isHidden(item));
  const extraColumns = OPTIONAL_COLUMNS.filter((column) =>
    shownColumns.includes(column.key),
  );

  const toggleGroup = (itemId) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });

  const toggleColumn = (key) =>
    setShownColumns((current) => {
      const next = current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key];
      try {
        window.localStorage.setItem(
          COLUMNS_KEY,
          JSON.stringify(next),
        );
      } catch {
        // A remembered choice is a convenience only.
      }
      return next;
    });

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

  const enteredFor = (itemId, date) => {
    const key = `${itemId}|${date}`;
    return key in pending
      ? pending[key]
      : (byId.get(itemId)?.days?.[date] ?? "");
  };

  const openSheetFor = (itemId, date) =>
    setOpenSheet((current) =>
      current?.itemId === itemId && current.date === date
        ? current
        : { itemId, date },
    );

  const columnCount =
    11 +
    extraColumns.length +
    dates.length +
    2 +
    (canEnter ? 1 : 0);

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

  return (
    <div className="pm-dpr">
      <div className="pm-dpr__bar print-hidden">
        <span className="sub">
          Type the day&apos;s total quantity beside Balance and
          press <strong>Save DPR</strong>. Today and the
          previous {grid.edit_window_days} days are editable;
          older days are locked unless an Admin unlocks them.
        </span>
        <div className="pm-inline-row">
          {groups.length ? (
            <button
              type="button"
              className="button button--tertiary button--sm"
              onClick={() =>
                setCollapsed(
                  collapsed.size
                    ? new Set()
                    : new Set(groups.map((group) => group.id)),
                )
              }
            >
              {collapsed.size ? "Expand all" : "Collapse all"}
            </button>
          ) : null}
          <details className="pm-dpr-columns">
            <summary>
              <Columns3 size={14} /> Columns
            </summary>
            <div className="pm-dpr-columns__list">
              {OPTIONAL_COLUMNS.map((column) => (
                <label
                  key={column.key}
                  className="toggle-field"
                >
                  <input
                    type="checkbox"
                    checked={shownColumns.includes(column.key)}
                    onChange={() => toggleColumn(column.key)}
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </details>
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

      {items.length === 0 ? (
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
                {extraColumns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
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
              {visibleItems.map((item) => {
                const isGroup = Boolean(item.is_heading);
                const rowClass = isGroup
                  ? "pm-dpr-grid__row--group"
                  : !item.is_active
                    ? "pm-dpr-grid__row--inactive"
                    : !item.is_major
                      ? "pm-dpr-grid__row--minor"
                      : "";
                const sheetDay =
                  openSheet?.itemId === item.id && !isGroup
                    ? dates.find(
                        (day) => day.date === openSheet.date,
                      )
                    : null;
                return (
                  <Fragment key={item.id}>
                  <tr className={rowClass}>
                    <td className="pm-dpr-grid__sticky pm-dpr-grid__sticky--1">
                      {item.item_no || "-"}
                    </td>
                    <td className="pm-dpr-grid__sticky pm-dpr-grid__sticky--2 pm-dpr-grid__desc">
                      <div
                        className="pm-dpr-grid__desc-inner"
                        style={{
                          paddingLeft: `${((item.level ?? 1) - 1) * 14}px`,
                        }}
                      >
                        {isGroup ? (
                          <button
                            type="button"
                            className="pm-dpr-grid__toggle"
                            aria-label={
                              collapsed.has(item.id)
                                ? `Expand ${item.description}`
                                : `Collapse ${item.description}`
                            }
                            aria-expanded={
                              !collapsed.has(item.id)
                            }
                            onClick={() => toggleGroup(item.id)}
                          >
                            {collapsed.has(item.id) ? (
                              <ChevronRight size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </button>
                        ) : (
                          <span className="pm-dpr-grid__toggle-spacer" />
                        )}
                        <span>{item.description}</span>
                      </div>
                    </td>
                    <td>{isGroup ? "" : item.unit || "-"}</td>
                    <td>
                      {isGroup ? "" : formatQty(item.scope_qty)}
                    </td>
                    <td>
                      {isGroup ? "" : formatRate(item.rate)}
                    </td>
                    {extraColumns.map((column) => (
                      <td key={column.key}>
                        {optionalCell(column.key, item)}
                      </td>
                    ))}
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
                    <td>
                      {isGroup ? "" : formatQty(item.executed_qty)}
                    </td>
                    <td>
                      {formatCurrency(item.executed_value)}
                    </td>
                    <td>
                      {isGroup ? "" : formatQty(item.billed_qty)}
                    </td>
                    <td>
                      {isGroup ? "" : formatQty(item.balance_qty)}
                    </td>
                    {dates.map((day) => {
                      const key = `${item.id}|${day.date}`;
                      const existing = item.days?.[day.date];
                      const editable =
                        canEnter &&
                        !isGroup &&
                        day.editable &&
                        item.is_active;
                      const measured = item.measured?.[day.date];
                      const showRuler =
                        Boolean(siteId) &&
                        !isGroup &&
                        (editable || measured !== undefined);
                      const gap =
                        measured === undefined
                          ? "none"
                          : compareWithEntered(
                              measured,
                              enteredFor(item.id, day.date),
                            ).state;
                      return (
                        <td
                          key={day.date}
                          className={
                            day.editable
                              ? "pm-dpr-grid__cell"
                              : "pm-dpr-grid__cell pm-dpr-grid__cell--locked"
                          }
                        >
                          {isGroup ? null : (
                            <div className="pm-dpr-grid__cellwrap">
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
                                  onChange={(event) => {
                                    setCell(
                                      item.id,
                                      day.date,
                                      event.target.value,
                                      existing,
                                    );
                                    if (
                                      siteId &&
                                      event.target.value !== ""
                                    ) {
                                      openSheetFor(
                                        item.id,
                                        day.date,
                                      );
                                    }
                                  }}
                                />
                              ) : existing === undefined ? (
                                "-"
                              ) : (
                                formatQty(existing)
                              )}
                              {showRuler ? (
                                <button
                                  type="button"
                                  className={`pm-dpr-grid__ruler${
                                    measured === undefined
                                      ? ""
                                      : gap === "match"
                                        ? " pm-dpr-grid__ruler--match"
                                        : " pm-dpr-grid__ruler--gap"
                                  }`}
                                  aria-label={`Measurement for ${item.description} on ${formatDate(day.date)}`}
                                  title={
                                    measured === undefined
                                      ? "Add a measurement"
                                      : `Measured ${Number(measured)}`
                                  }
                                  onClick={() =>
                                    setOpenSheet(
                                      openSheet?.itemId ===
                                        item.id &&
                                        openSheet.date ===
                                          day.date
                                        ? null
                                        : {
                                            itemId: item.id,
                                            date: day.date,
                                          },
                                    )
                                  }
                                >
                                  <Ruler size={12} />
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      {isGroup
                        ? ""
                        : formatQty(item.concrete_per_unit)}
                    </td>
                    <td>
                      {isGroup
                        ? ""
                        : formatQty(item.tmt_kg_per_unit)}
                    </td>
                    {canEnter ? (
                      <td>
                        <div className="table-actions">
                          {isGroup && onAddChild ? (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => onAddChild(item)}
                              aria-label={`Add an item under ${item.description}`}
                              title="Add an item under this group"
                            >
                              <Plus size={14} />
                            </button>
                          ) : null}
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
                  {sheetDay ? (
                    <tr className="pm-dpr-grid__measure-row">
                      <td colSpan={columnCount}>
                        <DprMeasurementSheet
                          siteId={siteId}
                          item={item}
                          date={sheetDay.date}
                          entered={enteredFor(
                            item.id,
                            sheetDay.date,
                          )}
                          editable={
                            canEnter &&
                            sheetDay.editable &&
                            item.is_active
                          }
                          onUseTotal={(total) =>
                            setCell(
                              item.id,
                              sheetDay.date,
                              String(total),
                              item.days?.[sheetDay.date],
                            )
                          }
                          onClose={() => setOpenSheet(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="pm-dpr-grid__total">
                <td
                  className="pm-dpr-grid__sticky pm-dpr-grid__sticky--1"
                  colSpan={2}
                >
                  Total
                </td>
                <td colSpan={3 + extraColumns.length} />
                <td>{formatCurrency(sum(leaves, "amount"))}</td>
                <td />
                <td />
                <td>
                  {formatCurrency(sum(leaves, "executed_value"))}
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
