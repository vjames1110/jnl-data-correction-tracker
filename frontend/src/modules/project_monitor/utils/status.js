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
  if (!value) {
    return "-";
  }
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
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
