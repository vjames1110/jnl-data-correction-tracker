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
} from "../utils/status";

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
              {report.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.item_no || "-"}</td>
                  <td className="pm-report__col-task">
                    {row.description}
                  </td>
                  <td>{row.unit || "-"}</td>
                  <td>{formatCurrency(row.rate)}</td>
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
              ))}
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
        Values at contract rates, as recorded when each
        quantity was entered or billed.
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
