import { Printer } from "lucide-react";
import { useState } from "react";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { useFinancialReport } from "../../../hooks/useProjectMonitor";
import { todayIso } from "../utils/finance";
import {
  formatCurrency,
  formatDate,
  formatQty,
  formatRate,
} from "../utils/status";

/**
 * The report rows with a heading line for each BOQ group they sit in
 * and a subtotal after the last row of each top-level group. Flat
 * (ungrouped) items come through as plain rows, exactly as before.
 */
function withGroups(rows) {
  const lines = [];
  let previous = [];
  let subtotal = null;

  const flush = () => {
    if (subtotal) {
      lines.push({ type: "subtotal", ...subtotal });
      subtotal = null;
    }
  };

  rows.forEach((row) => {
    const path = row.group ?? [];
    if (path[0] !== previous[0]) {
      flush();
    }
    let common = 0;
    while (
      common < path.length &&
      path[common] === previous[common]
    ) {
      common += 1;
    }
    path.slice(common).forEach((label, offset) => {
      lines.push({
        type: "group",
        label,
        level: common + offset,
        key: `${path.slice(0, common + offset + 1).join("/")}`,
      });
    });
    if (path.length) {
      subtotal ??= {
        label: path[0],
        executed_value: 0,
        today_value: 0,
        unbilled_value: 0,
      };
      subtotal.executed_value += Number(row.executed_value || 0);
      subtotal.today_value += Number(row.today_value || 0);
      subtotal.unbilled_value += Number(row.unbilled_value || 0);
    }
    lines.push({ type: "row", row });
    previous = path;
  });
  flush();
  return lines;
}

/** The printable table itself - reused by the Reports builder. */
export function FinancialReportSheet({ report, title }) {
  const { summary } = report;

  return (
    <div className="pm-finance-report">
      <h2>{title || "Financial progress report"}</h2>
      <p className="sub">As on {formatDate(report.as_on)}</p>

      <table className="pm-report__details">
        <tbody>
          <tr>
            <td>Contract value</td>
            <td>{formatCurrency(summary.valued)}</td>
          </tr>
          <tr>
            <td>
              Work done up to last bill
              {summary.last_bill_no
                ? ` (${summary.last_bill_no})`
                : ""}
            </td>
            <td>
              {formatCurrency(summary.work_done_to_last_bill)}
            </td>
          </tr>
          <tr>
            <td>DPR value after last bill</td>
            <td>
              {formatCurrency(
                summary.dpr_value_after_last_bill,
              )}
            </td>
          </tr>
          <tr>
            <td>Balance value</td>
            <td>
              {formatCurrency(summary.balance_value)}
              {summary.percent_done !== null
                ? ` (${summary.percent_done}% done)`
                : ""}
            </td>
          </tr>
          <tr>
            <td>Unbilled value (executed, not yet billed)</td>
            <td>{formatCurrency(summary.unbilled_value)}</td>
          </tr>
        </tbody>
      </table>

      {report.rows.length === 0 ? (
        <p className="pm-report__empty">
          Nothing has been executed up to this date.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Scope</th>
                <th>Executed qty</th>
                <th>Executed value</th>
                <th>% of item</th>
                <th>That day&apos;s qty</th>
                <th>That day&apos;s value</th>
                <th>Billed qty</th>
                <th>Unbilled value</th>
              </tr>
            </thead>
            <tbody>
              {withGroups(report.rows).map((line, index) => {
                if (line.type === "group") {
                  return (
                    <tr
                      key={`group-${line.key}-${index}`}
                      className="pm-report__group-row"
                    >
                      <td
                        colSpan={12}
                        style={{
                          paddingLeft: `${8 + line.level * 14}px`,
                        }}
                      >
                        {line.label}
                      </td>
                    </tr>
                  );
                }
                if (line.type === "subtotal") {
                  return (
                    <tr
                      key={`subtotal-${line.label}-${index}`}
                      className="pm-report__subtotal-row"
                    >
                      <td colSpan={6}>Subtotal - {line.label}</td>
                      <td>{formatCurrency(line.executed_value)}</td>
                      <td />
                      <td />
                      <td>{formatCurrency(line.today_value)}</td>
                      <td />
                      <td>{formatCurrency(line.unbilled_value)}</td>
                    </tr>
                  );
                }
                const { row } = line;
                return (
                  <tr key={row.id}>
                    <td>{row.item_no || "-"}</td>
                    <td className="pm-report__col-task">
                      {row.description}
                    </td>
                    <td>{row.unit || "-"}</td>
                    <td>{formatRate(row.rate)}</td>
                    <td>{formatQty(row.scope_qty)}</td>
                    <td>{formatQty(row.executed_qty)}</td>
                    <td>{formatCurrency(row.executed_value)}</td>
                    <td>
                      {row.percent_of_item === null
                        ? "-"
                        : `${row.percent_of_item}%`}
                    </td>
                    <td>{formatQty(row.today_qty)}</td>
                    <td>{formatCurrency(row.today_value)}</td>
                    <td>{formatQty(row.billed_qty)}</td>
                    <td>{formatCurrency(row.unbilled_value)}</td>
                  </tr>
                );
              })}
              <tr className="pm-dpr-grid__total">
                <td colSpan={6}>Total</td>
                <td>
                  {formatCurrency(
                    report.totals.executed_value,
                  )}
                </td>
                <td />
                <td />
                <td>
                  {formatCurrency(report.totals.today_value)}
                </td>
                <td />
                <td>
                  {formatCurrency(
                    report.totals.unbilled_value,
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="pm-report__generated">
        Values at the bid rate (with any escalation in force), as
        recorded when each quantity was entered or billed.
      </p>
    </div>
  );
}

export function FinancialReportView({ siteId }) {
  const [asOn, setAsOn] = useState(todayIso());
  const reportQuery = useFinancialReport(siteId, asOn, true);

  return (
    <div>
      <div className="pm-inline-row print-hidden">
        <label className="form-field">
          <span>As on</span>
          <input
            type="date"
            value={asOn}
            onChange={(event) => setAsOn(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="button button--primary"
          onClick={() => window.print()}
          disabled={!reportQuery.data}
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      {reportQuery.isLoading ? (
        <AppLoader label="Building financial report..." />
      ) : reportQuery.isError ? (
        <ErrorState
          title="Financial report unavailable"
          message={reportQuery.error?.message}
          onRetry={() => reportQuery.refetch()}
        />
      ) : (
        <div className="pm-report">
          <FinancialReportSheet report={reportQuery.data} />
        </div>
      )}
    </div>
  );
}
