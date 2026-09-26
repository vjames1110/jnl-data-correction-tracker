import { shareOf } from "./chartData";

/**
 * A part-to-whole row: a rounded bar cut into segments by a 2px
 * surface gap, with the headline figure to its right (a direct
 * label - the bar itself carries no text). Each segment shows a
 * tooltip with every part and its share.
 */
export function SegmentBar({ title, segments, bind, height }) {
  const total = segments.reduce(
    (sum, segment) => sum + segment.value,
    0,
  );
  if (!total) {
    return (
      <div
        className="pm-viz__bar pm-viz__bar--empty"
        style={{ height }}
      />
    );
  }
  return (
    <div
      className="pm-viz__bar"
      style={{ height }}
      role="img"
      aria-label={`${title}: ${segments
        .filter((segment) => segment.value > 0)
        .map(
          (segment) =>
            `${segment.value} ${segment.label}`,
        )
        .join(", ")}`}
    >
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment) => (
          <span
            key={segment.key}
            className={`pm-viz__seg pm-viz__seg--${segment.token}`}
            style={{ flexGrow: segment.value }}
            {...bind({
              title,
              rows: segments.map((row) => ({
                label: row.label,
                token: row.token,
                value: `${row.value.toLocaleString(
                  "en-IN",
                )}${
                  row.unit ? ` ${row.unit}` : ""
                } (${shareOf(row.value, total)}%)`,
              })),
            })}
          />
        ))}
    </div>
  );
}

/** A labelled SegmentBar with its headline figure to the right. */
export function ChartRow({
  name,
  sub,
  headline,
  detail,
  title,
  segments,
  bind,
  height = 14,
}) {
  return (
    <div className="pm-viz__row">
      <div className="pm-viz__row-label">
        <strong>{name}</strong>
        {sub ? <span className="sub">{sub}</span> : null}
      </div>
      <SegmentBar
        title={title}
        segments={segments}
        bind={bind}
        height={height}
      />
      <div className="pm-viz__row-value">
        <strong>{headline}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}
