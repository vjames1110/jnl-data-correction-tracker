import clsx from "clsx";
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronLeft,
  LayoutDashboard,
} from "lucide-react";

import logoMark from "../../assets/logo/JNL-LOGO-BG-REMOVED.png";
import { env } from "../../config/env";
import { SidebarNavGroups } from "./SidebarNavGroups";

const NAV_GROUPS = [
  { key: "transaction", label: "Transaction" },
  { key: "reports", label: "Reports" },
];

const navItems = [
  {
    key: "dashboard",
    label: "Work Dashboard",
    path: "/responsible/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "assigned",
    label: "Assigned Work",
    path: "/responsible/assignments",
    icon: BriefcaseBusiness,
    group: "transaction",
  },
  {
    key: "analytics",
    label: "Analytics",
    path: "/responsible/analytics",
    icon: BarChart3,
    group: "reports",
  },
];

export function ResponsibleSidebar({
  collapsed,
  onCollapse,
}) {
  return (
    <aside
      className={clsx(
        "user-sidebar responsible-sidebar",
        collapsed &&
          "user-sidebar--collapsed",
      )}
    >
      <div className="user-sidebar__brand">
        <div className="user-sidebar__logo">
          <img
            src={logoMark}
            alt={env.companyShortName}
          />
        </div>

        {!collapsed ? (
          <div>
            <strong>Correction Work</strong>
            <span>Responsible Portal</span>
          </div>
        ) : null}
      </div>

      <nav className="user-sidebar__nav">
        {!collapsed ? (
          <span className="user-sidebar__label">
            Operations
          </span>
        ) : null}

        <SidebarNavGroups
          prefix="user-sidebar"
          storageKey="responsible-sidebar-groups"
          collapsed={collapsed}
          groups={NAV_GROUPS}
          items={navItems}
        />
      </nav>

      <button
        type="button"
        className="user-sidebar__collapse"
        onClick={onCollapse}
      >
        <ChevronLeft
          size={18}
          className={clsx(
            collapsed &&
              "user-sidebar__collapse-icon--rotated",
          )}
        />

        {!collapsed ? (
          <span>Collapse sidebar</span>
        ) : null}
      </button>
    </aside>
  );
}
