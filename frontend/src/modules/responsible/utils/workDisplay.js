import { formatDateTime } from "../../user/utils/requestDisplay";

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
  return (
    [employeeId, name].filter(Boolean).join(" - ") ||
    "-"
  );
}

export function formatCodeName({
  code,
  name,
}) {
  return (
    [code, name].filter(Boolean).join(" ") || "-"
  );
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

const ACTIVE_WORK_STATUSES = [
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "ON_HOLD",
];

export function getWorkSlaState(request) {
  const dueAt = request?.sla_deadline;
  const now = Date.now();
  const dueTime = dueAt
    ? new Date(dueAt).getTime()
    : null;
  const isFinal = !ACTIVE_WORK_STATUSES.includes(
    request?.current_status,
  );

  if (!dueTime || Number.isNaN(dueTime)) {
    return {
      key: "no_sla",
      label: "No SLA",
      tone: "neutral",
    };
  }

  if (isFinal) {
    return {
      key: "closed",
      label: `Due ${formatDateTime(dueAt)}`,
      tone: "neutral",
    };
  }

  if (dueTime < now) {
    return {
      key: "overdue",
      label: "Overdue",
      tone: "error",
    };
  }

  if (dueTime - now <= 24 * 3_600_000) {
    return {
      key: "due_today",
      label: "Due Within 24h",
      tone: "warning",
    };
  }

  return {
    key: "on_track",
    label: `Due ${formatDateTime(dueAt)}`,
    tone: "success",
  };
}

export const ACCEPTABLE_WORK_STATUSES = [
  "ASSIGNED",
];

export const STARTABLE_WORK_STATUSES = [
  "ACCEPTED",
];

export const HOLDABLE_WORK_STATUSES = [
  "IN_PROGRESS",
];

export const RESUMABLE_WORK_STATUSES = [
  "ON_HOLD",
];

export const RESOLVABLE_WORK_STATUSES = [
  "IN_PROGRESS",
  "ON_HOLD",
];

export const REASSIGNMENT_REQUESTABLE_STATUSES = [
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "ON_HOLD",
];
