import {
  formatDateTime,
  formatStatus,
  statusTone,
} from "../../user/utils/requestDisplay";

export {
  formatDate,
  formatDateTime,
  formatStatus,
  statusTone,
} from "../../user/utils/requestDisplay";

export function formatPerson({
  employeeId,
  name,
}) {
  return [employeeId, name]
    .filter(Boolean)
    .join(" - ") || "-";
}

export function formatCodeName({
  code,
  name,
}) {
  return [code, name].filter(Boolean).join(" ") || "-";
}

export function getAgeingLabel(value) {
  if (!value) {
    return "-";
  }

  const started = new Date(value).getTime();
  if (Number.isNaN(started)) {
    return "-";
  }

  const hours = Math.max(
    0,
    Math.floor((Date.now() - started) / 3_600_000),
  );

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return remainingHours
    ? `${days}d ${remainingHours}h`
    : `${days}d`;
}

export function getAgeingBucket(value) {
  if (!value) {
    return "unknown";
  }

  const started = new Date(value).getTime();
  if (Number.isNaN(started)) {
    return "unknown";
  }

  const hours =
    (Date.now() - started) / 3_600_000;

  if (hours <= 24) {
    return "0-24";
  }
  if (hours <= 48) {
    return "24-48";
  }

  return "48-plus";
}

export function getSlaState(step) {
  const dueAt =
    step?.due_at || step?.request_sla_deadline;
  const escalateAt = step?.escalates_at;
  const now = Date.now();
  const dueTime = dueAt
    ? new Date(dueAt).getTime()
    : null;
  const escalateTime = escalateAt
    ? new Date(escalateAt).getTime()
    : null;

  if (
    dueTime &&
    !Number.isNaN(dueTime) &&
    dueTime < now
  ) {
    return {
      key: "overdue",
      label: "Overdue",
      tone: "error",
    };
  }

  if (
    escalateTime &&
    !Number.isNaN(escalateTime) &&
    escalateTime < now
  ) {
    return {
      key: "escalation",
      label: "Escalation Due",
      tone: "error",
    };
  }

  if (
    dueTime &&
    !Number.isNaN(dueTime) &&
    dueTime - now <= 24 * 3_600_000
  ) {
    return {
      key: "due_today",
      label: "Due Within 24h",
      tone: "warning",
    };
  }

  return {
    key: "on_track",
    label: dueAt
      ? `Due ${formatDateTime(dueAt)}`
      : "No SLA",
    tone: "success",
  };
}

export function approvalStatusTone(status) {
  if (status === "APPROVED") {
    return "success";
  }
  if (status === "REJECTED") {
    return "error";
  }
  if (status === "PENDING") {
    return "warning";
  }

  return statusTone(status);
}

export function formatApprovalStatus(status) {
  if (!status) {
    return "-";
  }

  return formatStatus(status);
}
