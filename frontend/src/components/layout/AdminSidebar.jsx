import {
  BarChart3,
  Building2,
  ChevronLeft,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Package,
  Settings,
  Users,
} from "lucide-react";
import clsx from "clsx";

import logoMark from "../../assets/logo/JNL-LOGO-BG-REMOVED.png";
import { env } from "../../config/env";
import { AppLoader } from "../common/AppLoader";
import { ErrorState } from "../common/ErrorState";
import {
  useAdminCapabilities,
} from "../../hooks/useAdminCapabilities";
import { SidebarNavGroups } from "./SidebarNavGroups";

const iconMap = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  "building-2": Building2,
  "file-text": FileText,
  package: Package,
  "clipboard-list": ClipboardList,
  "chart-no-axes-combined": BarChart3,
  history: History,
  settings: Settings,
};

const NAV_GROUPS = [
  { key: "master", label: "Master" },
  { key: "transaction", label: "Transaction" },
  { key: "reports", label: "Reports" },
];

export function AdminSidebar({
  collapsed,
  onCollapse,
}) {
  const capabilitiesQuery =
    useAdminCapabilities();

  return (
    <aside
      className={clsx(
        "admin-sidebar",
        collapsed &&
          "admin-sidebar--collapsed",
      )}
    >
      <div className="admin-sidebar__brand">
        <div className="admin-sidebar__logo">
          <img
            src={logoMark}
            alt={env.companyShortName}
          />
        </div>

        {!collapsed ? (
          <div>
            <strong>
              Approval Management
            </strong>
            <span>Administration</span>
          </div>
        ) : null}
      </div>

      <nav className="admin-sidebar__nav">
        {!collapsed ? (
          <span className="admin-sidebar__label">
            Administration
          </span>
        ) : null}

        {capabilitiesQuery.isLoading ? (
          <AppLoader label="Loading menu..." />
        ) : null}

        {capabilitiesQuery.isError ? (
          <div className="admin-sidebar__state">
            <ErrorState
              title="Menu unavailable"
              message={
                capabilitiesQuery.error?.message
              }
              onRetry={
                capabilitiesQuery.refetch
              }
            />
          </div>
        ) : null}

        {!capabilitiesQuery.isLoading &&
        !capabilitiesQuery.isError &&
        !capabilitiesQuery.data?.navigation
          ?.length ? (
          <div className="admin-sidebar__empty">
            No menu items available.
          </div>
        ) : null}

        {capabilitiesQuery.data?.navigation
          ?.length ? (
          <SidebarNavGroups
            prefix="admin-sidebar"
            storageKey="admin-sidebar-groups"
            collapsed={collapsed}
            groups={NAV_GROUPS}
            items={capabilitiesQuery.data.navigation.map(
              (item) => ({
                ...item,
                icon:
                  iconMap[item.icon] ??
                  LayoutDashboard,
              }),
            )}
          />
        ) : null}
      </nav>

      <button
        type="button"
        className="admin-sidebar__collapse"
        onClick={onCollapse}
      >
        <ChevronLeft
          size={18}
          className={clsx(
            collapsed &&
              "admin-sidebar__collapse-icon--rotated",
          )}
        />

        {!collapsed ? (
          <span>Collapse sidebar</span>
        ) : null}
      </button>
    </aside>
  );
}
