import { ChevronDown, ChevronRight, Printer } from "lucide-react";
import { useState } from "react";
import { flushSync } from "react-dom";

import { useDprMeasurements } from "../../../hooks/useProjectMonitor";
import { apiErrorMessage } from "../utils/finance";
import {
  compareWithEntered,
  comparisonText,
} from "../utils/measurement";
import { formatDate, formatQty } from "../utils/status";

const CHIP_BY_STATE = {
  match: "status-chip status-chip--success",
  short: "status-chip status-chip--warning",
  over: "status-chip status-chip--warning",
  unentered: "status-chip status-chip--warning",
  none: "status-chip",
};

function dimension(value) {
  return value === null || value === undefined
    ? "-"
    : String(Number(value));
}

/**
 * The measurement sheets behind the DPR quantities in the register's
 * selection (same dates and item), each with how its total compares
 * with the quantity entered that day. Read-only: measurements are
 * edited from the DPR grid.
 */
export function DprMeasurementRegister({
  params,
  items,
  entries,
}) {
  const [open, setOpen] = useState(() => new Set());
  const query = useDprMeasurements(params, true);
  const sheets = query.data ?? [];

  if (query.isError) {
    return (
      <div className="inline-alert inline-alert--error">
        {apiErrorMessage(query.error)}
      </div>
    );
  }
  if (!sheets.length) {
    return null;
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const enteredOn = new Map();
  entries.forEach((entry) => {
    const key = `${entry.item}|${entry.date}`;
    enteredOn.set(
      key,
      (enteredOn.get(key) ?? 0) + Number(entry.qty || 0),
    );
  });

  const keyOf = (sheet) => `${sheet.item}|${sheet.date}`;
  const toggle = (key) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  const handlePrint = () => {
    // Every sheet's lines must be on the page that is printed.
    flushSync(() =>
      setOpen(new Set(sheets.map((sheet) => keyOf(sheet)))),
    );
    window.print();
  };

  return (
    <section className="pm-measure-register">
      <div className="pm-measure-register__head">
        <h3>Measurement sheets</h3>
        <div className="pm-inline-row print-hidden">
          <button
            type="button"
            className="button button--tertiary button--sm"
            onClick={() =>
              setOpen(
                open.size
                  ? new Set()
                  : new Set(sheets.map((sheet) => keyOf(sheet))),
              )
            }
          >
            {open.size ? "Collapse all" : "Expand all"}
          </button>
          <button
            type="button"
            className="button button--tertiary button--sm"
            onClick={handlePrint}
          >
            <Printer size={14} /> Print measurements
          </button>
        </div>
      </div>

      {sheets.map((sheet) => {
        const key = keyOf(sheet);
        const item = itemsById.get(sheet.item);
        const isOpen = open.has(key);
        const entered = enteredOn.get(key);
        const { state } = compareWithEntered(
          sheet.total,
          entered ?? 0,
        );
        return (
          <div className="pm-measure-register__sheet" key={key}>
            <button
              type="button"
              className="pm-measure-register__summary"
              aria-expanded={isOpen}
              onClick={() => toggle(key)}
            >
              {isOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              <span>{formatDate(sheet.date)}</span>
              <strong>
                {item
                  ? `${item.item_no ? `${item.item_no} - ` : ""}${item.description}`
                  : "Item"}
              </strong>
              <span>
                {formatQty(sheet.total)} {item?.unit ?? ""}
              </span>
              {entered === undefined ? null : (
                <span className={CHIP_BY_STATE[state]}>
                  {comparisonText(sheet.total, entered)}
                </span>
              )}
            </button>
            {isOpen ? (
              <div className="pm-table-wrap">
                <table className="pm-report__table">
                  <thead>
                    <tr>
                      <th>Description / location</th>
                      <th>Nos</th>
                      <th>L</th>
                      <th>B</th>
                      <th>D</th>
                      <th>Deduct</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.description || "-"}</td>
                        <td>{dimension(line.nos)}</td>
                        <td>{dimension(line.length)}</td>
                        <td>{dimension(line.breadth)}</td>
                        <td>{dimension(line.depth)}</td>
                        <td>{line.is_deduction ? "Yes" : ""}</td>
                        <td>{formatQty(line.quantity)}</td>
                      </tr>
                    ))}
                    <tr className="pm-dpr-grid__total">
                      <td colSpan={6}>Measured total</td>
                      <td>{formatQty(sheet.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
