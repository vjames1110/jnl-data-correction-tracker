import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useCorrectionAnalytics,
} from "../../../hooks/useCorrectionRequests";

function AnalyticsChart({
  data,
  dataKey,
  nameKey,
  type = "bar",
}) {
  return (
    <div className="user-analytics-chart">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        {type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="#0a6ed1"
              strokeWidth={2}
            />
          </LineChart>
        ) : (
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
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function UserAnalyticsPage() {
  const analyticsQuery = useCorrectionAnalytics();
  const analytics = analyticsQuery.data;

  return (
    <div className="user-analytics-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            User Analytics
          </span>
          <h1>Request Analytics</h1>
          <p>
            Voucher, reason, trend and closure
            indicators for your requests.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--tertiary"
            to="/user/dashboard"
          >
            Dashboard
          </Link>
          <Link
            className="button button--primary"
            to="/user/requests/new"
          >
            Create Request
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
                <span>Rejection Rate</span>
              </div>
              <strong>
                {analytics.rejection_rate}%
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
            <div className="user-kpi-card">
              <div className="user-kpi-card__header">
                <span>Average Closure</span>
              </div>
              <strong>
                {analytics.average_closure_time_hours ??
                  "N/A"}
              </strong>
            </div>
          </section>

          <div className="user-analytics-grid">
            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Requests By Voucher</h2>
              </div>
              <div className="surface-card__body">
                <AnalyticsChart
                  data={
                    analytics.requests_by_voucher
                  }
                  dataKey="count"
                  nameKey="voucher"
                />
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Requests By Reason</h2>
              </div>
              <div className="surface-card__body">
                <AnalyticsChart
                  data={
                    analytics.requests_by_reason
                  }
                  dataKey="count"
                  nameKey="reason"
                />
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Monthly Trend</h2>
              </div>
              <div className="surface-card__body">
                <AnalyticsChart
                  data={analytics.monthly_trend}
                  dataKey="count"
                  nameKey="month"
                  type="line"
                />
              </div>
            </SurfaceCard>
          </div>
        </>
      )}
    </div>
  );
}
