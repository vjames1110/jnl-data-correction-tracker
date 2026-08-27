import clsx from "clsx";
import {
  BarChart3,
  ClipboardEdit,
  ChevronLeft,
  LayoutDashboard,
  Settings,
} from "lucide-react";

import logoMark from "../../assets/logo/JNL-LOGO-BG-REMOVED.png";
import { env } from "../../config/env";
import { SidebarNavGroups } from "./SidebarNavGroups";

const NAV_GROUPS = [
  { key: "transaction", label: "Transaction" },
  { key: "reports", label: "Reports" },
  { key: "master", label: "Master" },
];

const navItems = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/store/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "entry",
    label: "Monthly Entry",
    path: "/store/entry",
    icon: ClipboardEdit,
    group: "transaction",
  },
  {
    key: "reports",
    label: "Reports",
    path: "/store/reports",
    icon: BarChart3,
    group: "reports",
  },
  {
    key: "settings",
    label: "Settings",
    path: "/store/settings",
    icon: Settings,
    group: "master",
  },
];

export function StoreSidebar({
  collapsed,
  onCollapse,
}) {
  return (
    <aside
      className={clsx(
        "user-sidebar store-sidebar",
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
            <strong>Store Reconciliation</strong>
            <span>Store HO Portal</span>
          </div>
        ) : null}
      </div>

      <nav className="user-sidebar__nav">
        {!collapsed ? (
          <span className="user-sidebar__label">
            Store
          </span>
        ) : null}

        <SidebarNavGroups
          prefix="user-sidebar"
          storageKey="store-sidebar-groups"
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
