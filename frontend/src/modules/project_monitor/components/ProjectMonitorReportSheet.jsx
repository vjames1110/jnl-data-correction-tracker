import {
  formatDate,
  formatQty,
  statusLabel,
} from "../utils/status";

function progressText(activity) {
  if (activity.status === "NOT_APPLICABLE") {
    return "-";
  }
  if (activity.kind === "LENGTH") {
    return `${formatQty(activity.done_qty)}/${formatQty(activity.total_qty)}${
      activity.unit ? ` ${activity.unit}` : ""
    }`;
  }
  return `${formatQty(activity.done_qty)}%`;
}

function hindranceText(activity) {
  if (!activity.is_hindrance) {
    return "-";
  }
  const parts = ["Yes"];
  if (activity.hindrance_expected_removal_date) {
    parts.push(
      `expected removal ${formatDate(
        activity.hindrance_expected_removal_date,
      )}`,
    );
  }
  if (activity.hindrance_actual_removal_date) {
    parts.push(
      `removed ${formatDate(
        activity.hindrance_actual_removal_date,
      )}`,
    );
  }
  return parts.join(" - ");
}

function reviewedText(activity) {
  if (!activity.reviewed_at) {
    return "Not reviewed";
  }
  const date = new Date(
    activity.reviewed_at,
  ).toLocaleDateString();
  return `${activity.reviewed_by_name || "Someone"} - ${date}`;
}

function latestUpdateText(activity) {
  const comments = activity.comments || [];
  if (comments.length === 0) {
    return "-";
  }
  return comments[comments.length - 1].text;
}

const INR_FORMATTER = new Intl.NumberFormat(
  "en-IN",
  {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  },
);

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "Not set";
  }
  return `₹${INR_FORMATTER.format(Number(value))}`;
}

function countdownText(site) {
  if (site.days_remaining == null) {
    return "End date not set";
  }
  if (site.days_remaining < 0) {
    return `Overdue by ${Math.abs(site.days_remaining)} day(s)`;
  }
  return `${site.days_remaining} day(s) remaining`;
}

function ActivityTable({ groups }) {
  const rows = groups.flatMap((group) =>
    group.rows.map((row) => ({
      ...row,
      group_title: group.group_title,
    })),
  );

  return (
    <table className="pm-report__table">
      <thead>
        <tr>
          <th>Task</th>
          <th>Status</th>
          <th>Progress</th>
          <th>Target date</th>
          <th>Hindrance</th>
          <th>Reviewed</th>
          <th>Latest update</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="pm-report__col-task">
              {row.group_title
                ? `${row.group_title} - `
                : ""}
              {row.name}
            </td>
            <td>{statusLabel(row)}</td>
            <td>{progressText(row)}</td>
            <td>
              {formatDate(
                row.current_target_date,
              )}
            </td>
            <td>{hindranceText(row)}</td>
            <td>{reviewedText(row)}</td>
            <td className="pm-report__col-remark">
              {latestUpdateText(row)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The whole-project, task-wise progress report - every Structure and
 * every Building's activities, each row a current snapshot (status,
 * progress, target date, hindrance, review sign-off, latest logged
 * update). Pure presentational, fed the already-fetched data by its
 * caller - printed/saved as PDF via the browser's own print dialog,
 * reusing this codebase's established print-CSS convention rather
 * than a server-side PDF library.
 */
export function ProjectMonitorReportSheet({
  site,
  structures,
  buildings,
}) {
  return (
    <div className="pm-report">
      <header className="pm-report__header">
        <h1 className="pm-report__title">
          Project Monitoring Report
        </h1>
        <p className="pm-report__subtitle">
          {site.site_code} - {site.site_name}
        </p>
        <p className="pm-report__generated">
          Generated{" "}
          {new Date().toLocaleDateString()}
        </p>
      </header>

      <table className="pm-report__details">
        <tbody>
          <tr>
            <td>Project</td>
            <td>
              {site.project_name || "-"}
            </td>
          </tr>
          <tr>
            <td>Project value</td>
            <td>
              {formatCurrency(
                site.project_value,
              )}
            </td>
          </tr>
          <tr>
            <td>Start date</td>
            <td>
              {formatDate(site.start_date)}
            </td>
          </tr>
          <tr>
            <td>End date</td>
            <td>
              {formatDate(site.end_date)}
            </td>
          </tr>
          {site.effective_end_date &&
          site.effective_end_date !==
            site.end_date ? (
            <tr>
              <td>
                Effective end date (after
                extensions)
              </td>
              <td>
                {formatDate(
                  site.effective_end_date,
                )}
              </td>
            </tr>
          ) : null}
          <tr>
            <td>Time remaining</td>
            <td>{countdownText(site)}</td>
          </tr>
          <tr>
            <td>Client / Section</td>
            <td>
              {site.client_or_section || "-"}
            </td>
          </tr>
          <tr>
            <td>Chainage</td>
            <td>
              {site.chainage_start_km != null &&
              site.chainage_end_km != null
                ? `${site.chainage_start_km} km - ${site.chainage_end_km} km`
                : "Not set"}
            </td>
          </tr>
          <tr>
            <td>Director</td>
            <td>
              {site.site_director_name ||
                "Not assigned"}
            </td>
          </tr>
          <tr>
            <td>Site PM</td>
            <td>
              {site.site_hod_name ||
                "Not assigned"}
            </td>
          </tr>
        </tbody>
      </table>

      {(site.extensions || []).length > 0 ? (
        <table className="pm-report__table pm-report__extensions">
          <thead>
            <tr>
              <th></th>
              <th>New end date</th>
              <th>Reason</th>
              <th>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {site.extensions.map(
              (extension, index) => (
                <tr key={extension.id}>
                  <td>E{index + 1}</td>
                  <td>
                    {formatDate(
                      extension.new_end_date,
                    )}
                  </td>
                  <td>
                    {extension.reason || "-"}
                  </td>
                  <td>
                    {extension.created_by_name ||
                      "-"}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      ) : null}

      <section className="pm-report__section">
        <h2>Structures</h2>
        {structures.length === 0 ? (
          <p className="pm-report__empty">
            No structures added yet.
          </p>
        ) : (
          structures.map((structure) => (
            <div
              className="pm-report__block"
              key={structure.id}
            >
              <h3>
                {structure.structure_type_name} -{" "}
                {structure.name}
                {structure.chainage_km != null
                  ? ` (Ch. ${structure.chainage_km} km)`
                  : ""}
              </h3>
              <p className="pm-report__block-progress">
                {
                  structure.overall_progress
                    .done
                }
                /
                {
                  structure.overall_progress
                    .total
                }{" "}
                activities complete
              </p>
              <ActivityTable
                groups={structure.groups}
              />
            </div>
          ))
        )}
      </section>

      <section className="pm-report__section">
        <h2>Buildings</h2>
        {buildings.length === 0 ? (
          <p className="pm-report__empty">
            No buildings added yet.
          </p>
        ) : (
          buildings.map((building) => (
            <div
              className="pm-report__block"
              key={building.id}
            >
              <h3>
                {building.name}
                {building.station_label
                  ? ` - ${building.station_label}`
                  : ""}
                {building.chainage_km != null
                  ? ` (Ch. ${building.chainage_km} km)`
                  : ""}
              </h3>
              <p className="pm-report__block-progress">
                {
                  building.overall_progress
                    .done
                }
                /
                {
                  building.overall_progress
                    .total
                }{" "}
                activities complete
              </p>
              <ActivityTable
                groups={building.groups}
              />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
