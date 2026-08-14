import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { useAssignmentAnalytics } from "../../../hooks/useCorrectionRequests";

function WorkloadChart({ data }) {
  return (
    <div className="user-analytics-chart">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="module" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar
            dataKey="count"
            fill="#0a6ed1"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResponsibleAnalyticsPage() {
  const analyticsQuery = useAssignmentAnalytics();
  const analytics = analyticsQuery.data;

  return (
    <div className="responsible-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Work Assignee Portal
          </span>
          <h1>Personal Analytics</h1>
          <p>
            Completion, turnaround, SLA and
            workload indicators for your assigned
            work.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--tertiary"
            to="/responsible/dashboard"
          >
            Dashboard
          </Link>
          <Link
            className="button button--primary"
            to="/responsible/assignments"
          >
            Assignments
          </Link>
        </div>
      </div>

      {analyticsQuery.isLoading ? (
        <AppLoader label="Loading analytics..." />
      ) : analyticsQuery.isError ? (
        <ErrorState
          title="Analytics unavailable"
          message={analyticsQuery.error?.message}
          onRetry={analyticsQuery.refetch}
        />
      ) : (
        <>
          <section className="user-analytics-kpis">
            <div className="user-kpi-card">
              <div className="user-kpi-card__header">
                <span>Completed Requests</span>
              </div>
              <strong>
                {analytics.completed_requests}
              </strong>
            </div>
            <div className="user-kpi-card">
              <div className="user-kpi-card__header">
                <span>Average Turnaround (Hrs)</span>
              </div>
              <strong>
                {analytics.average_turnaround_hours ??
                  "N/A"}
              </strong>
            </div>
            <div className="user-kpi-card">
              <div className="user-kpi-card__header">
                <span>SLA Compliance</span>
              </div>
              <strong>
                {analytics.sla_compliance_rate ===
                null
                  ? "N/A"
                  : `${analytics.sla_compliance_rate}%`}
              </strong>
            </div>
            <div className="user-kpi-card">
              <div className="user-kpi-card__header">
                <span>Reopen Rate</span>
              </div>
              <strong>
                {analytics.reopen_rate}%
              </strong>
            </div>
          </section>

          <SurfaceCard>
            <div className="surface-card__header">
              <h2>Workload By Module</h2>
            </div>
            <div className="surface-card__body">
              <WorkloadChart
                data={
                  analytics.workload_by_module
                }
              />
            </div>
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
