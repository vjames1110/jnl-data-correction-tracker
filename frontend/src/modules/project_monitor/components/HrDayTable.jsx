import {
  CalendarDays,
  HardHat,
  Users,
  Wallet,
} from "lucide-react";

import { KpiCard } from "../../admin/components/KpiCard";
import {
  formatCurrency,
  formatDate,
  formatMoneyCompact,
  formatQty,
} from "../utils/status";

/**
 * The month's HR cost, day by day (latest first, future days never
 * shown): labour head-count and cost, staff cost, and the total. All
 * figures come from the backend's ``hr/summary``.
 */
export function HrDayTable({ summary }) {
  const { days, totals, labour_by_category: categories } =
    summary;
  const rows = [...days].reverse();

  return (
    <div className="pm-stack">
      <section className="kpi-grid kpi-grid--compact pm-hr-tiles">
        <KpiCard
          label="HR cost this month"
          value={formatMoneyCompact(totals.total)}
          icon={Wallet}
          helper="Labour + staff, up to today"
        />
        <KpiCard
          label="Labour cost"
          value={formatMoneyCompact(totals.labour_cost)}
          icon={HardHat}
          tone="information"
          helper={`${formatQty(totals.labour_man_days)} man-days`}
        />
        <KpiCard
          label="Staff cost"
          value={formatMoneyCompact(totals.staff_cost)}
          icon={Users}
          tone="success"
          helper="Salary by day, with overrides"
        />
        <KpiCard
          label="Days counted"
          value={String(days.length)}
          icon={CalendarDays}
          tone="warning"
          helper="Future days are not costed"
        />
      </section>

      {rows.length === 0 ? (
        <p className="pm-timeline-empty">
          This month has not started yet.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table pm-hr-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="pm-num">Labour (nos)</th>
                <th className="pm-num">Labour cost</th>
                <th className="pm-num">Staff cost</th>
                <th className="pm-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEmpty = Number(row.total) === 0;
                return (
                  <tr
                    key={row.date}
                    className={
                      isEmpty ? "pm-hr-table__empty" : ""
                    }
                  >
                    <td>{formatDate(row.date)}</td>
                    <td className="pm-num">
                      {Number(row.labour_nos)
                        ? formatQty(row.labour_nos)
                        : "-"}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.labour_cost)}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.staff_cost)}
                    </td>
                    <td className="pm-num">
                      <strong>
                        {formatCurrency(row.total)}
                      </strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th>Month to date</th>
                <th className="pm-num">
                  {formatQty(totals.labour_man_days)}
                </th>
                <th className="pm-num">
                  {formatCurrency(totals.labour_cost)}
                </th>
                <th className="pm-num">
                  {formatCurrency(totals.staff_cost)}
                </th>
                <th className="pm-num">
                  {formatCurrency(totals.total)}
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {categories.length ? (
        <div>
          <h3 className="pm-hr-subheading">
            Labour by category
          </h3>
          <div className="pm-table-wrap">
            <table className="pm-report__table pm-hr-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="pm-num">Man-days</th>
                  <th className="pm-num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((row) => (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    <td className="pm-num">
                      {formatQty(row.man_days)}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
