import { Droplet, HardHat, Truck, Wrench } from "lucide-react";

import { KpiCard } from "../../admin/components/KpiCard";
import {
  formatCurrency,
  formatDate,
  formatMoneyCompact,
  formatQty,
} from "../utils/status";

const SOURCE_LABELS = {
  MARKET: "Market",
  HO: "In-house",
};

/**
 * The month's machinery cost, day by day (latest first, future days
 * never shown): market hire and in-house hire side by side, then
 * fuel, maintenance and other. Every figure is the backend's
 * ``machinery/summary``.
 */
export function MachineryDayTable({ summary }) {
  const { days, totals, by_machine: machines } = summary;
  const rows = [...days].reverse();
  const hire =
    Number(totals.market_hire) + Number(totals.ho_hire);
  const upkeep =
    Number(totals.maintenance) + Number(totals.other);

  return (
    <div className="pm-stack">
      <section className="kpi-grid kpi-grid--compact pm-hr-tiles">
        <KpiCard
          label="Machinery cost this month"
          value={formatMoneyCompact(totals.total)}
          icon={Truck}
          helper="Hire + fuel + upkeep, up to today"
        />
        <KpiCard
          label="Hire"
          value={formatMoneyCompact(hire)}
          icon={HardHat}
          tone="information"
          helper={`Market ${formatMoneyCompact(totals.market_hire)} · in-house ${formatMoneyCompact(totals.ho_hire)}`}
        />
        <KpiCard
          label="Fuel"
          value={formatMoneyCompact(totals.fuel)}
          icon={Droplet}
          tone="warning"
          helper="All fuel bought or issued"
        />
        <KpiCard
          label="Maintenance & other"
          value={formatMoneyCompact(upkeep)}
          icon={Wrench}
          tone="success"
          helper="Repairs, spares, misc."
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
                <th className="pm-num">Market hire</th>
                <th className="pm-num">In-house hire</th>
                <th className="pm-num">Fuel</th>
                <th className="pm-num">Maintenance</th>
                <th className="pm-num">Other</th>
                <th className="pm-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.date}
                  className={
                    Number(row.total) === 0
                      ? "pm-hr-table__empty"
                      : ""
                  }
                >
                  <td>{formatDate(row.date)}</td>
                  <td className="pm-num">
                    {formatCurrency(row.market_hire)}
                  </td>
                  <td className="pm-num">
                    {formatCurrency(row.ho_hire)}
                  </td>
                  <td className="pm-num">
                    {formatCurrency(row.fuel)}
                  </td>
                  <td className="pm-num">
                    {formatCurrency(row.maintenance)}
                  </td>
                  <td className="pm-num">
                    {formatCurrency(row.other)}
                  </td>
                  <td className="pm-num">
                    <strong>
                      {formatCurrency(row.total)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Month to date</th>
                <th className="pm-num">
                  {formatCurrency(totals.market_hire)}
                </th>
                <th className="pm-num">
                  {formatCurrency(totals.ho_hire)}
                </th>
                <th className="pm-num">
                  {formatCurrency(totals.fuel)}
                </th>
                <th className="pm-num">
                  {formatCurrency(totals.maintenance)}
                </th>
                <th className="pm-num">
                  {formatCurrency(totals.other)}
                </th>
                <th className="pm-num">
                  {formatCurrency(totals.total)}
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {machines.length ? (
        <div>
          <h3 className="pm-hr-subheading">By machine</h3>
          <div className="pm-table-wrap">
            <table className="pm-report__table pm-hr-table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Source</th>
                  <th className="pm-num">Days / hrs</th>
                  <th className="pm-num">Hire</th>
                  <th className="pm-num">Fuel</th>
                  <th className="pm-num">Maintenance</th>
                  <th className="pm-num">Other</th>
                  <th className="pm-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((row) => (
                  <tr key={row.machine}>
                    <td>
                      {row.name}
                      {row.reg_no ? ` (${row.reg_no})` : ""}
                    </td>
                    <td>
                      {SOURCE_LABELS[row.source] ?? row.source}
                    </td>
                    <td className="pm-num">
                      {formatQty(row.qty)}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.hire)}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.fuel)}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.maintenance)}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.other)}
                    </td>
                    <td className="pm-num">
                      <strong>
                        {formatCurrency(row.total)}
                      </strong>
                    </td>
                  </tr>
                ))}
                {Number(summary.site_fuel) > 0 ? (
                  <tr>
                    <td>
                      <em>Site fuel (no machine)</em>
                    </td>
                    <td>-</td>
                    <td className="pm-num">-</td>
                    <td className="pm-num">-</td>
                    <td className="pm-num">
                      {formatCurrency(summary.site_fuel)}
                    </td>
                    <td className="pm-num">-</td>
                    <td className="pm-num">-</td>
                    <td className="pm-num">
                      <strong>
                        {formatCurrency(summary.site_fuel)}
                      </strong>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
