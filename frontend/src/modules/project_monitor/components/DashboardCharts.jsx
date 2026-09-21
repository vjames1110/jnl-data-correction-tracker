import { useRef, useState } from "react";

import { EmptyState } from "../../../components/common/EmptyState";
import { formatPercent } from "../utils/status";

/**
 * Status colours for the All Projects charts - one set, used by every
 * chart on the page so a colour always means the same state. They
 * live in project-monitor.css as `--viz-*` tokens; the keys here only
 * pick the token. Grey is "no state yet" (context), not a warning.
 */
const STATUS_SERIES = [
  { key: "done", label: "Complete", token: "complete" },
  {
    key: "in_progress",
    label: "In progress",
    token: "progress",
  },
  { key: "hold", label: "Hold / issue", token: "hold" },
  {
    key: "not_started",
    label: "Not taken up",
    token: "idle",
  },
];

const MODULE_ROWS = [
  { key: "structures", label: "Structures" },
  { key: "buildings", label: "Buildings" },
  { key: "girders", label: "Girders" },
  { key: "action_items", label: "Action items" },
];

function shareOf(value, total) {
  return total ? Math.round((value * 100) / total) : 0;
}

/**
 * One tooltip for a whole chart. Each mark spreads `bind(content)`
 * to get pointer + keyboard-focus behaviour; the tip follows the
 * pointer (or sits over the focused mark) inside the chart frame.
 */
function useChartTooltip() {
  const frameRef = useRef(null);
  const [tip, setTip] = useState(null);

  const show = (x, y, content) => setTip({ x, y, content });
  const hide = () => setTip(null);

  const bind = (content) => ({
    tabIndex: 0,
    onPointerMove: (event) => {
      const frame = frameRef.current?.getBoundingClientRect();
      if (frame) {
        show(
          event.clientX - frame.left,
          event.clientY - frame.top,
          content,
        );
      }
    },
    onPointerLeave: hide,
    onFocus: (event) => {
      const frame = frameRef.current?.getBoundingClientRect();
      const mark = event.currentTarget.getBoundingClientRect();
      if (frame) {
        show(
          mark.left - frame.left + mark.width / 2,
          mark.top - frame.top,
          content,
        );
      }
    },
    onBlur: hide,
  });

  const node = tip ? (
    <div
      className={
        tip.y < 130
          ? "pm-viz__tip pm-viz__tip--below"
          : "pm-viz__tip"
      }
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      <div className="pm-viz__tip-title">
        {tip.content.title}
      </div>
      {tip.content.rows.map((row) => (
        <div className="pm-viz__tip-row" key={row.label}>
          <span
            className={`pm-viz__key pm-viz__key--${row.token}`}
            aria-hidden="true"
          />
          <strong>{row.value}</strong>
          <span>{row.label}</span>
        </div>
      ))}
    </div>
  ) : null;

  return { frameRef, bind, node };
}

