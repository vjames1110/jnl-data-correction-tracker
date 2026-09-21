import {
  formatCountdown,
  formatCurrency,
  formatDate,
  formatMoneyCompact,
  formatPercent,
} from "../utils/status";

const MODULES = [
  ["structures", "Structures"],
  ["buildings", "Buildings"],
  ["girders", "Girders"],
  ["action_items", "Action items"],
];

/**
 * The combined, print-only multi-project statement - a summary
 * sheet for every project on the dashboard (the charts are screen-
 * only). Printed/saved as PDF via the browser print dialog, the same
 * convention as the single-project report.
 */
export function MultiProjectPack({
  data,
  title = "Project Monitoring - All Projects",
}) {
  const { totals, projects } = data;

  return (
    <div className="pm-report pm-pack print-only">
      <header className="pm-report__header">
        <h1 className="pm-report__title">
          {title}
        </h1>
        <p className="pm-report__subtitle">
          {totals.projects} project(s) - overall{" "}
          {formatPercent(
            totals.activities.percent_complete,
          )}{" "}
          complete
        </p>
        <p className="pm-report__generated">
          As on {formatDate(data.generated_on)}
        </p>
      </header>

      <table className="pm-report__table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Director</th>
            <th>Value</th>
            <th>Start</th>
            <th>End (incl. ext.)</th>
            <th>Time left</th>
            <th>Progress</th>
            <th>Chainage</th>
            {totals.money ? <th>Contract done</th> : null}
            <th>Hold</th>
            <th>Overdue</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.site.id}>
              <td className="pm-report__col-task">
                {project.site.site_code} -{" "}
                {project.site.project_name ||
                  project.site.site_name}
              </td>
              <td>
                {project.site.site_director_name ||
                  "-"}
              </td>
              <td>
                {formatCurrency(
                  project.site.project_value,
                )}
              </td>
              <td>
                {formatDate(project.site.start_date)}
              </td>
              <td>
                {formatDate(
                  project.site.effective_end_date,
                )}
              </td>
              <td>{formatCountdown(project.site)}</td>
              <td>
                {formatPercent(
                  project.activities.percent_complete,
                )}{" "}
                ({project.activities.done}/
                {project.activities.total})
              </td>
              <td>
                {formatPercent(project.linear.percent)}
              </td>
              {totals.money ? (
                <td>
                  {project.money
                    ? `${formatPercent(project.money.percent_done)} · ${formatMoneyCompact(project.money.balance_value)} left`
                    : "-"}
                </td>
              ) : null}
              <td>{project.activities.hold}</td>
              <td>{project.overdue.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="pm-report__section">
        <h2>Module-wise completion</h2>
        <table className="pm-report__table">
          <thead>
            <tr>
              <th>Project</th>
              {MODULES.map(([, label]) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.site.id}>
                <td className="pm-report__col-task">
                  {project.site.site_code}
                </td>
                {MODULES.map(([key]) => (
                  <td key={key}>
                    {project.modules[key].done}/
                    {project.modules[key].total}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
