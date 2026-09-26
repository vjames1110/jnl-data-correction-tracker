import { EmptyState } from "../../common/EmptyState";
import { ChartLegend } from "./ChartLegend";
import { formatCount, niceScale } from "./chartData";
import { DataTableToggle } from "./DataTableToggle";
import { useChartTooltip } from "./useChartTooltip";

/**
 * Part-to-whole over categories in time (months): a thin column per
 * period, cut into series by a 2px surface gap, rounded at the top and
 * square on the baseline. `series` is `[{ key, label, token }]`; `data`
 * rows carry `xKey` and one count per series key.
 */
export function StackedColumns({
  data,
  xKey,
  series,
  formatX = String,
  unit = "entries",
  emptyTitle = "No trend data",
  emptyMessage = "Not enough history yet to chart a trend.",
}) {
  const { frameRef, bind, node } = useChartTooltip();

  const totals = (data ?? []).map((row) =>
    series.reduce(
      (sum, item) => sum + (Number(row[item.key]) || 0),
      0,
    ),
  );
  if (!data?.length || !totals.some((total) => total > 0)) {
    return (
      <EmptyState title={emptyTitle} message={emptyMessage} />
    );
  }

  const { max, ticks } = niceScale(Math.max(...totals));

  return (
    <div className="pm-viz" ref={frameRef}>
      <ChartLegend series={series} />
      <div
        className="pm-viz__cols"
        style={{ "--cols": data.length }}
      >
        <div className="pm-viz__yaxis" aria-hidden="true">
          {[...ticks].reverse().map((tick) => (
            <span key={tick}>{formatCount(tick)}</span>
          ))}
        </div>
        <div className="pm-viz__plot">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="pm-viz__gridline"
              style={{ bottom: `${(tick / max) * 100}%` }}
              aria-hidden="true"
            />
          ))}
          {data.map((row, index) => {
            const parts = series.filter(
              (item) => Number(row[item.key]) > 0,
            );
            const content = {
              title: `${formatX(row[xKey])} - ${totals[index]} ${unit}`,
              rows: series.map((item) => ({
                label: item.label,
                token: item.token,
                value: formatCount(row[item.key]),
              })),
            };
            return (
              <div
                className="pm-viz__col"
                key={String(row[xKey])}
              >
                <div
                  className="pm-viz__stack"
                  style={{
                    height: `${(totals[index] / max) * 100}%`,
                  }}
                  role="img"
                  aria-label={`${formatX(row[xKey])}: ${parts
                    .map(
                      (item) =>
                        `${row[item.key]} ${item.label}`,
                    )
                    .join(", ")}`}
                >
                  {parts.map((item) => (
                    <span
                      key={item.key}
                      className={`pm-viz__seg pm-viz__seg--${item.token}`}
                      style={{
                        flexGrow: Number(row[item.key]),
                      }}
                      {...bind(content)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="pm-viz__xlabels">
          {data.map((row) => (
            <span key={String(row[xKey])}>
              {formatX(row[xKey])}
            </span>
          ))}
        </div>
      </div>
      {node}
      <DataTableToggle
        columns={[
          { key: "x", label: "Month" },
          ...series.map((item) => ({
            key: item.key,
            label: item.label,
          })),
        ]}
        rows={data.map((row) => ({
          key: String(row[xKey]),
          cells: {
            x: formatX(row[xKey]),
            ...Object.fromEntries(
              series.map((item) => [
                item.key,
                formatCount(row[item.key]),
              ]),
            ),
          },
        }))}
      />
    </div>
  );
}
