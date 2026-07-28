import { useState } from "react";
import { Outlet } from "react-router-dom";

import { DirectorHeader } from "../components/layout/DirectorHeader";
import { DirectorSidebar } from "../components/layout/DirectorSidebar";

export function DirectorLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  return (
    <div
      className={
        sidebarCollapsed
          ? "user-shell director-shell user-shell--collapsed"
          : "user-shell director-shell"
      }
    >
      <DirectorSidebar
        collapsed={sidebarCollapsed}
        onCollapse={() =>
          setSidebarCollapsed(
            (current) => !current,
          )
        }
      />

      <div className="user-shell__content">
        <DirectorHeader
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
