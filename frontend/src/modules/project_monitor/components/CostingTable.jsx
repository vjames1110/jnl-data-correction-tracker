import clsx from "clsx";
import { useState } from "react";

import { useCostingTable } from "../../../hooks/useProjectMonitor";
import { apiErrorMessage, todayIso } from "../utils/finance";
import {
  formatCurrency,
  formatDate,
  formatPercent,
} from "../utils/status";

function daysAgoIso(count) {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return date.toISOString().slice(0, 10);
}

const COMPLETE_LABELS = {
  dpr: "DPR",
  hr: "HR",
  machinery: "Machinery",
  stores: "Stores",
};

function CompleteDots({ complete }) {
  return (
    <span className="pm-costing-dots">
      {Object.entries(complete).map(([key, present]) => (
        <span
          key={key}
          className={clsx(
            "pm-costing-dot",
            present && "pm-costing-dot--on",
          )}
          title={`${COMPLETE_LABELS[key]}: ${present ? "recorded" : "nothing recorded"}`}
        >
          {COMPLETE_LABELS[key][0]}
        </span>
      ))}
    </span>
  );
}

/**
 * Day-wise expense vs value of work done: default last 30 days, a
 * custom range, and totals for the range. Rows past 90% expense are
 * flagged so a bad day cannot hide in a long table.
 */
export function CostingTable({ siteId }) {
  const [range, setRange] = useState(() => ({
    from: daysAgoIso(29),
    to: todayIso(),
  }));
  const tableQuery = useCostingTable(siteId, range, true);
  const data = tableQuery.data;

  return (
    <div className="pm-stack">
      <div className="page-actions pm-costing-range">
        <label className="filter-control">
          <span>From</span>
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(event) =>
              setRange((current) => ({
                ...current,
                from: event.target.value,
              }))
            }
          />
        </label>
        <label className="filter-control">
          <span>To</span>
          <input
            type="date"
            value={range.to}
            max={todayIso()}
            onChange={(event) =>
              setRange((current) => ({
                ...current,
                to: event.target.value,
              }))
            }
          />
        </label>
      </div>

      {tableQuery.isLoading ? (
        <p className="pm-timeline-empty">Loading...</p>
      ) : tableQuery.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(tableQuery.error)}
        </div>
      ) : !data || data.days.length === 0 ? (
        <p className="pm-timeline-empty">
          Nothing recorded in this range.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table pm-costing-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="pm-num">Value done</th>
                <th className="pm-num">Labour + staff</th>
                <th className="pm-num">Machinery</th>
                <th className="pm-num">Concrete</th>
                <th className="pm-num">TMT</th>
                <th className="pm-num">Total expense</th>
                <th className="pm-num">Margin</th>
                <th className="pm-num">Expense %</th>
                <th>Feeds</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((row) => (
                <tr
                  key={row.date}
                  className={clsx(
                    row.flagged && "pm-costing-row--flagged",
                  )}
                >
                  <td>{formatDate(row.date)}</td>
                  <td className="pm-num">
                    {formatCurrency(row.value)}
                  </td>
                  <td className="pm-num">
                    {formatCurrency(row.labour_staff_cost)}
                  </td>
                  <td className="pm-num">
                    {formatCurrency(row.machinery_cost)}
                  </td>
                  <td className="pm-num">
                    {formatCurrency(row.concrete_cost)}
                    {row.concrete_source === "STORES" ? (
                      <span className="sub"> · stores</span>
                    ) : row.concrete_source === "ESTIMATED" ? (
                      <span className="sub"> · est.</span>
                    ) : null}
                  </td>
                  <td className="pm-num">
                    {formatCurrency(row.tmt_cost)}
                  </td>
                  <td className="pm-num">
                    <strong>
                      {formatCurrency(row.total_expense)}
                    </strong>
                  </td>
                  <td className="pm-num">
                    {formatCurrency(row.margin)}
                  </td>
                  <td className="pm-num">
                    {row.expense_ratio === null
                      ? "-"
                      : formatPercent(
                          Math.round(row.expense_ratio * 100),
                        )}
                  </td>
                  <td>
                    <CompleteDots complete={row.complete} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="pm-num">
                  {formatCurrency(data.totals.value)}
                </td>
                <td className="pm-num">
                  {formatCurrency(
                    data.totals.labour_staff_cost,
                  )}
                </td>
                <td className="pm-num">
                  {formatCurrency(data.totals.machinery_cost)}
                </td>
                <td className="pm-num">
                  {formatCurrency(data.totals.concrete_cost)}
                </td>
                <td className="pm-num">
                  {formatCurrency(data.totals.tmt_cost)}
                </td>
                <td className="pm-num">
                  <strong>
                    {formatCurrency(data.totals.total_expense)}
                  </strong>
                </td>
                <td className="pm-num">
                  {formatCurrency(data.totals.margin)}
                </td>
                <td className="pm-num">
                  {data.totals.expense_ratio === null
                    ? "-"
                    : formatPercent(
                        Math.round(
                          data.totals.expense_ratio * 100,
                        ),
                      )}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="sub">
        Feeds column: which of DPR, HR, Machinery and Stores
        recorded something that day - a dim letter is a feed that
        may not have been updated.
      </p>
    </div>
  );
}
