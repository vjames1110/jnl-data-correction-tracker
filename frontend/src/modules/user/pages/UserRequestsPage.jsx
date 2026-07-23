import { useMemo, useState } from "react";
import {
  Filter,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useDeleteCorrectionDraft,
  useMyCorrectionRequests,
} from "../../../hooks/useCorrectionRequests";
import { RequestTable } from "../components/RequestTable";

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

export function UserRequestsPage() {
  const [filters, setFilters] = useState({
    search: "",
    current_status: "",
    ordering: "-updated_at",
    page: 1,
  });

  const queryParams = useMemo(
    () => buildParams(filters),
    [filters],
  );
  const requestsQuery =
    useMyCorrectionRequests(queryParams);
  const deleteDraft =
    useDeleteCorrectionDraft();
  const requests =
    requestsQuery.data?.items ?? [];
  const pagination =
    requestsQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleDeleteDraft = async (request) => {
    const confirmed = window.confirm(
      `Delete draft ${request.reference}?`,
    );

    if (!confirmed) {
      return;
    }

    await deleteDraft.mutateAsync(request.id);
  };

  return (
    <div className="user-requests-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Request Register
          </span>
          <h1>My Requests</h1>
          <p>
            Search and filter correction trackers
            created by you.
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
            Create Tracker
          </Link>
        </div>
      </div>

      <SurfaceCard>
        {deleteDraft.error ? (
          <div className="inline-alert inline-alert--error user-list-alert">
            <strong>
              {deleteDraft.error.message}
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
              placeholder="Search reference, voucher or description"
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
              <option value="DRAFT">Draft</option>
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
        ) : (
          <RequestTable
            requests={requests}
            emptyTitle="No matching requests"
            emptyMessage="Adjust filters or create a new tracker."
            showActions
            onDeleteDraft={handleDeleteDraft}
          />
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
