import { useState } from "react";
import { Outlet } from "react-router-dom";

import { ResponsibleHeader } from "../components/layout/ResponsibleHeader";
import { ResponsibleSidebar } from "../components/layout/ResponsibleSidebar";

export function ResponsibleLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  return (
    <div
      className={
        sidebarCollapsed
          ? "user-shell responsible-shell user-shell--collapsed"
          : "user-shell responsible-shell"
      }
    >
      <ResponsibleSidebar
        collapsed={sidebarCollapsed}
        onCollapse={() =>
          setSidebarCollapsed(
            (current) => !current,
          )
        }
      />

      <div className="user-shell__content">
        <ResponsibleHeader
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
