import { Link } from "react-router-dom";

import { CountBars } from "../../../components/charts/CountBars";
import { TrendChart } from "../../../components/charts/kit/TrendChart";
import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useCorrectionAnalytics,
} from "../../../hooks/useCorrectionRequests";

const TREND_SERIES = [
  { key: "count", label: "Requests", token: "progress" },
];

function AnalyticsChart({
  data,
  dataKey,
  nameKey,
  type = "bar",
}) {
  if (type === "line") {
    return (
      <TrendChart
        data={data ?? []}
        xKey={nameKey}
        series={TREND_SERIES.map((item) => ({
          ...item,
          key: dataKey,
        }))}
        emptyTitle="No trend yet"
        emptyMessage="Your monthly trend appears once you have requests."
      />
    );
  }
  return (
    <CountBars
      data={data}
      nameKey={nameKey}
      dataKey={dataKey}
      valueLabel="requests"
      emptyTitle="No requests yet"
      emptyMessage="This breakdown appears once you have requests."
    />
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
