import { useState } from "react";
import { Outlet } from "react-router-dom";

import { JnlOpsHeader } from "../components/layout/JnlOpsHeader";
import { JnlOpsSidebar } from "../components/layout/JnlOpsSidebar";

/**
 * The shell shared by every role. Each role keeps its own route guard
 * and page tree in the router; only the frame around the pages is one.
 */
export function JnlOpsLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const toggleSidebar = () =>
    setSidebarCollapsed((current) => !current);

  return (
    <div
      className={
        sidebarCollapsed
          ? "admin-shell admin-shell--collapsed"
          : "admin-shell"
      }
    >
      <JnlOpsSidebar
        collapsed={sidebarCollapsed}
        onCollapse={toggleSidebar}
      />

      <div className="admin-shell__content">
        <JnlOpsHeader
          onToggleSidebar={toggleSidebar}
        />

        <main className="admin-page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
