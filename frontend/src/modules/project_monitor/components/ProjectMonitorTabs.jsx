import clsx from "clsx";
import { Link, useSearchParams } from "react-router-dom";

import {
  projectMonitorActionItemsPath,
  projectMonitorBuildingsPath,
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

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      path: projectMonitorOverviewPath(role),
    },
    {
      key: "structures",
      label: "Structures",
      path: projectMonitorStructuresPath(role),
    },
    {
      key: "buildings",
      label: "Buildings",
      path: projectMonitorBuildingsPath(role),
    },
    {
      key: "girders",
      label: "Girders",
      path: projectMonitorGirdersPath(role),
    },
    {
      key: "action-items",
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
          to={`${tab.path}${query}`}
          className={clsx(
            "pm-tab",
            active === tab.key && "pm-tab--active",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
