import { EmptyState } from "../../../components/common/EmptyState";
import {
  FilePenLine,
  Eye,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  formatDate,
  formatDateTime,
  formatStatus,
  statusTone,
} from "../utils/requestDisplay";

export function RequestTable({
  requests,
  emptyTitle = "No requests found",
  emptyMessage = "Create a tracker to begin.",
  onDeleteDraft,
  showActions = false,
}) {
  if (!requests.length) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
      />
    );
  }

  return (
    <div className="data-table-wrapper">
      <table className="data-table user-request-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Voucher</th>
            <th>Action</th>
            <th>Submitted</th>
            <th>ERP</th>
            <th>Status</th>
            <th>Current Approver</th>
            <th>SLA</th>
            <th>Latest Update</th>
            {showActions ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td>
                <strong>{request.reference}</strong>
                <span className="table-subtext">
                  {formatDate(request.created_at)}
                </span>
              </td>
              <td>
                {request.voucher_number || "-"}
                <span className="table-subtext">
                  {request.voucher_name || "-"}
                </span>
              </td>
              <td>
                {request.work_type_name || "-"}
                <span className="table-subtext">
                  {request.reason_name || "-"}
                </span>
              </td>
              <td>
                {formatDate(
                  request.submitted_at,
                )}
              </td>
              <td>
                {request.erp_module_code || "-"}
                <span className="table-subtext">
                  {request.department_code || "-"}
                </span>
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
                {request.current_owner_employee_id ||
                  "-"}
                <span className="table-subtext">
                  {request.priority_name || "-"}
                </span>
              </td>
              <td>
                {formatDateTime(
                  request.sla_deadline,
                )}
              </td>
              <td>
                {formatDateTime(request.updated_at)}
              </td>
              {showActions ? (
                <td>
                  <div className="table-actions user-table-actions">
                    <Link
                      className="button button--tertiary employee-table-action"
                      to={`/user/requests/${request.id}`}
                    >
                      <Eye size={15} />
                      View
                    </Link>
                    {request.current_status ===
                    "DRAFT" ? (
                      <>
                      <Link
                        className="button button--tertiary employee-table-action"
                        to={`/user/requests/${request.id}/continue`}
                      >
                        <FilePenLine size={15} />
                        Continue
                      </Link>
                      <button
                        type="button"
                        className="button button--tertiary employee-table-action"
                        onClick={() =>
                          onDeleteDraft?.(request)
                        }
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                      </>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
