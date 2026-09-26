import { ChartLegend as Legend } from "../../../components/charts/kit/ChartLegend";
import {
  STATUS_SERIES,
  shareOf,
  statusSegments,
} from "../../../components/charts/kit/chartData";
import {
  ChartRow,
  SegmentBar,
} from "../../../components/charts/kit/SegmentBar";
import { useChartTooltip } from "../../../components/charts/kit/useChartTooltip";
import { EmptyState } from "../../../components/common/EmptyState";
import { formatPercent } from "../utils/status";

const MODULE_ROWS = [
  { key: "structures", label: "Structures" },
  { key: "buildings", label: "Buildings" },
  { key: "girders", label: "Girders" },
  { key: "action_items", label: "Action items" },
];

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
