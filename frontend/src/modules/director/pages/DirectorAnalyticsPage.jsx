import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useApprovalSteps,
} from "../../../hooks/useCorrectionRequests";
import {
  buildApprovalAnalytics,
} from "../utils/approvalMetrics";

function AnalyticsChart({
  data,
  dataKey,
  nameKey,
}) {
  return (
    <div className="user-analytics-chart">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={nameKey} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar
            dataKey={dataKey}
            fill="#0a6ed1"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DirectorAnalyticsPage() {
  const approvalsQuery = useApprovalSteps({
    page_size: 500,
    ordering: "-created_at",
  });
  const analytics = buildApprovalAnalytics(
    approvalsQuery.data?.items ?? [],
  );

  return (
    <div className="director-approval-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Director Analytics
          </span>
          <h1>Approval Analytics</h1>
          <p>
            Site, department, employee and voucher
            error trends.
          </p>
        </div>
      </div>

      {approvalsQuery.isLoading ? (
        <AppLoader label="Loading director analytics..." />
      ) : approvalsQuery.isError ? (
        <ErrorState
          title="Analytics unavailable"
          message={approvalsQuery.error?.message}
          onRetry={approvalsQuery.refetch}
        />
      ) : (
        <>
          <section className="user-analytics-kpis">
            <div className="user-kpi-card">
              <div className="user-kpi-card__header">
                <span>Approval Turnaround</span>
              </div>
              <strong>
                {analytics.approval_turnaround_hours ??
                  "N/A"}
              </strong>
            </div>
            <div className="user-kpi-card">
              <div className="user-kpi-card__header">
                <span>SLA Compliance</span>
              </div>
              <strong>
                {analytics.sla_compliance ?? "N/A"}
                {analytics.sla_compliance === null
                  ? ""
                  : "%"}
              </strong>
            </div>
            <div className="user-kpi-card">
              <div className="user-kpi-card__header">
                <span>Measured Decisions</span>
              </div>
              <strong>
                {
                  (approvalsQuery.data?.items ?? [])
                    .filter(
                      (step) =>
                        step.decided_at &&
                        step.due_at,
                    ).length
                }
              </strong>
            </div>
          </section>

          <div className="user-analytics-grid director-analytics-grid">
            <SurfaceCard title="Site Wise Requests">
              <AnalyticsChart
                data={
                  analytics.site_wise_requests
                }
                dataKey="count"
                nameKey="site"
              />
            </SurfaceCard>

            <SurfaceCard title="Department Wise Requests">
              <AnalyticsChart
                data={
                  analytics.department_wise_requests
                }
                dataKey="count"
                nameKey="department"
              />
            </SurfaceCard>

            <SurfaceCard title="Employee Mistake Ranking">
              <AnalyticsChart
                data={
                  analytics.employee_mistake_ranking
                }
                dataKey="count"
                nameKey="employee"
              />
            </SurfaceCard>

            <SurfaceCard title="Voucher Error Ranking">
              <AnalyticsChart
                data={
                  analytics.voucher_error_ranking
                }
                dataKey="count"
                nameKey="voucher"
              />
            </SurfaceCard>
          </div>
        </>
      )}
    </div>
  );
}
