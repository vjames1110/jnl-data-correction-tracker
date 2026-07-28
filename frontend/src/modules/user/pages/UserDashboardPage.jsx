import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FilePenLine,
  FileText,
  ListChecks,
  RotateCcw,
  TimerReset,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useCorrectionDashboard,
} from "../../../hooks/useCorrectionRequests";
import { RequestTable } from "../components/RequestTable";

const kpiItems = [
  ["total", "Total Requests", FileText],
  ["draft", "Drafts", FilePenLine],
  ["pending_approval", "Pending Approvals", Clock3],
  ["approved", "Approved", CheckCircle2],
  ["assigned", "Assigned", ListChecks],
  ["in_progress", "In Progress", TimerReset],
  ["resolved", "Resolved", FileCheck2],
  ["reopened", "Reopened", RotateCcw],
  ["closed", "Closed", CheckCircle2],
  ["sla_overdue", "SLA Overdue", AlertTriangle],
];

export function UserDashboardPage() {
  const dashboardQuery = useCorrectionDashboard();
  const summary =
    dashboardQuery.data?.summary ?? {};

  return (
    <div className="user-dashboard-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            User Portal
          </span>
          <h1>Correction Dashboard</h1>
          <p>
            Track your drafts, approvals,
            assignments and SLA position.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--secondary"
            to="/user/requests"
          >
            My Requests
          </Link>
          <Link
            className="button button--primary"
            to="/user/requests/new"
          >
            Create Request
          </Link>
        </div>
      </div>

      {dashboardQuery.isLoading ? (
        <AppLoader label="Loading request dashboard..." />
      ) : dashboardQuery.isError ? (
        <ErrorState
          title="Dashboard unavailable"
          message={dashboardQuery.error?.message}
          onRetry={dashboardQuery.refetch}
        />
      ) : (
        <>
          <section className="user-kpi-grid">
            {kpiItems.map(([key, label, Icon]) => (
              <div
                key={key}
                className={
                  key === "sla_overdue"
                    ? "user-kpi-card user-kpi-card--warning"
                    : "user-kpi-card"
                }
              >
                <div className="user-kpi-card__header">
                  <span>{label}</span>
                  <Icon size={18} />
                </div>
                <strong>
                  {summary[key] ?? 0}
                </strong>
              </div>
            ))}
          </section>

          <div className="user-dashboard-grid">
            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Recent Requests</h2>
                <Link
                  className="button button--tertiary"
                  to="/user/requests"
                >
                  View all
                </Link>
              </div>
              <div className="surface-card__body">
                <RequestTable
                  requests={
                    dashboardQuery.data
                      ?.recent_requests ?? []
                  }
                />
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Closure Time</h2>
              </div>
              <div className="surface-card__body">
                <div className="closure-time-panel">
                  <span>Average closure time</span>
                  <strong>
                    {dashboardQuery.data
                      ?.average_closure_time_hours ??
                    "N/A"}
                  </strong>
                  <p>
                    Hours calculated from submitted
                    requests that are resolved or closed.
                  </p>
                </div>
              </div>
            </SurfaceCard>
          </div>
        </>
      )}
    </div>
  );
}
