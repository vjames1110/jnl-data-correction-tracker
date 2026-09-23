import { formatDateTime as formatDateTimeDMY } from "../../../utils/dateFormat";

export const REQUEST_STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  ASSIGNED: "Assigned",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  RESOLVED: "Resolved",
  REOPENED: "Reopened",
  CLOSED: "Closed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export function formatStatus(status) {
  return (
    REQUEST_STATUS_LABELS[status] ??
    String(status ?? "-").replaceAll("_", " ")
  );
}

export function statusTone(status) {
  if (
    ["RESOLVED", "CLOSED", "APPROVED"].includes(
      status,
    )
  ) {
    return "success";
  }

  if (
    [
      "PENDING_APPROVAL",
      "ASSIGNED",
      "ACCEPTED",
      "IN_PROGRESS",
      "ON_HOLD",
      "REOPENED",
    ].includes(status)
  ) {
    return "warning";
  }

  if (
    ["REJECTED", "CANCELLED"].includes(status)
  ) {
    return "error";
  }

  return "neutral";
}

export function formatDate(value) {
  return formatDateTimeDMY(value, { dateOnly: true }) ?? "-";
}

export function formatDateTime(value) {
  return formatDateTimeDMY(value) ?? "-";
}
