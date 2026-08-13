import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  PauseCircle,
  PlayCircle,
  TimerReset,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useAssignmentCounts,
  useMyAssignments,
} from "../../../hooks/useCorrectionRequests";
import {
  formatCodeName,
  formatDateTime,
  formatStatus,
  getAgeingLabel,
  getWorkSlaState,
  statusTone,
} from "../utils/workDisplay";

function WorkKpiCard({
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
      <strong>{value ?? 0}</strong>
    </div>
  );
}

export function ResponsibleDashboardPage() {
  const countsQuery = useAssignmentCounts();
  const assignmentsQuery = useMyAssignments({
    page_size: 8,
    ordering: "-updated_at",
  });

  const counts = countsQuery.data ?? {};
  const assignments =
    assignmentsQuery.data?.items ?? [];

  const isLoading =
    countsQuery.isLoading ||
    assignmentsQuery.isLoading;
  const isError =
    countsQuery.isError || assignmentsQuery.isError;

  if (isLoading) {
    return (
      <AppLoader label="Loading work dashboard..." />
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        message={
          countsQuery.error?.message ||
          assignmentsQuery.error?.message
        }
        onRetry={() => {
          countsQuery.refetch();
          assignmentsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="responsible-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Responsible Person Portal
          </span>
          <h1>Work Dashboard</h1>
          <p>
            Operational view for assigned ERP
            correction work.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--primary"
            to="/responsible/assignments"
          >
            View Assignments
          </Link>
        </div>
      </div>

      <div className="user-kpi-grid responsible-kpi-grid">
        <WorkKpiCard
          icon={BriefcaseBusiness}
          label="Newly Assigned"
          value={counts.newly_assigned}
        />
        <WorkKpiCard
          icon={CheckCircle2}
          label="Accepted"
          value={counts.accepted}
        />
        <WorkKpiCard
          icon={PlayCircle}
          label="In Progress"
          value={counts.in_progress}
        />
        <WorkKpiCard
          icon={PauseCircle}
          label="On Hold"
          value={counts.on_hold}
          warning
        />
        <WorkKpiCard
          icon={TimerReset}
          label="Overdue"
          value={counts.overdue}
          warning
        />
        <WorkKpiCard
          icon={Clock3}
          label="Resolved Today"
          value={counts.resolved_today}
        />
      </div>

      <SurfaceCard title="Assigned Work">
        {!assignments.length ? (
          <EmptyState
            title="No assignments yet"
            message="Requests assigned to you will appear here."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table director-approval-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Site / Department</th>
                  <th>Voucher</th>
                  <th>SLA</th>
                  <th>Ageing</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((request) => {
                  const slaState =
                    getWorkSlaState(request);

                  return (
                    <tr key={request.id}>
                      <td>
                        <strong>
                          {request.reference}
                        </strong>
                        <small>
                          {formatDateTime(
                            request.updated_at,
                          )}
                        </small>
                      </td>
                      <td>
                        <strong>
                          {formatCodeName({
                            code: request.site_code,
                            name: request.site_name,
                          })}
                        </strong>
                        <small>
                          {formatCodeName({
                            code: request.department_code,
                            name: request.department_name,
                          })}
                        </small>
                      </td>
                      <td>
                        <strong>
                          {request.voucher_number ||
                            "-"}
                        </strong>
                        <small>
                          {request.voucher_name}
                        </small>
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
                          request.submitted_at ||
                            request.created_at,
                        )}
                      </td>
                      <td>
                        <span
                          className={`request-status request-status--${statusTone(
                            request.current_status,
                          )}`}
                        >
                          {formatStatus(
                            request.current_status,
                          )}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="button button--secondary"
                          to={`/responsible/assignments/${request.id}`}
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
