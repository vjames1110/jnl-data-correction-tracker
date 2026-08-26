import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  IndianRupee,
  Printer,
  TrendingDown,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { USER_ROLES } from "../../../constants/roles";
import { useAuth } from "../../../hooks/useAuth";
import { KpiCard } from "../../admin/components/KpiCard";
import { downloadCsv } from "../../admin/utils/organizationUtils";
import { useReconciliationDashboard } from "../../../hooks/useReconciliation";
import { varianceCellClass } from "../../../utils/formatters";

function TrendChart({ data }) {
  if (!data.length) {
    return (
      <EmptyState
        title="No trend data"
        message="Not enough history yet to chart a trend."
      />
    );
  }

  return (
    <div className="chart-container chart-container--wide">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar
            dataKey="within_tolerance_count"
            name="Within Tolerance"
            stackId="status"
            fill="#107E3E"
          />
          <Bar
            dataKey="watch_count"
            name="Watch"
            stackId="status"
            fill="#e9730c"
          />
          <Bar
            dataKey="over_tolerance_count"
            name="Over Tolerance"
            stackId="status"
            fill="#BB0000"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function VarianceStatusChip({ status }) {
  const tone =
    status === "WITHIN_TOLERANCE"
      ? "status-chip--success"
      : status === "WATCH"
        ? "status-chip--warning"
        : status === "OVER_TOLERANCE"
          ? "status-chip--error"
          : "status-chip--warning";
  const label = status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());

  return (
    <span className={`status-chip ${tone}`}>
      {label}
    </span>
  );
}

function periodStatusToLabel(status) {
  return (status || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
}

function SiteLeaderboard({ rows }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="No entries this month"
        message="No site has recorded any reconciliation entries for this month yet."
      />
    );
  }

  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Site</th>
            <th>Period Status</th>
            <th>Entries</th>
            <th>Over Tolerance</th>
            <th>Watch</th>
            <th>Within Tolerance</th>
            <th>Total Variance Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.site_id}>
              <td>
                <strong>{row.site_code}</strong>
                <span className="table-subtext">
                  {row.site_name}
                </span>
              </td>
              <td>
                {periodStatusToLabel(
                  row.period_status,
                )}
              </td>
              <td>{row.total_entries}</td>
              <td>
                {row.over_tolerance_count ? (
                  <VarianceStatusChip status="OVER_TOLERANCE" />
                ) : null}{" "}
                {row.over_tolerance_count}
              </td>
              <td>{row.watch_count}</td>
              <td>
                {row.within_tolerance_count}
              </td>
              <td
                className={varianceCellClass(
                  row.total_variance_value,
                )}
              >
                {row.total_variance_value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemLeaderboard({ rows }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="No entries this month"
        message="No item has recorded any reconciliation entries for this month yet."
      />
    );
  }

  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>UOM</th>
            <th>Entries</th>
            <th>Over Tolerance</th>
            <th>Watch</th>
            <th>Sites Affected</th>
            <th>Total Variance Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.item_id}>
              <td>
                <strong>{row.item_code}</strong>
                <span className="table-subtext">
                  {row.item_name}
                </span>
              </td>
              <td>{row.uom}</td>
              <td>{row.total_entries}</td>
              <td>{row.over_tolerance_count}</td>
              <td>{row.watch_count}</td>
              <td>{row.sites_affected}</td>
              <td
                className={varianceCellClass(
                  row.total_variance_value,
                )}
              >
                {row.total_variance_value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function statementPackPath(role) {
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/reconciliation-pack";
  }
  if (
    role === USER_ROLES.ADMIN ||
    role === USER_ROLES.SUPER_ADMIN
  ) {
    return "/admin/reconciliation/statement-pack";
  }
  return "/store/statement-pack";
}

const SITE_CSV_COLUMNS = [
  { key: "site_code", label: "Site Code" },
  { key: "site_name", label: "Site Name" },
  { key: "period_status", label: "Period Status" },
  { key: "total_entries", label: "Entries" },
  {
    key: "over_tolerance_count",
    label: "Over Tolerance",
  },
  { key: "watch_count", label: "Watch" },
  {
    key: "within_tolerance_count",
    label: "Within Tolerance",
  },
  {
    key: "total_variance_value",
    label: "Total Variance Value (INR)",
  },
];

const ITEM_CSV_COLUMNS = [
  { key: "item_code", label: "Item Code" },
  { key: "item_name", label: "Item Name" },
  { key: "uom", label: "UOM" },
  { key: "total_entries", label: "Entries" },
  {
    key: "over_tolerance_count",
    label: "Over Tolerance",
  },
  { key: "watch_count", label: "Watch" },
  {
    key: "sites_affected",
    label: "Sites Affected",
  },
  {
    key: "total_variance_value",
    label: "Total Variance Value (INR)",
  },
];

