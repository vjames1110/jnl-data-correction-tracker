import { useState } from "react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import {
  projectMonitorActionItemsPath,
  projectMonitorBuildingsPath,
  projectMonitorGirdersPath,
  projectMonitorStructuresPath,
} from "../../../constants/roles";
import { useAuth } from "../../../hooks/useAuth";
import { useDueTracker } from "../../../hooks/useProjectMonitor";
import {
  formatDate,
  formatProgress,
} from "../utils/status";
import { ActivityStatusChip } from "./ActivityStatusChip";

const MODES = [
  { key: "date", label: "On this date" },
  { key: "week", label: "Week from date" },
  { key: "overdue", label: "Overdue (before date)" },
  { key: "upcoming", label: "Next 30 days" },
];

const MODULE_PATHS = {
  structures: projectMonitorStructuresPath,
  buildings: projectMonitorBuildingsPath,
  girders: projectMonitorGirdersPath,
  action_items: projectMonitorActionItemsPath,
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * What was due on a date, across every activity-based module -
 * scoped to one project when ``site`` is given, otherwise every
 * project (``showSite`` adds the project column). All filtering and
 * the current-vs-earlier target-date logic is server-side.
 */
export function DueTracker({
  site = "",
  showSite = false,
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState("upcoming");
  const [date, setDate] = useState(todayIso());

  const dueQuery = useDueTracker({
    mode,
    date,
    site,
  });
  const rows = dueQuery.data?.rows ?? [];

  return (
    <div className="pm-due-tracker">
      <div className="pm-due-tracker__controls print-hidden">
        <label className="filter-control">
          <span>Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) =>
              setDate(event.target.value)
            }
          />
        </label>
        <div className="pm-due-tracker__modes">
          {MODES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={
                mode === item.key
                  ? "button button--primary"
                  : "button button--tertiary"
              }
              onClick={() => setMode(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {dueQuery.isLoading ? (
        <AppLoader label="Loading due items..." />
      ) : dueQuery.isError ? (
        <ErrorState
          title="Due tracker unavailable"
          message={dueQuery.error?.message}
          onRetry={() => dueQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <p className="pm-timeline-empty">
          Nothing is due for this selection.
        </p>
      ) : (
        <>
          <div className="pm-table-wrap">
            <table className="pm-report__table pm-due-tracker__table">
              <thead>
                <tr>
                  <th>Target date</th>
                  {showSite ? <th>Project</th> : null}
                  <th>Module</th>
                  <th>Where</th>
                  <th>Activity</th>
                  <th>Status</th>
                  <th>Earlier dates</th>
                  <th>Last remark</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const pathFor =
                    MODULE_PATHS[row.module];
                  return (
                    <tr key={row.activity_id}>
                      <td
                        className={
                          row.is_overdue
                            ? "pm-due-tracker__overdue"
                            : ""
                        }
                      >
                        {formatDate(row.target_date)}
                      </td>
                      {showSite ? (
                        <td>
                          {row.site_code} -{" "}
                          {row.site_name}
                        </td>
                      ) : null}
                      <td>
                        {pathFor ? (
                          <Link
                            to={`${pathFor(
                              user?.role,
                            )}?site=${row.site_id}`}
                          >
                            {row.module_label}
                          </Link>
                        ) : (
                          row.module_label
                        )}
                      </td>
                      <td>
                        {row.where}
                        {row.group ? (
                          <span className="sub">
                            {" "}
                            · {row.group}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {row.name}
                        <span className="sub">
                          {" "}
                          · {formatProgress(row)}
                        </span>
                      </td>
                      <td>
                        <ActivityStatusChip
                          activity={row}
                        />
                      </td>
                      <td>
                        {row.earlier_dates.length
                          ? row.earlier_dates.map(
                              (earlier) => (
                                <s
                                  key={earlier}
                                  className="pm-due-tracker__earlier"
                                >
                                  {formatDate(earlier)}
                                </s>
                              ),
                            )
                          : "-"}
                      </td>
                      <td className="pm-report__col-remark">
                        {row.last_remark || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {dueQuery.data.truncated ? (
            <p className="pm-timeline-empty">
              Showing the first {rows.length} of{" "}
              {dueQuery.data.total} items - narrow
              the date or pick a project to see
              the rest.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
