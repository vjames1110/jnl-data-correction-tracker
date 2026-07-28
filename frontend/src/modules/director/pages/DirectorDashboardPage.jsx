import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useApprovalSteps,
} from "../../../hooks/useCorrectionRequests";
import {
  approvalStatusTone,
  formatApprovalStatus,
  formatDateTime,
  formatPerson,
  getAgeingLabel,
  getSlaState,
} from "../utils/approvalDisplay";
import {
  buildApprovalSummary,
} from "../utils/approvalMetrics";

function KpiCard({
  icon: Icon,
  label,
  value,
  warning,
}) {
  return (
    <div
      className={
        warning
          ? "user-kpi-card user-kpi-card--warning"
          : "user-kpi-card"
      }
    >
      <div className="user-kpi-card__header">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <strong>{value ?? "N/A"}</strong>
    </div>
  );
}

export function DirectorDashboardPage() {
  const approvalsQuery = useApprovalSteps({
    page_size: 500,
    ordering: "-updated_at",
  });
  const steps = approvalsQuery.data?.items ?? [];
  const summary = buildApprovalSummary(steps);
  const pendingSteps = steps
    .filter(
      (step) =>
        step.status === "PENDING" &&
        step.is_current,
    )
    .slice(0, 8);

  if (approvalsQuery.isLoading) {
    return (
      <AppLoader label="Loading director dashboard..." />
    );
  }

  if (approvalsQuery.isError) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        message={approvalsQuery.error?.message}
        onRetry={approvalsQuery.refetch}
      />
    );
  }

  return (
    <div className="director-approval-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Director Portal
          </span>
          <h1>Dashboard</h1>
          <p>
            Approval load, SLA pressure and decision
            summary.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--primary"
            to="/director/approvals"
          >
            Approval Inbox
          </Link>
        </div>
      </div>

      <div className="user-kpi-grid director-dashboard-kpis">
        <KpiCard
          icon={ClipboardCheck}
          label="Pending Approvals"
          value={summary.pending}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Approved Today"
          value={summary.approved_today}
        />
        <KpiCard
          icon={XCircle}
          label="Rejected"
          value={summary.rejected}
          warning
        />
        <KpiCard
          icon={RotateCcw}
          label="Returned"
          value={summary.returned}
          warning
        />
        <KpiCard
          icon={AlertTriangle}
          label="Overdue"
          value={summary.overdue}
          warning
        />
        <KpiCard
          icon={Clock3}
          label="Avg Approval Hours"
          value={
            summary.average_approval_time_hours
          }
        />
      </div>

      <SurfaceCard title="Pending Work">
        {!pendingSteps.length ? (
          <EmptyState
            title="No pending approvals"
            message="Pending director approval records will appear here."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table director-approval-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Requester</th>
                  <th>Priority</th>
                  <th>SLA</th>
                  <th>Ageing</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingSteps.map((step) => {
                  const slaState = getSlaState(step);

                  return (
                    <tr key={step.id}>
                      <td>
                        <strong>
                          {step.request_reference}
                        </strong>
                        <small>
                          {formatDateTime(
                            step.request_submitted_at,
                          )}
                        </small>
                      </td>
                      <td>
                        {formatPerson({
                          employeeId:
                            step.requester_employee_id,
                          name: step.requester_name,
                        })}
                      </td>
                      <td>
                        {step.priority_name || "-"}
                      </td>
                      <td>
                        <span
                          className={`request-status request-status--${slaState.tone}`}
                        >
                          {slaState.label}
                        </span>
                      </td>
                      <td>
                        {getAgeingLabel(
                          step.request_submitted_at ||
                            step.created_at,
                        )}
                      </td>
                      <td>
                        <span
                          className={`request-status request-status--${approvalStatusTone(
                            step.status,
                          )}`}
                        >
                          {formatApprovalStatus(
                            step.status,
                          )}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="button button--secondary"
                          to={`/director/approvals/${step.id}`}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
