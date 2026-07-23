export const REQUEST_STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
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
      "IN_PROGRESS",
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
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
