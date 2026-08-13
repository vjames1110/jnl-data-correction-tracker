import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Filter,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useAcceptAssignment,
  useMyAssignments,
} from "../../../hooks/useCorrectionRequests";
import {
  ACCEPTABLE_WORK_STATUSES,
  formatCodeName,
  formatDateTime,
  formatStatus,
  getAgeingLabel,
  getWorkSlaState,
  statusTone,
} from "../utils/workDisplay";

function buildParams(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) =>
        value !== "" &&
        value !== null &&
        value !== undefined,
    ),
  );
}

export function ResponsibleAssignmentsPage() {
  const [filters, setFilters] = useState({
    search: "",
    current_status: "",
    ordering: "-updated_at",
    page: 1,
  });
  const [localMessage, setLocalMessage] =
    useState("");

  const queryParams = useMemo(
    () => buildParams(filters),
    [filters],
  );
  const assignmentsQuery =
    useMyAssignments(queryParams);
  const acceptAssignment = useAcceptAssignment();

  const assignments =
    assignmentsQuery.data?.items ?? [];
  const pagination =
    assignmentsQuery.data?.meta?.pagination;

  function setFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  }

  async function handleAccept(request) {
    setLocalMessage("");

    try {
      await acceptAssignment.mutateAsync({
        id: request.id,
        payload: {},
      });
      setLocalMessage(
        `${request.reference} accepted.`,
      );
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  return (
    <div className="responsible-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Responsible Person Portal
          </span>
          <h1>Assignments</h1>
          <p>
            Search and filter ERP correction work
            assigned to you.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--tertiary"
            to="/responsible/dashboard"
          >
            Dashboard
          </Link>
        </div>
      </div>

      <SurfaceCard>
        {localMessage ? (
          <div className="inline-alert inline-alert--success user-list-alert">
            <strong>{localMessage}</strong>
          </div>
        ) : null}

        {acceptAssignment.isError ? (
          <div className="inline-alert inline-alert--error user-list-alert">
            <strong>
              {acceptAssignment.error?.message}
            </strong>
          </div>
        ) : null}

        <div className="user-request-toolbar">
          <label className="input-control">
            <Search size={16} />
            <input
              value={filters.search}
              onChange={(event) =>
                setFilter(
                  "search",
                  event.target.value,
                )
              }
              placeholder="Search reference, voucher or requester"
            />
          </label>

          <label className="filter-control">
            <Filter size={15} />
            <select
              value={filters.current_status}
              onChange={(event) =>
                setFilter(
                  "current_status",
                  event.target.value,
                )
              }
            >
              <option value="">All statuses</option>
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
              <option value="CLOSED">Closed</option>
            </select>
          </label>

          <label className="filter-control">
            <span>Order</span>
            <select
              value={filters.ordering}
              onChange={(event) =>
                setFilter(
                  "ordering",
                  event.target.value,
                )
              }
            >
              <option value="-updated_at">
                Recently updated
              </option>
              <option value="sla_deadline">
                SLA deadline
              </option>
              <option value="-submitted_at">
                Recently submitted
              </option>
              <option value="reference">
                Reference
              </option>
            </select>
          </label>
        </div>

        {assignmentsQuery.isLoading ? (
          <AppLoader label="Loading assignments..." />
        ) : assignmentsQuery.isError ? (
          <ErrorState
            title="Assignments unavailable"
            message={
              assignmentsQuery.error?.message
            }
            onRetry={assignmentsQuery.refetch}
          />
        ) : !assignments.length ? (
          <EmptyState
            title="No matching assignments"
            message="Adjust filters or wait for a new correction request to be assigned."
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
                  const canAccept =
                    ACCEPTABLE_WORK_STATUSES.includes(
                      request.current_status,
                    );

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
                        <div className="page-actions">
                          {canAccept ? (
                            <button
                              type="button"
                              className="button button--primary"
                              disabled={
                                acceptAssignment.isPending
                              }
                              onClick={() =>
                                handleAccept(
                                  request,
                                )
                              }
                            >
                              <CheckCircle2
                                size={14}
                              />
                              Accept
                            </button>
                          ) : null}
                          <Link
                            className="button button--secondary"
                            to={`/responsible/assignments/${request.id}`}
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination ? (
          <div className="pagination-bar">
            <span>
              Page {pagination.page} of{" "}
              {pagination.total_pages}
            </span>
            <div>
              <button
                type="button"
                className="button button--tertiary"
                disabled={
                  !pagination.has_previous
                }
                onClick={() =>
                  setFilter(
                    "page",
                    pagination.page - 1,
                  )
                }
              >
                Previous
              </button>
              <button
                type="button"
                className="button button--tertiary"
                disabled={!pagination.has_next}
                onClick={() =>
                  setFilter(
                    "page",
                    pagination.page + 1,
                  )
                }
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </SurfaceCard>
    </div>
  );
}
