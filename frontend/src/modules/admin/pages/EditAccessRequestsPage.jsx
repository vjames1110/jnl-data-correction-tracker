import { useState } from "react";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useDenyEditAccessRequest,
  useEditAccessRequests,
  useGrantEditAccessRequest,
} from "../../../hooks/useProjectMonitor";
import { formatDateTime } from "../../project_monitor/utils/status";
import { WorkspaceSwitch } from "../../project_monitor/components/WorkspaceSwitch";

const FILTERS = [
  { key: "PENDING", label: "Pending" },
  { key: "GRANTED", label: "Granted" },
  { key: "DENIED", label: "Denied" },
  { key: "", label: "All" },
];

function RequestRow({ request, onDecide, isDeciding }) {
  const [remarks, setRemarks] = useState("");
  const isPending = request.status === "PENDING";

  return (
    <tr>
      <td>
        <strong>{request.activity_name}</strong>
        <div className="sub">
          {request.activity_group_title}
          {request.parent_label
            ? ` · ${request.parent_label}`
            : ""}
        </div>
      </td>
      <td>{request.site_name || "-"}</td>
      <td>{request.requested_by_name || "-"}</td>
      <td>{formatDateTime(request.created_at)}</td>
      <td>{request.reason || "-"}</td>
      <td>
        {isPending ? (
          <span className="status-chip status-chip--warning">
            Pending
          </span>
        ) : (
          <>
            <span
              className={
                request.status === "GRANTED"
                  ? "status-chip status-chip--success"
                  : "status-chip status-chip--error"
              }
            >
              {request.status === "GRANTED"
                ? "Granted"
                : "Denied"}
            </span>
            <div className="sub">
              by {request.decided_by_name || "-"} on{" "}
              {formatDateTime(request.decided_at)}
              {request.decision_remarks
                ? ` - "${request.decision_remarks}"`
                : ""}
            </div>
          </>
        )}
      </td>
      <td>
        {isPending ? (
          <div className="table-actions">
            <input
              type="text"
              aria-label={`Remarks for ${request.activity_name}`}
              placeholder="Remarks (optional)"
              value={remarks}
              onChange={(event) =>
                setRemarks(event.target.value)
              }
            />
            <button
              type="button"
              className="button button--primary button--sm"
              disabled={isDeciding}
              onClick={() =>
                onDecide(request.id, "grant", remarks)
              }
            >
              Grant 48h
            </button>
            <button
              type="button"
              className="button button--danger-ghost button--sm"
              disabled={isDeciding}
              onClick={() =>
                onDecide(request.id, "deny", remarks)
              }
            >
              Deny
            </button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * The "request section" for the 48-hour edit/delete window: every
 * Project Manager/Incharge request to keep editing or hiding a task
 * past its window, for an Admin or Director to grant (one more
 * 48-hour window, from the moment it's granted) or deny.
 */
export function EditAccessRequestsPage() {
  const [filter, setFilter] = useState("PENDING");

  const requestsQuery = useEditAccessRequests(
    filter ? { status: filter } : {},
  );
  const grant = useGrantEditAccessRequest();
  const deny = useDenyEditAccessRequest();

  const requests = requestsQuery.data || [];

  const handleDecide = (requestId, action, remarks) => {
    const mutation = action === "grant" ? grant : deny;
    mutation.mutate({
      requestId,
      payload: { remarks },
    });
  };

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Edit Access Requests</h1>
          <p>
            A Project Manager or Incharge may only edit or hide a
            task for 48 hours after it was last touched. Past that,
            they need your go-ahead here - granting gives them
            another 48 hours on that one task.
          </p>
        </div>
      </div>

      <WorkspaceSwitch
        label="Filter by status"
        value={filter}
        onChange={setFilter}
        options={FILTERS}
      />

      {(grant.isError || deny.isError) && (
        <div className="inline-alert inline-alert--error">
          {(grant.error || deny.error)?.message}
        </div>
      )}

      {requestsQuery.isLoading ? (
        <AppLoader label="Loading requests..." />
      ) : requestsQuery.isError ? (
        <ErrorState
          title="Edit access requests unavailable"
          message={requestsQuery.error?.message}
          onRetry={requestsQuery.refetch}
        />
      ) : requests.length === 0 ? (
        <EmptyState
          title="Nothing here"
          message="No edit access requests match this filter."
        />
      ) : (
        <SurfaceCard>
          <div className="pm-table-wrap">
            <table className="pm-activity-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Requested by</th>
                  <th>Requested on</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    onDecide={handleDecide}
                    isDeciding={
                      grant.isPending || deny.isPending
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
