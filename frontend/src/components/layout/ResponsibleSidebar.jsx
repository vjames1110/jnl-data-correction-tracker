import clsx from "clsx";
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronLeft,
  LayoutDashboard,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import logoMark from "../../assets/logo/JNL-LOGO-BG-REMOVED.png";
import { env } from "../../config/env";

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
  },
  {
    key: "analytics",
    label: "Analytics",
    path: "/responsible/analytics",
    icon: BarChart3,
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
