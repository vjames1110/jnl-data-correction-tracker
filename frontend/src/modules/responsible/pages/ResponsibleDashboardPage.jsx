import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Filter,
  PauseCircle,
  PlayCircle,
  Search,
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

function matchesSearch(request, search) {
  if (!search) {
    return true;
  }

  const haystack = [
    request.reference,
    request.voucher_number,
    request.voucher_name,
    request.description,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(
    search.toLowerCase(),
  );
}

export function ResponsibleDashboardPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("");

  const countsQuery = useAssignmentCounts();
  const assignmentsQuery = useMyAssignments({
    page_size: 500,
    ordering: "-updated_at",
  });

  const counts = countsQuery.data ?? {};
  const allAssignments = useMemo(
    () => assignmentsQuery.data?.items ?? [],
    [assignmentsQuery.data],
  );
  const filteredAssignments = useMemo(
    () =>
      allAssignments.filter(
        (request) =>
          matchesSearch(request, search) &&
          (!statusFilter ||
            request.current_status ===
              statusFilter),
      ),
    [allAssignments, search, statusFilter],
  );
  const assignments = filteredAssignments.slice(
    0,
    25,
  );

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
            Work Assignee Portal
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
        <div className="user-request-toolbar">
          <label className="input-control">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search ticket number, voucher or description"
            />
          </label>

          <label className="filter-control">
            <Filter size={15} />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
            >
              <option value="">
                All statuses
              </option>
              <option value="ASSIGNED">
                Newly assigned
              </option>
              <option value="ACCEPTED">
                Accepted
              </option>
              <option value="IN_PROGRESS">
                In progress
              </option>
              <option value="ON_HOLD">
                On hold
              </option>
              <option value="RESOLVED">
                Resolved
              </option>
              <option value="CLOSED">
                Closed
              </option>
            </select>
          </label>
        </div>

        {!assignments.length ? (
          <EmptyState
            title="No matching assignments"
            message="Adjust the ticket number search or status filter."
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
