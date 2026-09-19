import clsx from "clsx";
import { Link, useSearchParams } from "react-router-dom";

import { useOverdueCounts } from "../../../hooks/useProjectMonitor";
import {
  projectMonitorActionItemsPath,
  projectMonitorBuildingsPath,
  projectMonitorDashboardPath,
  projectMonitorDprBillsPath,
  projectMonitorGirdersPath,
  projectMonitorLinearWorksPath,
  projectMonitorOverviewPath,
  projectMonitorReportsPath,
  projectMonitorStructuresPath,
} from "../../../constants/roles";

export function ProjectMonitorTabs({ role, active }) {
  const [searchParams] = useSearchParams();
  const site = searchParams.get("site");
  const query = site ? `?site=${site}` : "";
  const overdueQuery = useOverdueCounts(site);
  const overdue = overdueQuery.data ?? {};

  const tabs = [
    {
      key: "dashboard",
      label: "All Projects",
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
      overdueKey: "structures",
      label: "Structures",
      path: projectMonitorStructuresPath(role),
    },
    {
      key: "buildings",
      overdueKey: "buildings",
      label: "Buildings",
      path: projectMonitorBuildingsPath(role),
    },
    {
      key: "girders",
      overdueKey: "girders",
      label: "Girders",
      path: projectMonitorGirdersPath(role),
    },
    {
      key: "action-items",
      overdueKey: "action_items",
      label: "Action Items",
      path: projectMonitorActionItemsPath(
        role,
      ),
    },
    {
      key: "linear-works",
      label: "Linear Works",
      path: projectMonitorLinearWorksPath(
        role,
      ),
    },
    {
      key: "dpr-bills",
      label: "DPR & Bills",
      path: projectMonitorDprBillsPath(role),
    },
    {
      key: "reports",
      label: "Reports",
      path: projectMonitorReportsPath(role),
    },
  ];

  return (
    <div className="pm-tabs">
      {tabs.map((tab) => (
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
  );
}
