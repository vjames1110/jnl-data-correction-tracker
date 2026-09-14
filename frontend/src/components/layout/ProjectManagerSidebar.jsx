import clsx from "clsx";
import {
  ChevronLeft,
  LayoutDashboard,
} from "lucide-react";

import logoMark from "../../assets/logo/JNL-LOGO-BG-REMOVED.png";
import { env } from "../../config/env";
import { SidebarNavGroups } from "./SidebarNavGroups";

const NAV_GROUPS = [
  { key: "transaction", label: "Transaction" },
];

const navItems = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/project-manager/dashboard",
    icon: LayoutDashboard,
  },
];

export function ProjectManagerSidebar({
  collapsed,
  onCollapse,
}) {
  return (
    <aside
      className={clsx(
        "user-sidebar project-manager-sidebar",
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
            <strong>Project Monitor</strong>
            <span>Project Manager Portal</span>
          </div>
        ) : null}
      </div>

      <nav className="user-sidebar__nav">
        {!collapsed ? (
          <span className="user-sidebar__label">
            Project Monitor
          </span>
        ) : null}

        <SidebarNavGroups
          prefix="user-sidebar"
          storageKey="project-manager-sidebar-groups"
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
