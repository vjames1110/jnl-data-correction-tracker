import { useState } from "react";
import { Outlet } from "react-router-dom";

import { ProjectManagerHeader } from "../components/layout/ProjectManagerHeader";
import { ProjectManagerSidebar } from "../components/layout/ProjectManagerSidebar";

export function ProjectManagerLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  return (
    <div
      className={
        sidebarCollapsed
          ? "user-shell project-manager-shell user-shell--collapsed"
          : "user-shell project-manager-shell"
      }
    >
      <ProjectManagerSidebar
        collapsed={sidebarCollapsed}
        onCollapse={() =>
          setSidebarCollapsed(
            (current) => !current,
          )
        }
      />

      <div className="user-shell__content">
        <ProjectManagerHeader
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