function Legend({ series }) {
  return (
    <ul className="pm-viz__legend">
      {series.map((item) => (
        <li key={item.key}>
          <span
            className={`pm-viz__key pm-viz__key--${item.token}`}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * A part-to-whole row: a rounded bar cut into segments by a 2px
 * surface gap, with the headline figure to its right (a direct
 * label - the bar itself carries no text).
 */
function SegmentBar({ title, segments, bind, height }) {
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

function statusSegments(counts) {
  return STATUS_SERIES.map((series) => ({
    key: series.key,
    label: series.label,
    token: series.token,
    value: counts[series.key] ?? 0,
  }));
}

function ChartRow({
  name,
  sub,
  headline,
  detail,
  title,
  segments,
  bind,
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
        height={14}
      />
      <div className="pm-viz__row-value">
        <strong>{headline}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

export function ProjectProgressChart({ projects }) {
  const { frameRef, bind, node } = useChartTooltip();
  const rows = projects.filter(
    (project) => project.activities.total > 0,
  );

  if (!rows.length) {
    return (
      <EmptyState
        title="No progress data yet"
        message="Progress by project appears once activities exist."
      />
    );
  }

  return (
    <div className="pm-viz" ref={frameRef}>
      <Legend series={STATUS_SERIES} />
      <div className="pm-viz__rows">
        {rows.map((project) => (
          <ChartRow
            key={project.site.id}
            name={project.site.site_code}
            sub={
              project.site.project_name ||
              project.site.site_name
            }
            title={`${project.site.site_code} - ${project.activities.total} activities`}
            segments={statusSegments(project.activities)}
            bind={bind}
            headline={formatPercent(
              project.activities.percent_complete,
            )}
            detail={`${project.activities.done} of ${project.activities.total}`}
          />
        ))}
      </div>
      {node}
    </div>
  );
}

export function OverallStatusChart({ activities }) {
  const { frameRef, bind, node } = useChartTooltip();
  const segments = statusSegments(activities);
  const total = activities.total ?? 0;

  if (!total) {
    return (
      <EmptyState
        title="No activities yet"
        message="The overall status split appears once activities exist."
      />
    );
  }

  return (
    <div className="pm-viz" ref={frameRef}>
      <div className="pm-viz__hero">
        <span className="pm-viz__hero-number">
          {formatPercent(activities.percent_complete)}
        </span>
        <span className="pm-viz__hero-caption">
          complete - {activities.done} of {total}{" "}
          activities
        </span>
      </div>
      <SegmentBar
        title="All activities"
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

/**
 * Where the work stands by kind of work across the projects shown:
 * the four activity modules (same status colours) plus linear works
 * by metres completed against scope.
 */
export function ModuleProgressChart({ projects }) {
  const { frameRef, bind, node } = useChartTooltip();

  const rows = MODULE_ROWS.map((module) => {
    const counts = {
      total: 0,
      done: 0,
      in_progress: 0,
      hold: 0,
      not_started: 0,
    };
    projects.forEach((project) => {
      const block = project.modules?.[module.key];
      if (!block) return;
      Object.keys(counts).forEach((field) => {
        counts[field] += block[field] ?? 0;
      });
    });
    return { ...module, counts };
  }).filter((row) => row.counts.total > 0);

  const linearDone = projects.reduce(
    (sum, project) => sum + (project.linear?.done_m ?? 0),
    0,
  );
  const linearScope = projects.reduce(
    (sum, project) => sum + (project.linear?.scope_m ?? 0),
    0,
  );

  if (!rows.length && !linearScope) {
    return (
      <EmptyState
        title="No work recorded yet"
        message="Progress by kind of work appears once activities or linear works exist."
      />
    );
  }

  return (
    <div className="pm-viz" ref={frameRef}>
      <Legend series={STATUS_SERIES} />
      <div className="pm-viz__rows">
        {rows.map((row) => (
          <ChartRow
            key={row.key}
            name={row.label}
            title={`${row.label} - ${row.counts.total} activities`}
            segments={statusSegments(row.counts)}
            bind={bind}
            headline={formatPercent(
              row.counts.total
                ? Math.round(
                    (row.counts.done / row.counts.total) *
                      1000,
                  ) / 10
                : null,
            )}
            detail={`${row.counts.done} of ${row.counts.total}`}
          />
        ))}
        {linearScope > 0 ? (
          <ChartRow
            name="Linear works"
            title={`Linear works - ${Math.round(linearScope).toLocaleString("en-IN")} m in scope`}
            segments={[
              {
                key: "done",
                label: "Complete",
                token: "complete",
                unit: "m",
                value: Math.round(linearDone),
              },
              {
                key: "remaining",
                label: "Remaining",
                token: "idle",
                unit: "m",
                value: Math.max(
                  Math.round(linearScope - linearDone),
                  0,
                ),
              },
            ]}
            bind={bind}
            headline={formatPercent(
              Math.round((linearDone / linearScope) * 1000) /
                10,
            )}
            detail={`${Math.round(linearDone).toLocaleString("en-IN")} of ${Math.round(linearScope).toLocaleString("en-IN")} m`}
          />
        ) : null}
      </div>
      {node}
    </div>
  );
}
