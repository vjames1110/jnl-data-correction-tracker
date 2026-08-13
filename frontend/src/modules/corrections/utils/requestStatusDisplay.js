const REQUEST_STATUS_LABELS = {
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

export function formatRequestStatus(status) {
  return (
    REQUEST_STATUS_LABELS[status] ??
    String(status ?? "-").replaceAll("_", " ")
  );
}

export function requestStatusTone(status) {
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

export function formatOwner({
  employeeId,
  name,
}) {
  if (name && employeeId) {
    return `${name} (${employeeId})`;
  }

  return name || employeeId || "-";
}

export const ASSIGNABLE_REQUEST_STATUSES = [
  "APPROVED",
  "ASSIGNED",
];

export const REASSIGNABLE_REQUEST_STATUSES = [
  "ACCEPTED",
  "IN_PROGRESS",
  "ON_HOLD",
];

export const REQUESTER_REASSIGNABLE_REQUEST_STATUSES =
  ["RESOLVED", "REOPENED"];
