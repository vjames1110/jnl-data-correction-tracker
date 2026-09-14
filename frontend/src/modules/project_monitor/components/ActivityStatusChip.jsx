import {
  MATERIAL_STATUS_LABELS,
  statusClass,
  statusLabel,
} from "../utils/status";

export function ActivityStatusChip({ activity }) {
  return (
    <span
      className={`pm-status-chip pm-status-chip--${statusClass(
        activity.status,
      )}`}
    >
      {statusLabel(activity)}
    </span>
  );
}

export function MaterialStatusBadge({
  activity,
}) {
  if (
    !activity.material_tracked ||
    activity.status === "NOT_APPLICABLE"
  ) {
    return null;
  }

  return (
    <span className="pm-material-badge">
      Mat:{" "}
      {MATERIAL_STATUS_LABELS[
        activity.material_status
      ] || activity.material_status}
    </span>
  );
}
