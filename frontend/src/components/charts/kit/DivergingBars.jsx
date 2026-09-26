import { useState } from "react";

import { EmptyState } from "../../common/EmptyState";
import { ChartLegend } from "./ChartLegend";
import { DataTableToggle } from "./DataTableToggle";
import { useChartTooltip } from "./useChartTooltip";

const LEGEND = [
  { key: "loss", label: "Loss (over-use)", token: "critical" },
  { key: "saving", label: "Saving", token: "complete" },
];

/**
 * A signed measure per category: bars grow left (a loss) or right (a
 * saving) from one centre line, largest swing first - readable for
 * dozens of sites where a column chart would be a wall of labels.
 * `rows` are `{ key, label, sub, value }`; `format` prints a value.
 */
export function DivergingBars({
  rows,
  format = (value) => String(value),
  valueLabel = "Net variance",
  limit = 10,
  emptyTitle = "Nothing to show yet",
  emptyMessage = "There is no data for this period.",
}) {
  const { frameRef, bind, node } = useChartTooltip();
  const [showAll, setShowAll] = useState(false);

  const ranked = [...(rows ?? [])].sort(
    (a, b) => Math.abs(b.value) - Math.abs(a.value),
  );
  if (!ranked.length) {
    return (
      <EmptyState title={emptyTitle} message={emptyMessage} />
    );
  }

  const shown = showAll ? ranked : ranked.slice(0, limit);
  const reach = Math.max(
    ...ranked.map((row) => Math.abs(row.value)),
    1,
  );

  return (
    <div className="pm-viz" ref={frameRef}>
      <ChartLegend series={LEGEND} />
      <div className="pm-viz__rows">
        {shown.map((row) => {
          const negative = row.value < 0;
          const token = negative ? "critical" : "complete";
          return (
            <div className="pm-viz__diverge-row" key={row.key}>
              <div className="pm-viz__row-label">
                <strong>{row.label}</strong>
                {row.sub ? (
                  <span className="sub">{row.sub}</span>
                ) : null}
              </div>
              <div className="pm-viz__diverge-track">
                <span className="pm-viz__diverge-axis" />
                <span
                  className={`pm-viz__diverge-fill pm-viz__diverge-fill--${
                    negative ? "neg" : "pos"
                  } pm-viz__seg pm-viz__seg--${token}`}
                  style={{
                    width: `${(Math.abs(row.value) / reach) * 50}%`,
                  }}
                  role="img"
                  aria-label={`${row.label}: ${format(row.value)}`}
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
          );
        })}
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
      <DataTableToggle
        columns={[
          { key: "label", label: "Site" },
          { key: "value", label: valueLabel },
        ]}
        rows={ranked.map((row) => ({
          key: row.key,
          cells: {
            label: row.label,
            value: format(row.value),
          },
        }))}
      />
    </div>
  );
}
