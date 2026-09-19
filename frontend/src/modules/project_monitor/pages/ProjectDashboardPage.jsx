import {
  AlertTriangle,
  CalendarClock,
  FolderKanban,
  PauseCircle,
  Printer,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { projectMonitorOverviewPath } from "../../../constants/roles";
import { useAuth } from "../../../hooks/useAuth";
import { useProjectDashboard } from "../../../hooks/useProjectMonitor";
import { KpiCard } from "../../admin/components/KpiCard";
import {
  OverallStatusChart,
  ProjectProgressChart,
} from "../components/DashboardCharts";
import { DueTracker } from "../components/DueTracker";
import { MultiProjectPack } from "../components/MultiProjectPack";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { ProjectTimelineRows } from "../components/ProjectTimelineRows";
import {
  formatCountdown,
  formatMoneyCompact,
  formatPercent,
} from "../utils/status";

const COUNTDOWN_CLASS = {
  GREEN: "pm-countdown-badge--green",
  ORANGE: "pm-countdown-badge--orange",
  RED: "pm-countdown-badge--red",
};

/**
 * Every project (= Site) on one page: headline KPIs, progress
 * charts, a start-to-end timeline row per project, a comparison
 * table, the all-projects Due tracker, and a printable combined
 * pack. Read-only - each row links through to that project's own
 * Overview.
 */
export function ProjectDashboardPage() {
  const { user } = useAuth();
  const [includeEmpty, setIncludeEmpty] =
    useState(false);
  const dashboardQuery =
    useProjectDashboard(includeEmpty);
  const data = dashboardQuery.data;

  return (
    <div className="organization-page">
      <div className="page-heading print-hidden">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>All Projects</h1>
          <p>
            Every project at a glance - progress,
            what is overdue, and how much time is
            left - with a printable combined
            statement.
          </p>
        </div>

        <div className="page-actions">
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={includeEmpty}
              onChange={(event) =>
                setIncludeEmpty(event.target.checked)
              }
            />
            Include sites with no data
          </label>
          {data ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() => window.print()}
            >
              <Printer size={16} /> Print combined
              pack
            </button>
          ) : null}
        </div>
      </div>

      <div className="print-hidden">
        <ProjectMonitorTabs
          role={user?.role}
          active="dashboard"
        />
      </div>

      {dashboardQuery.isLoading ? (
        <AppLoader label="Loading all projects..." />
      ) : dashboardQuery.isError ? (
        <ErrorState
          title="Dashboard unavailable"
          message={dashboardQuery.error?.message}
          onRetry={() => dashboardQuery.refetch()}
        />
      ) : data.projects.length === 0 ? (
        <EmptyState
          title="No projects are being monitored yet"
          message="Add structures, buildings or a project name/end date to a site and it will appear here."
        />
      ) : (
        <>
          <div className="pm-stack print-hidden">
            <section className="kpi-grid kpi-grid--compact pm-dashboard-kpis">
              <KpiCard
                label="Projects monitored"
                value={data.totals.projects}
                icon={FolderKanban}
                helper={
                  data.totals.hidden_empty_sites
                    ? `${data.totals.hidden_empty_sites} site(s) with no data hidden`
                    : "All active sites shown"
                }
              />
              <KpiCard
                label="Overall progress"
                value={formatPercent(
                  data.totals.activities
                    .percent_complete,
                )}
                icon={TrendingUp}
                tone="success"
                helper={`${data.totals.activities.done} of ${data.totals.activities.total} activities complete`}
              />
              <KpiCard
                label="Overdue items"
                value={data.totals.overdue}
                icon={AlertTriangle}
                tone="warning"
                helper={`${data.totals.overdue_action_items} of them action items`}
              />
              <KpiCard
                label="On hold"
                value={data.totals.activities.hold}
                icon={PauseCircle}
                tone="information"
                helper="Activities on hold / with an issue"
              />
              <KpiCard
                label="Ending soon"
                value={data.totals.countdown.RED}
                icon={CalendarClock}
                tone="warning"
                helper={`${data.totals.countdown.ORANGE} more within 30 days`}
              />
            </section>

            <div className="pm-dashboard-charts">
              <SurfaceCard>
                <div className="surface-card__header">
                  <h2>Progress by project</h2>
                </div>
                <ProjectProgressChart
                  projects={data.projects}
                />
              </SurfaceCard>
              <SurfaceCard>
                <div className="surface-card__header">
                  <h2>Overall status</h2>
                </div>
                <OverallStatusChart
                  activities={data.totals.activities}
                />
              </SurfaceCard>
            </div>

            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Project timeline</h2>
                <span className="sub">
                  Start to end (after extensions),
                  filled to overall progress; the
                  line is today.
                </span>
              </div>
              <ProjectTimelineRows
                projects={data.projects}
              />
            </SurfaceCard>

            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Projects</h2>
              </div>
              <div className="pm-table-wrap">
                <table className="pm-report__table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Director</th>
                      <th>Time left</th>
                      <th>Progress</th>
                      <th>Chainage</th>
                      {data.totals.money ? (
                        <th>Contract done</th>
                      ) : null}
                      <th>Hold</th>
                      <th>Overdue</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projects.map((project) => (
                      <tr key={project.site.id}>
                        <td className="pm-report__col-task">
                          <strong>
                            {project.site.site_code}
                          </strong>{" "}
                          {project.site.project_name ||
                            project.site.site_name}
                          {project.site
                            .client_or_section ? (
                            <span className="sub">
                              {" "}
                              ·{" "}
                              {
                                project.site
                                  .client_or_section
                              }
                            </span>
                          ) : null}
                        </td>
                        <td>
                          {project.site
                            .site_director_name || "-"}
                        </td>
                        <td>
                          <span
                            className={`pm-countdown-badge pm-countdown-badge--inline ${
                              COUNTDOWN_CLASS[
                                project.site
                                  .countdown_status
                              ] ||
                              "pm-countdown-badge--none"
                            }`}
                          >
                            {formatCountdown(
                              project.site,
                            )}
                          </span>
                        </td>
                        <td>
                          <div className="pm-progress-inline">
                            <div className="pm-progress-bar">
                              <div
                                className="pm-progress-bar__fill pm-progress-bar__fill--complete"
                                style={{
                                  width: `${project.activities.percent_complete ?? 0}%`,
                                }}
                              />
                            </div>
                            <span>
                              {formatPercent(
                                project.activities
                                  .percent_complete,
                              )}
                            </span>
                          </div>
                        </td>
                        <td>
                          {formatPercent(
                            project.linear.percent,
                          )}
                        </td>
                        {data.totals.money ? (
                          <td>
                            {project.money
                              ? `${formatPercent(project.money.percent_done)} · ${formatMoneyCompact(project.money.balance_value)} left`
                              : "-"}
                          </td>
                        ) : null}
                        <td>
                          {project.activities.hold}
                        </td>
                        <td
                          className={
                            project.overdue.total
                              ? "pm-due-tracker__overdue"
                              : ""
                          }
                        >
                          {project.overdue.total}
                        </td>
                        <td>
                          <Link
                            to={`${projectMonitorOverviewPath(
                              user?.role,
                            )}?site=${project.site.id}`}
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Due tracker - all projects</h2>
              </div>
              <DueTracker showSite />
            </SurfaceCard>
          </div>

          <MultiProjectPack data={data} />
        </>
      )}
    </div>
  );
}
