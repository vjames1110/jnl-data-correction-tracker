import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FilePenLine,
  FileText,
  Filter,
  ListChecks,
  RotateCcw,
  Search,
  TimerReset,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useCorrectionDashboard,
  useMyCorrectionRequests,
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

export function UserDashboardPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("");

  const dashboardQuery = useCorrectionDashboard();
  const allRequestsQuery =
    useMyCorrectionRequests({
      page_size: 500,
      ordering: "-updated_at",
    });
  const summary =
    dashboardQuery.data?.summary ?? {};

  const filteredRequests = useMemo(() => {
    const items =
      allRequestsQuery.data?.items ?? [];

    return items.filter(
      (request) =>
        matchesSearch(request, search) &&
        (!statusFilter ||
          request.current_status ===
            statusFilter),
    );
  }, [
    allRequestsQuery.data,
    search,
    statusFilter,
  ]);

  return (
    <div className="user-dashboard-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Request Creator Portal
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

          <SurfaceCard title="Search Requests">
            <div className="user-request-toolbar">
              <label className="input-control">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
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
                  <option value="DRAFT">
                    Draft
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
                  <option value="REOPENED">
                    Reopened
                  </option>
                  <option value="CLOSED">
                    Closed
                  </option>
                </select>
              </label>
            </div>

            {allRequestsQuery.isLoading ? (
              <AppLoader label="Loading requests..." />
            ) : allRequestsQuery.isError ? (
              <ErrorState
                title="Requests unavailable"
                message={
                  allRequestsQuery.error?.message
                }
                onRetry={
                  allRequestsQuery.refetch
                }
              />
            ) : (
              <RequestTable
                requests={filteredRequests}
                emptyTitle="No matching requests"
                emptyMessage="Adjust the ticket number search or status filter."
              />
            )}
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
