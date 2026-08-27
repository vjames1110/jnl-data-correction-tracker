import clsx from "clsx";
import {
  BarChart3,
  ChevronLeft,
  ClipboardCheck,
  Download,
  LayoutDashboard,
  Package,
  PackageCheck,
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
    label: "Dashboard",
    path: "/director/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "approvals",
    label: "Approval Inbox",
    path: "/director/approvals",
    icon: ClipboardCheck,
    group: "transaction",
  },
  {
    key: "reconciliation-approvals",
    label: "Reconciliation Approvals",
    path: "/director/reconciliation-approvals",
    icon: PackageCheck,
    group: "transaction",
  },
  {
    key: "analytics",
    label: "Analytics",
    path: "/director/analytics",
    icon: BarChart3,
    group: "reports",
  },
  {
    key: "reconciliation",
    label: "Store Reconciliation",
    path: "/director/reconciliation",
    icon: Package,
    group: "reports",
  },
  {
    key: "export",
    label: "Export",
    path: "/director/export",
    icon: Download,
    group: "reports",
  },
];

export function DirectorSidebar({
  collapsed,
  onCollapse,
}) {
  return (
    <aside
      className={clsx(
        "user-sidebar director-sidebar",
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
            <strong>Approvals</strong>
            <span>Director Portal</span>
          </div>
        ) : null}
      </div>

      <nav className="user-sidebar__nav">
        {!collapsed ? (
          <span className="user-sidebar__label">
            Approval Desk
          </span>
        ) : null}

        <SidebarNavGroups
          prefix="user-sidebar"
          storageKey="director-sidebar-groups"
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
