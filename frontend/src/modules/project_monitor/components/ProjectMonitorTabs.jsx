import clsx from "clsx";
import { Link, useSearchParams } from "react-router-dom";

import {
  useOverdueCounts,
  useVisibleTasks,
} from "../../../hooks/useProjectMonitor";
import {
  projectMonitorActionItemsPath,
  projectMonitorBuildingsPath,
  projectMonitorCostingPath,
  projectMonitorDashboardPath,
  projectMonitorDprBillsPath,
  projectMonitorGirdersPath,
  projectMonitorHrPath,
  projectMonitorLinearWorksPath,
  projectMonitorMachineryPath,
  projectMonitorOverviewPath,
  projectMonitorReportsPath,
  isDepartmentRole,
  projectMonitorStructuresPath,
  seesCosting,
  seesEveryProject,
} from "../../../constants/roles";

export function ProjectMonitorTabs({ role, active }) {
  const [searchParams] = useSearchParams();
  const site = searchParams.get("site");
  const query = site ? `?site=${site}` : "";
  // The departments see no progress data, so no overdue badges.
  const overdueQuery = useOverdueCounts(
    isDepartmentRole(role) ? null : site,
  );
  const overdue = overdueQuery.data ?? {};
  const visible = useVisibleTasks(site);

  const tabs = [
    {
      key: "dashboard",
      label: seesEveryProject(role)
        ? "All Projects"
        : "My Projects",
      path: projectMonitorDashboardPath(role),
      keepSite: false,
    },
    {
      key: "overview",
      label: "Overview",
      path: projectMonitorOverviewPath(role),
    },
    {
      key: "structures",
      task: "STRUCTURES",
      overdueKey: "structures",
      label: "Structures",
      path: projectMonitorStructuresPath(role),
    },
    {
      key: "buildings",
      task: "BUILDINGS",
      overdueKey: "buildings",
      label: "Buildings",
      path: projectMonitorBuildingsPath(role),
    },
    {
      key: "girders",
      task: "GIRDERS",
      overdueKey: "girders",
      label: "Girders",
      path: projectMonitorGirdersPath(role),
    },
    {
      key: "action-items",
      task: "ACTION_ITEMS",
      overdueKey: "action_items",
      label: "Action Items",
      path: projectMonitorActionItemsPath(
        role,
      ),
    },
    {
      key: "linear-works",
      task: "LINEAR_WORKS",
      label: "Linear Works",
      path: projectMonitorLinearWorksPath(
        role,
      ),
    },
    {
      key: "dpr-bills",
      task: "DPR_BILLS",
      label: "DPR & Bills",
      path: projectMonitorDprBillsPath(role),
    },
    {
      key: "hr",
      task: "HR",
      label: "HR",
      path: projectMonitorHrPath(role),
    },
    {
      key: "machinery",
      task: "MACHINERY",
      label: "Machinery",
      path: projectMonitorMachineryPath(role),
    },
    // Costing has no per-site grant at all - only Director/Admin
    // ever see it. It sits just before Reports.
    ...(seesCosting(role)
      ? [
          {
            key: "costing",
            label: "Costing",
            path: projectMonitorCostingPath(role),
          },
        ]
      : []),
    {
      key: "reports",
      task: "REPORTS",
      label: "Reports",
      path: projectMonitorReportsPath(role),
    },
  ];

  // All Projects and Overview are open to anyone with access to the
  // module - except the HR and Machinery departments, who only ever
  // see their own tab. Every other tab needs its own task.
  const shownTabs = tabs.filter((tab) =>
    tab.task
      ? visible.has(tab.task)
      : !isDepartmentRole(role),
  );

  return (
    <>
      {visible.noSites ? (
        <div className="inline-alert print-hidden">
          You have not been given access to any project yet.
          Ask an Admin to give you tasks on a site (Site
          Access), or to set your site in User Management.
        </div>
      ) : null}
      <div className="pm-tabs">
      {shownTabs.map((tab) => (
        <Link
          key={tab.key}
          to={`${tab.path}${
            tab.keepSite === false ? "" : query
          }`}
          className={clsx(
            "pm-tab",
            active === tab.key && "pm-tab--active",
          )}
        >
          {tab.label}
          {tab.overdueKey &&
          overdue[tab.overdueKey] > 0 ? (
            <span
              className="pm-tab__badge"
              title="Overdue items"
            >
              {overdue[tab.overdueKey]}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
    </>
  );
}
