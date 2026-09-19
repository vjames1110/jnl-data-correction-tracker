import { formatDate } from "../utils/status";

const DAY_MS = 24 * 60 * 60 * 1000;

function toTime(value) {
  return value ? new Date(`${value}T00:00:00Z`).getTime() : null;
}

function todayTime() {
  return toTime(new Date().toISOString().slice(0, 10));
}

/**
 * One row per project on a shared calendar axis: the bar spans the
 * project's start to its effective end (after extensions), the darker
 * fill is its overall progress, and the vertical line is today. Plain
 * CSS - no chart library - so it prints cleanly.
 */
export function ProjectTimelineRows({ projects }) {
  const dated = projects
    .map((project) => ({
      project,
      start: toTime(project.site.start_date),
      end: toTime(
        project.site.effective_end_date ||
          project.site.end_date,
      ),
    }))
    .filter(
      (row) =>
        row.start !== null &&
        row.end !== null &&
        row.end >= row.start,
    );

  if (!dated.length) {
    return (
      <p className="pm-timeline-empty">
        Set start and end dates on a project&apos;s
        Overview page to see it on the timeline.
      </p>
    );
  }

  const today = todayTime();
  const axisMin = Math.min(...dated.map((row) => row.start));
  const axisMax = Math.max(
    ...dated.map((row) => row.end),
    today,
  );
  const span = Math.max(axisMax - axisMin, DAY_MS);
  const percentOf = (time) =>
    ((time - axisMin) / span) * 100;
  const todayLeft = percentOf(today);

  return (
    <div className="pm-gantt">
      <div className="pm-gantt__axis">
        <span>{formatDate(new Date(axisMin).toISOString().slice(0, 10))}</span>
        <span>{formatDate(new Date(axisMax).toISOString().slice(0, 10))}</span>
      </div>
      {dated.map(({ project, start, end }) => {
        const progress =
          project.activities.percent_complete ?? 0;
        const status =
          project.site.countdown_status?.toLowerCase() ||
          "none";
        return (
          <div
            className="pm-gantt__row"
            key={project.site.id}
          >
            <div className="pm-gantt__label">
              <strong>{project.site.site_code}</strong>
              <span className="sub">
                {project.site.project_name ||
                  project.site.site_name}
              </span>
            </div>
            <div className="pm-gantt__track">
              <div
                className={`pm-gantt__bar pm-gantt__bar--${status}`}
                style={{
                  left: `${percentOf(start)}%`,
                  width: `${Math.max(
                    percentOf(end) - percentOf(start),
                    1,
                  )}%`,
                }}
                title={`${formatDate(
                  project.site.start_date,
                )} to ${formatDate(
                  project.site.effective_end_date ||
                    project.site.end_date,
                )} - ${progress}% complete`}
              >
                <div
                  className="pm-gantt__fill"
                  style={{ width: `${progress}%` }}
                />
                <span className="pm-gantt__pct">
                  {progress}%
                </span>
              </div>
              <div
                className="pm-gantt__today"
                style={{ left: `${todayLeft}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
