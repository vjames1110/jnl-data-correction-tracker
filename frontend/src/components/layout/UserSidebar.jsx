import clsx from "clsx";
import {
  ChevronLeft,
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  LineChart,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { env } from "../../config/env";
import { USER_ROLES } from "../../constants/roles";
import { useAuth } from "../../hooks/useAuth";

const navItems = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/user/dashboard",
    icon: LayoutDashboard,
    roles: [
      USER_ROLES.USER,
      USER_ROLES.DIRECTOR,
      USER_ROLES.RESPONSIBLE_PERSON,
    ],
  },
  {
    key: "create",
    label: "Create Tracker",
    path: "/user/requests/new",
    icon: FilePlus2,
    roles: [
      USER_ROLES.USER,
      USER_ROLES.DIRECTOR,
      USER_ROLES.RESPONSIBLE_PERSON,
    ],
  },
  {
    key: "requests",
    label: "My Requests",
    path: "/user/requests",
    icon: ClipboardList,
    roles: [
      USER_ROLES.USER,
      USER_ROLES.DIRECTOR,
      USER_ROLES.RESPONSIBLE_PERSON,
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    path: "/user/analytics",
    icon: LineChart,
    roles: [
      USER_ROLES.USER,
      USER_ROLES.DIRECTOR,
      USER_ROLES.RESPONSIBLE_PERSON,
    ],
  },
];

export function UserSidebar({
  collapsed,
  onCollapse,
}) {
  const { user } = useAuth();
  const visibleItems = navItems.filter((item) =>
    item.roles.includes(user?.role),
  );

  return (
    <aside
      className={clsx(
        "user-sidebar",
        collapsed &&
          "user-sidebar--collapsed",
      )}
    >
      <div className="user-sidebar__brand">
        <div className="user-sidebar__logo">
          {env.companyShortName}
        </div>

        {!collapsed ? (
          <div>
            <strong>Data Correction</strong>
            <span>User Portal</span>
          </div>
        ) : null}
      </div>

      <nav className="user-sidebar__nav">
        {!collapsed ? (
          <span className="user-sidebar__label">
            Requests
          </span>
        ) : null}

        {visibleItems.map((item) => {
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
