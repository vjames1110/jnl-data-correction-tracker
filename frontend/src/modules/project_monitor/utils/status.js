import { formatCalendarDate } from "../../../utils/dateFormat";

export const STATUS_LABELS = {
  NOT_STARTED: "Not Taken Up",
  IN_PROGRESS: "In Progress",
  COMPLETE: "Complete",
  HOLD: "Hold / Issue",
  NOT_APPLICABLE: "N/A",
};

const DOC_STATUS_LABELS = {
  NOT_STARTED: "Not Submitted",
  IN_PROGRESS: "Submitted / Under Approval",
  COMPLETE: "Approved",
  HOLD: "Hold",
  NOT_APPLICABLE: "N/A",
};

export const MATERIAL_STATUS_LABELS = {
  NOT_ORDERED: "Not Ordered",
  PO_PLACED: "PO Placed",
  PARTLY_RECEIVED: "Partly Received",
  RECEIVED: "Received At Site",
};

export function statusClass(status) {
  return String(status || "")
    .toLowerCase()
    .replace(/_/g, "-");
}

export function statusLabel(activity) {
  const labels = activity.is_doc
    ? DOC_STATUS_LABELS
    : STATUS_LABELS;
  return (
    labels[activity.status] || activity.status
  );
}

export function formatQty(value) {
  const num = Number(value);
  return Number.isNaN(num) ? value : String(num);
}

export function formatDate(value) {
  return formatCalendarDate(value) ?? "-";
}

export function activityProgressPercent(activity) {
  if (activity.status === "NOT_APPLICABLE") {
    return 0;
  }
  if (activity.status === "COMPLETE") {
    return 100;
  }
  if (activity.kind === "LENGTH") {
    const total = Number(activity.total_qty) || 0;
    const done = Number(activity.done_qty) || 0;
    return total > 0
      ? Math.min(100, (done / total) * 100)
      : 0;
  }
  return Math.min(
    100,
    Number(activity.done_qty) || 0,
  );
}

export function formatProgress(activity) {
  if (activity.status === "NOT_APPLICABLE") {
    return "-";
  }
  if (activity.kind === "LENGTH") {
    return `${formatQty(activity.done_qty)}/${formatQty(
      activity.total_qty,
    )}${activity.unit ? ` ${activity.unit}` : ""}`;
  }
  return `${formatQty(activity.done_qty)}%`;
}

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  return `₹${INR_FORMATTER.format(Number(value))}`;
}

export function formatCountdown(site) {
  if (site.days_remaining == null) {
    return "End date not set";
  }
  if (site.days_remaining < 0) {
    return `Overdue by ${Math.abs(site.days_remaining)} day(s)`;
  }
  return `${site.days_remaining} day(s) left`;
}

export function formatPercent(value) {
  return value == null ? "-" : `${value}%`;
}

/**
 * Compact rupee amounts for dashboards: crores, lakhs, else the
 * en-IN grouped figure (negative values keep their sign).
 */
export function formatMoneyCompact(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  const number = Number(value);
  const sign = number < 0 ? "-" : "";
  const abs = Math.abs(number);
  if (abs >= 1e7) {
    return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  }
  if (abs >= 1e5) {
    return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  }
  return `${sign}₹${INR_FORMATTER.format(abs)}`;
}
