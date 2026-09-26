import { EmptyState } from "../common/EmptyState";
import { shareOf } from "./kit/chartData";
import { SegmentBar } from "./kit/SegmentBar";
import { useChartTooltip } from "./kit/useChartTooltip";

// Same colours as everywhere else: green = good, grey = dormant,
// orange = needs attention, red = stopped.
const TOKENS = {
  ACTIVE: "complete",
  INACTIVE: "idle",
  LOCKED: "hold",
  SUSPENDED: "critical",
};

export function AccountStatusChart({ data = [] }) {
  const { frameRef, bind, node } = useChartTooltip();

  if (!data.length) {
    return (
      <EmptyState
        title="No status data"
        message="Account status distribution will appear after user records are available."
      />
    );
  }

  const segments = data.map((item) => ({
    key: item.key,
    label: item.label,
    token: TOKENS[item.key] ?? "progress",
    value: item.count,
  }));
  const total = segments.reduce(
    (sum, segment) => sum + segment.value,
    0,
  );

  return (
    <div className="pm-viz" ref={frameRef}>
      <div className="pm-viz__hero">
        <span className="pm-viz__hero-number">{total}</span>
        <span className="pm-viz__hero-caption">
          {total === 1 ? "account" : "accounts"}
        </span>
      </div>
      <SegmentBar
        title="Accounts by status"
        segments={segments}
        bind={bind}
        height={18}
      />
      <ul className="pm-viz__breakdown">
        {segments.map((segment) => (
          <li key={segment.key}>
            <span
              className={`pm-viz__key pm-viz__key--${segment.token}`}
              aria-hidden="true"
            />
            <span className="pm-viz__breakdown-name">
              {segment.label}
            </span>
            <strong>{segment.value}</strong>
            <span className="pm-viz__breakdown-share">
              {shareOf(segment.value, total)}%
            </span>
          </li>
        ))}
      </ul>
      {node}
    </div>
  );
}
