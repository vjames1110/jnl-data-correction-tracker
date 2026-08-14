import { useMemo, useState } from "react";
import { Filter, Search, X } from "lucide-react";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useCorrectionRequests,
} from "../../../hooks/useCorrectionRequests";
import { formatDateTime } from "../../../utils/dates";
import { AssignmentPanel } from "../../corrections/components/AssignmentPanel";
import {
  ASSIGNABLE_REQUEST_STATUSES,
  formatOwner,
  formatRequestStatus,
  REASSIGNABLE_REQUEST_STATUSES,
  requestStatusTone,
} from "../../corrections/utils/requestStatusDisplay";

const STATUS_OPTIONS = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "ON_HOLD",
  "RESOLVED",
  "REOPENED",
  "CLOSED",
  "REJECTED",
  "CANCELLED",
];

const NEEDS_ASSIGNMENT_STATUSES = [
  ...ASSIGNABLE_REQUEST_STATUSES,
  ...REASSIGNABLE_REQUEST_STATUSES,
];

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

function RequestDetailsDrawer({
  request,
  onClose,
}) {
  return (
    <aside className="details-drawer">
      <div className="details-drawer__header">
        <div>
          <span className="page-eyebrow">
            Request Details
          </span>
          <h2>{request.reference}</h2>
          <p>
            {request.voucher_number || "-"} &middot;{" "}
            {request.voucher_name || "-"}
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={18} />
        </button>
      </div>

      <span
        className={`request-status request-status--${requestStatusTone(
          request.current_status,
        )}`}
      >
        {formatRequestStatus(
          request.current_status,
        )}
      </span>

      <dl className="details-list">
        <div>
          <dt>Requester</dt>
          <dd>
            {formatOwner({
              employeeId:
                request.requester_employee_id,
              name: request.requester_name,
            })}
          </dd>
        </div>
        <div>
          <dt>Site / Department</dt>
          <dd>
            {request.site_name || "-"} /{" "}
            {request.department_name || "-"}
          </dd>
        </div>
        <div>
          <dt>Current Owner</dt>
          <dd>
            {formatOwner({
              employeeId:
                request.current_owner_employee_id,
              name: request.current_owner_name,
            })}
          </dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{request.priority_name || "-"}</dd>
        </div>
        <div>
          <dt>Site PM</dt>
          <dd>
            {formatOwner({
              employeeId:
                request.site_pm_employee_id,
              name: request.site_pm_name,
            })}
          </dd>
        </div>
        <div>
          <dt>Root Cause Person</dt>
          <dd>
            {formatOwner({
              employeeId:
                request.root_cause_person_employee_id,
              name: request.root_cause_person_name,
            })}
          </dd>
        </div>
        <div>
          <dt>HO / Site Work Authority</dt>
          <dd>
            {formatOwner({
              employeeId:
                request.ho_work_authority_employee_id,
              name: request.ho_work_authority_name,
            })}{" "}
            /{" "}
            {formatOwner({
              employeeId:
                request.site_work_authority_employee_id,
              name: request.site_work_authority_name,
            })}
          </dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>
            {formatDateTime(request.submitted_at)}
          </dd>
        </div>
        <div>
          <dt>SLA Deadline</dt>
          <dd>
            {formatDateTime(request.sla_deadline)}
          </dd>
        </div>
        <div>
          <dt>Description</dt>
          <dd>{request.description || "-"}</dd>
        </div>
      </dl>

      <AssignmentPanel request={request} />
    </aside>
  );
}

export function CorrectionRequestManagementPage() {
  const [filters, setFilters] = useState({
    search: "",
    current_status: "",
    ordering: "-updated_at",
    page: 1,
  });
  const [selectedId, setSelectedId] =
    useState(null);

  const queryParams = useMemo(
    () => buildParams(filters),
    [filters],
  );
  const requestsQuery = useCorrectionRequests(
    queryParams,
  );
  const requests =
    requestsQuery.data?.items ?? [];
  const pagination =
    requestsQuery.data?.meta?.pagination;
  const selectedRequest = requests.find(
    (request) => request.id === selectedId,
  );

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  return (
    <div className="admin-page-container">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Correction Requests
          </span>
          <h1>All Requests</h1>
          <p>
            Track every correction request and
            assign a Work Assignee when needed.
          </p>
        </div>
      </div>

      <SurfaceCard>
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
              <option value="">
                All statuses
              </option>
              {STATUS_OPTIONS.map((option) => (
                <option
                  key={option}
                  value={option}
                >
                  {formatRequestStatus(option)}
                </option>
              ))}
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
              <option value="-created_at">
                Recently created
              </option>
              <option value="reference">
                Reference
              </option>
              <option value="sla_deadline">
                SLA deadline
              </option>
            </select>
          </label>
        </div>

        {requestsQuery.isLoading ? (
          <AppLoader label="Loading requests..." />
        ) : requestsQuery.isError ? (
          <ErrorState
            title="Requests unavailable"
            message={requestsQuery.error?.message}
            onRetry={requestsQuery.refetch}
          />
        ) : !requests.length ? (
          <EmptyState
            title="No requests found"
            message="Adjust filters to find correction requests."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table user-request-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Requester</th>
                  <th>Site / Department</th>
                  <th>Voucher</th>
                  <th>Status</th>
                  <th>Current Owner</th>
                  <th>SLA</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <strong>
                        {request.reference}
                      </strong>
                      <span className="table-subtext">
                        {formatDateTime(
                          request.submitted_at,
                        )}
                      </span>
                    </td>
                    <td>
                      {formatOwner({
                        employeeId:
                          request.requester_employee_id,
                        name: request.requester_name,
                      })}
                    </td>
                    <td>
                      {request.site_code || "-"}
                      <span className="table-subtext">
                        {request.department_code ||
                          "-"}
                      </span>
                    </td>
                    <td>
                      {request.voucher_number || "-"}
                      <span className="table-subtext">
                        {request.voucher_name || "-"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`request-status request-status--${requestStatusTone(
                          request.current_status,
                        )}`}
                      >
                        {formatRequestStatus(
                          request.current_status,
                        )}
                      </span>
                    </td>
                    <td>
                      {formatOwner({
                        employeeId:
                          request.current_owner_employee_id,
                        name: request.current_owner_name,
                      })}
                    </td>
                    <td>
                      {formatDateTime(
                        request.sla_deadline,
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() =>
                          setSelectedId(request.id)
                        }
                      >
                        {NEEDS_ASSIGNMENT_STATUSES.includes(
                          request.current_status,
                        )
                          ? "Assign"
                          : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
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

      {selectedRequest ? (
        <RequestDetailsDrawer
          request={selectedRequest}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
