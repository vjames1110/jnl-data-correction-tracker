import clsx from "clsx";
import {
  ChevronLeft,
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  LineChart,
} from "lucide-react";

import logoMark from "../../assets/logo/JNL-LOGO-BG-REMOVED.png";
import { env } from "../../config/env";
import { USER_ROLES } from "../../constants/roles";
import { useAuth } from "../../hooks/useAuth";
import { SidebarNavGroups } from "./SidebarNavGroups";

const NAV_GROUPS = [
  { key: "transaction", label: "Transaction" },
  { key: "reports", label: "Reports" },
];

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
    label: "Create Request",
    path: "/user/requests/new",
    icon: FilePlus2,
    group: "transaction",
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
    group: "transaction",
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
    group: "reports",
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
          <img
            src={logoMark}
            alt={env.companyShortName}
          />
        </div>

        {!collapsed ? (
          <div>
            <strong>Approval Management</strong>
            <span>Request Creator Portal</span>
          </div>
        ) : null}
      </div>

      <nav className="user-sidebar__nav">
        {!collapsed ? (
          <span className="user-sidebar__label">
            Requests
          </span>
        ) : null}

        <SidebarNavGroups
          prefix="user-sidebar"
          storageKey="user-sidebar-groups"
          collapsed={collapsed}
          groups={NAV_GROUPS}
          items={visibleItems}
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
