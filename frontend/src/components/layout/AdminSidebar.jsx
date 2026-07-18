import {
  BarChart3,
  Building2,
  ChevronLeft,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import clsx from "clsx";
import {
  NavLink,
} from "react-router-dom";

import { env } from "../../config/env";
import { AppLoader } from "../common/AppLoader";
import { ErrorState } from "../common/ErrorState";
import {
  useAdminCapabilities,
} from "../../hooks/useAdminCapabilities";

const iconMap = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  "building-2": Building2,
  "file-text": FileText,
  "chart-no-axes-combined": BarChart3,
  history: History,
  settings: Settings,
};

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
          {env.companyShortName}
        </div>

        {!collapsed ? (
          <div>
            <strong>
              Data Correction
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

        {capabilitiesQuery.data?.navigation?.map(
          (item) => {
            const Icon =
              iconMap[item.icon] ??
              LayoutDashboard;

            return (
              <NavLink
                key={item.key}
                to={item.path}
                className={({ isActive }) =>
                  clsx(
                    "admin-sidebar__link",
                    isActive &&
                      "admin-sidebar__link--active",
                  )
                }
                title={
                  collapsed
                    ? item.label
                    : undefined
                }
              >
                <Icon size={20} />
                {!collapsed ? (
                  <span>{item.label}</span>
                ) : null}
              </NavLink>
            );
          },
        )}
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
