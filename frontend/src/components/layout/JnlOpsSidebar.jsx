import clsx from "clsx";
import { ChevronLeft } from "lucide-react";

import logoMark from "../../assets/logo/JNL-LOGO-BG-REMOVED.png";
import { env } from "../../config/env";
import { useModuleAccess } from "../../hooks/useModuleAccess";
import { NAV_GROUPS } from "../../navigation/moduleRegistry";
import { AppLoader } from "../common/AppLoader";
import { ErrorState } from "../common/ErrorState";
import { ModuleSwitcher } from "./ModuleSwitcher";
import { SidebarNavGroups } from "./SidebarNavGroups";

/**
 * The one sidebar every role uses: JNLOps brand, the module switcher,
 * then the active module's Transaction / Master / Reports links.
 */
export function JnlOpsSidebar({
  collapsed,
  onCollapse,
}) {
  const {
    role,
    modules,
    activeModule,
    navItems,
    isLoading,
    isError,
    error,
    refetch,
  } = useModuleAccess();

  return (
    <aside
      className={clsx(
        "admin-sidebar",
        collapsed && "admin-sidebar--collapsed",
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
            <strong>{env.appName}</strong>
            <span>{env.companyShortName}</span>
          </div>
        ) : null}
      </div>

      <ModuleSwitcher
        role={role}
        modules={modules}
        activeModule={activeModule}
        collapsed={collapsed}
      />

      <nav className="admin-sidebar__nav">
        {isLoading ? (
          <AppLoader label="Loading menu..." />
        ) : null}

        {isError ? (
          <div className="admin-sidebar__state">
            <ErrorState
              title="Menu unavailable"
              message={error?.message}
              onRetry={refetch}
            />
          </div>
        ) : null}

        {!isLoading &&
        !isError &&
        !navItems.length ? (
          <div className="admin-sidebar__empty">
            No menu items available.
          </div>
        ) : null}

        {!isLoading && !isError && navItems.length ? (
          <SidebarNavGroups
            key={activeModule?.key}
            prefix="admin-sidebar"
            storageKey={`jnlops-sidebar-groups-${activeModule?.key}`}
            collapsed={collapsed}
            groups={NAV_GROUPS}
            items={navItems}
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
