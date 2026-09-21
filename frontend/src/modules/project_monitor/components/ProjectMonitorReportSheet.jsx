import { FinancialReportSheet } from "./FinancialReportView";
import {
  formatDate,
  formatQty,
  STATUS_LABELS,
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
const DEFAULT_SECTIONS = {
  details: true,
  structures: true,
  buildings: true,
  girders: true,
  actionItems: true,
  linearWorks: true,
  financial: true,
  hr: false,
  machinery: false,
};


const SOURCE_LABELS = { MARKET: "Market", HO: "In-house" };

function monthLabel(month) {
  const [year, number] = (month || "").split("-").map(Number);
  if (!year || !number) {
    return month || "";
  }
  return new Date(year, number - 1, 1).toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric" },
  );
}

function SectionState({ state, children }) {
  if (state.isLoading) {
    return <p className="pm-report__empty">Loading...</p>;
  }
  if (state.isError || !state.summary) {
    return (
      <p className="pm-report__empty">
        This section could not be loaded.
      </p>
    );
  }
  return children(state.summary);
}

/** Month cost of labour and staff, days with something to show. */
function HrReportSection({ state, month }) {
  return (
    <section className="pm-report__section">
      <h2>Human resource - {monthLabel(month)}</h2>
      <SectionState state={state}>
        {(summary) => {
          const days = summary.days.filter(
            (day) => Number(day.total) > 0,
          );
          return (
            <>
              <table className="pm-report__table pm-report__totals">
                <thead>
                  <tr>
                    <th>Labour (man-days)</th>
                    <th>Labour cost</th>
                    <th>Staff cost</th>
                    <th>Total HR cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      {formatQty(summary.totals.labour_man_days)}
                    </td>
                    <td>{formatCurrency(summary.totals.labour_cost)}</td>
                    <td>{formatCurrency(summary.totals.staff_cost)}</td>
                    <td>
                      <strong>
                        {formatCurrency(summary.totals.total)}
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>

              {days.length === 0 ? (
                <p className="pm-report__empty">
                  No labour or staff cost recorded this month.
                </p>
              ) : (
                <table className="pm-report__table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Labour (nos)</th>
                      <th>Labour cost</th>
                      <th>Staff cost</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day) => (
                      <tr key={day.date}>
                        <td>{formatDate(day.date)}</td>
                        <td className="pm-report__num">
                          {Number(day.labour_nos)
                            ? formatQty(day.labour_nos)
                            : "-"}
                        </td>
                        <td className="pm-report__num">
                          {formatCurrency(day.labour_cost)}
                        </td>
                        <td className="pm-report__num">
                          {formatCurrency(day.staff_cost)}
                        </td>
                        <td className="pm-report__num">
                          {formatCurrency(day.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {summary.labour_by_category.length ? (
                <>
                  <h3 className="pm-report__subheading">
                    Labour by category
                  </h3>
                  <table className="pm-report__table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Man-days</th>
                        <th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.labour_by_category.map((row) => (
                        <tr key={row.category}>
                          <td>{row.category}</td>
                          <td className="pm-report__num">
                            {formatQty(row.man_days)}
                          </td>
                          <td className="pm-report__num">
                            {formatCurrency(row.cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}
            </>
          );
        }}
      </SectionState>
    </section>
  );
}

/** Month cost of machines, fuel and upkeep. */
function MachineryReportSection({ state, month }) {
  return (
    <section className="pm-report__section">
      <h2>Machinery - {monthLabel(month)}</h2>
      <SectionState state={state}>
        {(summary) => {
          const days = summary.days.filter(
            (day) => Number(day.total) > 0,
          );
          const t = summary.totals;
          return (
            <>
              <table className="pm-report__table pm-report__totals">
                <thead>
                  <tr>
                    <th>Market hire</th>
                    <th>In-house hire</th>
                    <th>Fuel</th>
                    <th>Maintenance</th>
                    <th>Other</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatCurrency(t.market_hire)}</td>
                    <td>{formatCurrency(t.ho_hire)}</td>
                    <td>{formatCurrency(t.fuel)}</td>
                    <td>{formatCurrency(t.maintenance)}</td>
                    <td>{formatCurrency(t.other)}</td>
                    <td>
                      <strong>{formatCurrency(t.total)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>

              {days.length === 0 ? (
                <p className="pm-report__empty">
                  No machinery cost recorded this month.
                </p>
              ) : (
                <table className="pm-report__table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Market hire</th>
                      <th>In-house hire</th>
                      <th>Fuel</th>
                      <th>Maintenance</th>
                      <th>Other</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day) => (
                      <tr key={day.date}>
                        <td>{formatDate(day.date)}</td>
                        <td className="pm-report__num">
                          {formatCurrency(day.market_hire)}
                        </td>
                        <td className="pm-report__num">
                          {formatCurrency(day.ho_hire)}
                        </td>
                        <td className="pm-report__num">
                          {formatCurrency(day.fuel)}
                        </td>
                        <td className="pm-report__num">
                          {formatCurrency(day.maintenance)}
                        </td>
                        <td className="pm-report__num">
                          {formatCurrency(day.other)}
                        </td>
                        <td className="pm-report__num">
                          {formatCurrency(day.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {summary.by_machine.length ||
              Number(summary.site_fuel) > 0 ? (
                <>
                  <h3 className="pm-report__subheading">
                    By machine
                  </h3>
                  <table className="pm-report__table">
                    <thead>
                      <tr>
                        <th>Machine</th>
                        <th>Source</th>
                        <th>Days / hrs</th>
                        <th>Hire</th>
                        <th>Fuel</th>
                        <th>Maintenance</th>
                        <th>Other</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.by_machine.map((row) => (
                        <tr key={row.machine}>
                          <td>
                            {row.name}
                            {row.reg_no ? ` (${row.reg_no})` : ""}
                          </td>
                          <td>
                            {SOURCE_LABELS[row.source] ?? row.source}
                          </td>
                          <td className="pm-report__num">
                            {formatQty(row.qty)}
                          </td>
                          <td className="pm-report__num">
                            {formatCurrency(row.hire)}
                          </td>
                          <td className="pm-report__num">
                            {formatCurrency(row.fuel)}
                          </td>
                          <td className="pm-report__num">
                            {formatCurrency(row.maintenance)}
                          </td>
                          <td className="pm-report__num">
                            {formatCurrency(row.other)}
                          </td>
                          <td className="pm-report__num">
                            {formatCurrency(row.total)}
                          </td>
                        </tr>
                      ))}
                      {Number(summary.site_fuel) > 0 ? (
                        <tr>
                          <td>Site fuel (no machine)</td>
                          <td>-</td>
                          <td className="pm-report__num">-</td>
                          <td className="pm-report__num">-</td>
                          <td className="pm-report__num">
                            {formatCurrency(summary.site_fuel)}
                          </td>
                          <td className="pm-report__num">-</td>
                          <td className="pm-report__num">-</td>
                          <td className="pm-report__num">
                            {formatCurrency(summary.site_fuel)}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </>
              ) : null}
            </>
          );
        }}
      </SectionState>
    </section>
  );
}

export function ProjectMonitorReportSheet({
  site,
  structures,
  buildings,
  girderJobs = [],
  actionItems = [],
  linearItems = [],
  financialReport = null,
  hr = { summary: null, isLoading: false, isError: false },
  machinery = { summary: null, isLoading: false, isError: false },
  reportMonth = "",
  sections = DEFAULT_SECTIONS,
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

      {sections.details ? (
        <>
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
        </>
      ) : null}

      {sections.structures ? (
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
      ) : null}

      {sections.buildings ? (
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
      ) : null}

      {sections.girders ? (
      <section className="pm-report__section">
        <h2>Girders, Bearings &amp; Expansion Joints</h2>
        {girderJobs.length === 0 ? (
          <p className="pm-report__empty">
            No girder jobs added yet.
          </p>
        ) : (
          girderJobs.map((job) => (
            <div
              className="pm-report__block"
              key={job.id}
            >
              <h3>
                {job.structure_kind_display} -{" "}
                {job.bridge_name}
                {job.chainage_km != null
                  ? ` (Ch. ${job.chainage_km} km)`
                  : ""}
              </h3>
              <p className="pm-report__block-progress">
                {job.overall_progress.done}/
                {job.overall_progress.total}{" "}
                activities complete -{" "}
                {job.girder_scope_display}
              </p>
              {job.groups.length > 0 ? (
                <ActivityTable
                  groups={job.groups}
                />
              ) : null}
              {job.spans.map((span) => (
                <div
                  className="pm-report__block"
                  key={span.id}
                  style={{
                    marginLeft: 16,
                  }}
                >
                  <h4>
                    Span - {span.label}
                    {span.span_length_m
                      ? ` - ${span.span_length_m} m`
                      : ""}
                    {span.drawing_no
                      ? ` - ${span.drawing_no}`
                      : ""}
                  </h4>
                  <p className="pm-report__block-progress">
                    {span.overall_progress.done}/
                    {span.overall_progress.total}{" "}
                    activities complete
                  </p>
                  <ActivityTable
                    groups={span.groups}
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </section>
      ) : null}

      {sections.actionItems ? (
      <section className="pm-report__section">
        <h2>Action Items</h2>
        {actionItems.length === 0 ? (
          <p className="pm-report__empty">
            No action items added yet.
          </p>
        ) : (
          <table className="pm-report__table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Responsibility</th>
                <th>Status</th>
                <th>Target date</th>
                <th>Overdue</th>
                <th>Remarks</th>
                <th>Latest update</th>
              </tr>
            </thead>
            <tbody>
              {actionItems.map((item) => (
                <tr key={item.id}>
                  <td className="pm-report__col-task">
                    {item.activity?.name || "-"}
                  </td>
                  <td>
                    {item.responsibility || "-"}
                  </td>
                  <td>
                    {item.activity
                      ? statusLabel(
                          item.activity,
                        )
                      : "-"}
                  </td>
                  <td>
                    {formatDate(
                      item.activity
                        ?.current_target_date,
                    )}
                  </td>
                  <td>
                    {item.is_overdue
                      ? "Yes"
                      : "No"}
                  </td>
                  <td className="pm-report__col-remark">
                    {item.remarks || "-"}
                  </td>
                  <td className="pm-report__col-remark">
                    {item.activity
                      ? latestUpdateText(
                          item.activity,
                        )
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      ) : null}

      {sections.linearWorks ? (
      <section className="pm-report__section">
        <h2>Linear Works</h2>
        {linearItems.length === 0 ? (
          <p className="pm-report__empty">
            No linear items added yet.
          </p>
        ) : (
          <>
            <table className="pm-report__table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Unit</th>
                  <th>Scope</th>
                  <th>Done</th>
                  <th>Ongoing</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {linearItems.map((item) => (
                  <tr key={item.id}>
                    <td className="pm-report__col-task">
                      {item.name}
                    </td>
                    <td>{item.unit}</td>
                    <td>
                      {formatQty(
                        item.stats.scope,
                      )}
                    </td>
                    <td>
                      {formatQty(
                        item.stats.done,
                      )}
                    </td>
                    <td>
                      {formatQty(
                        item.stats.ongoing,
                      )}
                    </td>
                    <td>
                      {formatQty(
                        item.stats.pending,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="pm-report__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>From (km)</th>
                  <th>To (km)</th>
                  <th>Qty</th>
                  <th>Side</th>
                  <th>Status</th>
                  <th>Contractor</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {linearItems
                  .flatMap((item) =>
                    item.progress_entries.map(
                      (entry) => ({
                        item,
                        entry,
                      }),
                    ),
                  )
                  .sort((a, b) =>
                    b.entry.date.localeCompare(
                      a.entry.date,
                    ),
                  )
                  .map(({ item, entry }) => (
                    <tr key={entry.id}>
                      <td>
                        {formatDate(entry.date)}
                      </td>
                      <td>{item.name}</td>
                      <td>
                        {entry.from_chainage_km}
                      </td>
                      <td>
                        {entry.to_chainage_km}
                      </td>
                      <td>{entry.qty}</td>
                      <td>{entry.side}</td>
                      <td>
                        {STATUS_LABELS[
                          entry.status
                        ] || entry.status}
                      </td>
                      <td>
                        {entry.contractor || "-"}
                      </td>
                      <td className="pm-report__col-remark">
                        {entry.remarks || "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}
      </section>
      ) : null}

      {sections.financial && financialReport ? (
        <section className="pm-report__section">
          <FinancialReportSheet
            report={financialReport}
            title="DPR & bills"
          />
        </section>
      ) : null}

      {sections.hr ? (
        <HrReportSection state={hr} month={reportMonth} />
      ) : null}

      {sections.machinery ? (
        <MachineryReportSection
          state={machinery}
          month={reportMonth}
        />
      ) : null}
    </div>
  );
}
