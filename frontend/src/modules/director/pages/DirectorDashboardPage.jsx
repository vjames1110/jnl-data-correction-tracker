import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  Filter,
  Package,
  RotateCcw,
  Search,
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
  useReconciliationPendingApprovals,
} from "../../../hooks/useReconciliation";
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

function isDecided(step) {
  return (
    !(
      step.status === "PENDING" && step.is_current
    ) && step.status !== "SKIPPED"
  );
}

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

function matchesSearch(step, search) {
  if (!search) {
    return true;
  }

  const haystack = [
    step.request_reference,
    step.voucher_number,
    step.voucher_name,
    step.requester_employee_id,
    step.requester_name,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(
    search.toLowerCase(),
  );
}

export function DirectorDashboardPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("");

  const approvalsQuery = useApprovalSteps({
    page_size: 500,
    ordering: "-updated_at",
  });
  const reconciliationApprovalsQuery =
    useReconciliationPendingApprovals();
  const reconciliationPendingCount =
    reconciliationApprovalsQuery.data?.length ?? 0;
  const steps = useMemo(
    () => approvalsQuery.data?.items ?? [],
    [approvalsQuery.data],
  );
  const summary = buildApprovalSummary(steps);
  const pendingSteps = steps
    .filter(
      (step) =>
        step.status === "PENDING" &&
        step.is_current,
    )
    .slice(0, 8);
  const decidedSteps = steps
    .filter(isDecided)
    .slice(0, 8);
  const filteredSteps = useMemo(
    () =>
      steps.filter(
        (step) =>
          matchesSearch(step, search) &&
          (!statusFilter ||
            step.request_status ===
              statusFilter),
      ),
    [search, statusFilter, steps],
  );

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
            className="button button--secondary"
            to="/director/reconciliation-approvals"
          >
            Reconciliation Approvals
            {reconciliationPendingCount
              ? ` (${reconciliationPendingCount})`
              : ""}
          </Link>
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
          icon={Package}
          label="Reconciliation Pending"
          value={
            reconciliationApprovalsQuery.isLoading
              ? undefined
              : reconciliationPendingCount
          }
          warning={
            reconciliationPendingCount > 0
          }
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

      <SurfaceCard title="Recently Decided">
        {!decidedSteps.length ? (
          <EmptyState
            title="No decisions yet"
            message="Requests you approve, reject or return will appear here with their current owner."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table director-approval-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Requester</th>
                  <th>Your Decision</th>
                  <th>Current Status</th>
                  <th>Current Owner</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {decidedSteps.map((step) => (
                  <tr key={step.id}>
                    <td>
                      <strong>
                        {step.request_reference}
                      </strong>
                      <small>
                        {formatDateTime(
                          step.decided_at,
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
                      <span
                        className={`request-status request-status--${approvalStatusTone(
                          step.request_status,
                        )}`}
                      >
                        {formatApprovalStatus(
                          step.request_status,
                        )}
                      </span>
                    </td>
                    <td>
                      {formatPerson({
                        employeeId:
                          step.request_current_owner_employee_id,
                        name: step.request_current_owner_name,
                      })}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard title="Search Requests">
        <div className="user-request-toolbar">
          <label className="input-control">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search ticket number, voucher or requester"
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
              <option value="PENDING_APPROVAL">
                Pending approval
              </option>
              <option value="APPROVED">
                Approved
              </option>
              <option value="ASSIGNED">
                Assigned
              </option>
              <option value="IN_PROGRESS">
                In progress
              </option>
              <option value="RESOLVED">
                Resolved
              </option>
              <option value="CLOSED">
                Closed
              </option>
              <option value="REJECTED">
                Rejected
              </option>
            </select>
          </label>
        </div>

        {!filteredSteps.length ? (
          <EmptyState
            title="No matching requests"
            message="Adjust the ticket number search or status filter."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table director-approval-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Requester</th>
                  <th>Approval Status</th>
                  <th>Current Status</th>
                  <th>Current Owner</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSteps
                  .slice(0, 25)
                  .map((step) => (
                    <tr key={step.id}>
                      <td>
                        <strong>
                          {
                            step.request_reference
                          }
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
                        <span
                          className={`request-status request-status--${approvalStatusTone(
                            step.request_status,
                          )}`}
                        >
                          {formatApprovalStatus(
                            step.request_status,
                          )}
                        </span>
                      </td>
                      <td>
                        {formatPerson({
                          employeeId:
                            step.request_current_owner_employee_id,
                          name: step.request_current_owner_name,
                        })}
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
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
