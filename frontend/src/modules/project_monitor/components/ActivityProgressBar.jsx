import {
  activityProgressPercent,
  formatQty,
  statusClass,
} from "../utils/status";

export function ActivityProgressBar({ activity }) {
  if (activity.status === "NOT_APPLICABLE") {
    return (
      <span className="pm-progress-inline">
        <small>N/A</small>
      </span>
    );
  }

  const pct = activityProgressPercent(activity);
  const isLength = activity.kind === "LENGTH";

  return (
    <span className="pm-progress-inline">
      <span className="pm-progress-bar">
        <span
          className={`pm-progress-bar__fill pm-progress-bar__fill--${statusClass(
            activity.status,
          )}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <small>
        {isLength
          ? `${formatQty(activity.done_qty)}/${formatQty(
              activity.total_qty,
            )} ${activity.unit || ""}`.trim()
          : `${pct.toFixed(0)}%`}
      </small>
    </span>
  );
}
