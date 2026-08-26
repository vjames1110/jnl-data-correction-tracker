import clsx from "clsx";
import {
  BarChart3,
  ClipboardEdit,
  ChevronLeft,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import logoMark from "../../assets/logo/JNL-LOGO-BG-REMOVED.png";
import { env } from "../../config/env";

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
  },
  {
    key: "reports",
    label: "Reports",
    path: "/store/reports",
    icon: BarChart3,
  },
  {
    key: "settings",
    label: "Settings",
    path: "/store/settings",
    icon: Settings,
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

        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.key}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  "user-sidebar__link",
                  isActive &&
                    "user-sidebar__link--active",
                )
              }
              title={
                collapsed ? item.label : undefined
              }
            >
              <Icon size={19} />
              {!collapsed ? (
                <span>{item.label}</span>
              ) : null}
            </NavLink>
          );
        })}
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