export function StoreReconciliationReportsPage() {
  const { user } = useAuth();
  const [monthOverride, setMonthOverride] =
    useState("");
  const params = useMemo(
    () =>
      monthOverride
        ? { month: `${monthOverride}-01` }
        : {},
    [monthOverride],
  );
  const dashboardQuery =
    useReconciliationDashboard(params);
  const data = dashboardQuery.data;
  const displayMonth =
    monthOverride ||
    (data?.period_month
      ? data.period_month.slice(0, 7)
      : "");
  const worstSite = data?.site_summary?.[0];

  return (
    <div className="organization-page">
      <div className="page-heading print-hidden">
        <div>
          <span className="page-eyebrow">
            Store Reconciliation
          </span>
          <h1>Variance Reports</h1>
          <p>
            Which sites and items show the
            biggest discrepancies, company-wide -
            for the selected month.
          </p>
        </div>

        <div className="page-actions">
          <label className="filter-control">
            <span>Month</span>
            <input
              type="month"
              value={displayMonth}
              onChange={(event) =>
                setMonthOverride(
                  event.target.value,
                )
              }
            />
          </label>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => window.print()}
          >
            <Printer size={15} />
            Print Report
          </button>
          <Link
            className="button button--tertiary"
            to={statementPackPath(user?.role)}
          >
            Multi-Site Statement Pack
          </Link>
        </div>
      </div>

      {dashboardQuery.isLoading ? (
        <AppLoader label="Loading reconciliation reports..." />
      ) : dashboardQuery.isError ? (
        <ErrorState
          title="Reports unavailable"
          message={dashboardQuery.error?.message}
          onRetry={dashboardQuery.refetch}
        />
      ) : (
        <>
          <p className="print-only print-title">
            Store Reconciliation Report —{" "}
            {displayMonth}
          </p>

          <section className="kpi-grid">
            <KpiCard
              label="Sites Reporting"
              value={`${data.company_summary.sites_reporting} / ${data.company_summary.total_sites}`}
              icon={Building2}
              tone={
                data.company_summary
                  .sites_not_reporting
                  ? "warning"
                  : "success"
              }
              helper={
                data.company_summary
                  .sites_not_reporting
                  ? `${data.company_summary.sites_not_reporting} site(s) have not recorded anything this month`
                  : "All active sites have reported"
              }
            />
            <KpiCard
              label="Total Entries"
              value={
                data.company_summary.total_entries
              }
              icon={ClipboardList}
            />
            <KpiCard
              label="Over Tolerance"
              value={
                data.company_summary
                  .over_tolerance_count
              }
              icon={AlertTriangle}
              tone="error"
            />
            <KpiCard
              label="Watch"
              value={
                data.company_summary.watch_count
              }
              icon={Eye}
              tone="warning"
            />
            <KpiCard
              label="Within Tolerance"
              value={
                data.company_summary
                  .within_tolerance_count
              }
              icon={CheckCircle2}
              tone="success"
            />
            <KpiCard
              label="Total Variance Value"
              value={`₹${Number(
                data.company_summary
                  .total_variance_value ?? 0,
              ).toLocaleString("en-IN")}`}
              icon={IndianRupee}
              tone={
                Number(
                  data.company_summary
                    .total_variance_value ?? 0,
                ) > 0
                  ? "error"
                  : undefined
              }
              helper="Sum of every entry's variance, this month"
            />
            <KpiCard
              label="Largest Single Variance"
              value={
                worstSite
                  ? `₹${Number(
                      worstSite.total_variance_value,
                    ).toLocaleString("en-IN")}`
                  : "—"
              }
              icon={TrendingDown}
              tone={worstSite ? "error" : undefined}
              helper={
                worstSite
                  ? worstSite.site_name
                  : "No sites reported yet"
              }
            />
          </section>

          <SurfaceCard
            title="6-Month Trend"
            className="print-hidden"
          >
            <TrendChart data={data.trend} />
          </SurfaceCard>

          <SurfaceCard
            title="Site Leaderboard — Worst First"
            action={
              <button
                type="button"
                className="button button--tertiary print-hidden"
                disabled={!data.site_summary.length}
                onClick={() =>
                  downloadCsv(
                    `site-leaderboard-${displayMonth || "current"}.csv`,
                    data.site_summary,
                    SITE_CSV_COLUMNS,
                  )
                }
              >
                <Download size={15} />
                Export CSV
              </button>
            }
          >
            <SiteLeaderboard
              rows={data.site_summary}
            />
          </SurfaceCard>

          <SurfaceCard
            title="Item Leaderboard — Worst First"
            action={
              <button
                type="button"
                className="button button--tertiary print-hidden"
                disabled={!data.item_summary.length}
                onClick={() =>
                  downloadCsv(
                    `item-leaderboard-${displayMonth || "current"}.csv`,
                    data.item_summary,
                    ITEM_CSV_COLUMNS,
                  )
                }
              >
                <Download size={15} />
                Export CSV
              </button>
            }
          >
            <ItemLeaderboard
              rows={data.item_summary}
            />
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
