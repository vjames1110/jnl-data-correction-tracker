import {
  CheckCircle2,
  XCircle,
} from "lucide-react";

import {
  formatDateTime,
} from "../../../utils/dates";

export function RecentActivityTable({
  items = [],
}) {
  if (!items.length) {
    return (
      <div className="table-empty-state">
        No recent authentication activity
        is available.
      </div>
    );
  }

  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Event</th>
            <th>Status</th>
            <th>IP Address</th>
            <th>Date and Time</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="table-user">
                  <strong>
                    {item.user_full_name ??
                      "Unknown user"}
                  </strong>
                  <span>
                    {item.employee_id_attempted}
                  </span>
                </div>
              </td>

              <td>
                {item.event_type
                  .replaceAll("_", " ")
                  .toLowerCase()}
              </td>

              <td>
                <span
                  className={
                    item.was_successful
                      ? "status-chip status-chip--success"
                      : "status-chip status-chip--error"
                  }
                >
                  {item.was_successful ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <XCircle size={14} />
                  )}

                  {item.was_successful
                    ? "Successful"
                    : "Failed"}
                </span>
              </td>

              <td>{item.ip_address ?? "—"}</td>
              <td>
                {formatDateTime(item.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}