import { useState } from "react";

import { EmptyState } from "../../common/EmptyState";
import { formatCount } from "./chartData";
import { useChartTooltip } from "./useChartTooltip";

/**
 * One measure across many categories (sites, departments, roles ...):
 * horizontal bars, longest first, the value at the tip. Single series,
 * so no legend - the card title says what is counted. Long lists show
 * the top rows with a "show all" switch.
 */
export function RankBars({
  rows,
  token = "progress",
  valueLabel = "requests",
  format = formatCount,
  limit = 10,
  emptyTitle = "Nothing to show yet",
  emptyMessage = "There is no data for this period.",
}) {
  const { frameRef, bind, node } = useChartTooltip();
  const [showAll, setShowAll] = useState(false);

  const ranked = [...(rows ?? [])]
    .filter((row) => Number(row.value) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value));

  if (!ranked.length) {
    return (
      <EmptyState title={emptyTitle} message={emptyMessage} />
    );
  }

  const shown = showAll ? ranked : ranked.slice(0, limit);
  const max = Number(ranked[0].value);

  return (
    <div className="pm-viz" ref={frameRef}>
      <div className="pm-viz__rows">
        {shown.map((row) => (
          <div className="pm-viz__rank-row" key={row.key}>
            <div className="pm-viz__row-label">
              <strong>{row.label}</strong>
              {row.sub ? (
                <span className="sub">{row.sub}</span>
              ) : null}
            </div>
            <div className="pm-viz__rank-track">
              <span
                className={`pm-viz__rank-fill pm-viz__seg pm-viz__seg--${token}`}
                style={{
                  width: `${(Number(row.value) / max) * 100}%`,
                }}
                role="img"
                aria-label={`${row.label}: ${format(row.value)} ${valueLabel}`}
                {...bind({
                  title: row.label,
                  rows: [
                    {
                      label: valueLabel,
                      token,
                      value: format(row.value),
                    },
                  ],
                })}
              />
            </div>
            <strong className="pm-viz__rank-value">
              {format(row.value)}
            </strong>
          </div>
        ))}
      </div>
      {ranked.length > limit ? (
        <button
          type="button"
          className="button button--tertiary button--sm pm-viz__more"
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll
            ? `Show top ${limit}`
            : `Show all ${ranked.length}`}
        </button>
      ) : null}
      {node}
    </div>
  );
}
