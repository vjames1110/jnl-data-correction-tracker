import { useState } from "react";
import { Outlet } from "react-router-dom";

import { UserHeader } from "../components/layout/UserHeader";
import { UserSidebar } from "../components/layout/UserSidebar";

export function UserLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  return (
    <div
      className={
        sidebarCollapsed
          ? "user-shell user-shell--collapsed"
          : "user-shell"
      }
    >
      <UserSidebar
        collapsed={sidebarCollapsed}
        onCollapse={() =>
          setSidebarCollapsed(
            (current) => !current,
          )
        }
      />

      <div className="user-shell__content">
        <UserHeader
          onToggleSidebar={() =>
            setSidebarCollapsed(
              (current) => !current,
            )
          }
        />

        <main className="user-page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
