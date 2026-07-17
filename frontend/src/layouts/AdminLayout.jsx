import { useState } from "react";
import { Outlet } from "react-router-dom";

import { AdminHeader } from "../components/layout/AdminHeader";
import { AdminSidebar } from "../components/layout/AdminSidebar";

export function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  return (
    <div
      className={
        sidebarCollapsed
          ? "admin-shell admin-shell--collapsed"
          : "admin-shell"
      }
    >
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onCollapse={() =>
          setSidebarCollapsed(
            (current) => !current,
          )
        }
      />

      <div className="admin-shell__content">
        <AdminHeader
          onToggleSidebar={() =>
            setSidebarCollapsed(
              (current) => !current,
            )
          }
        />

        <div className="admin-page-container">
          <Outlet />
        </div>
      </div>
    </div>
  );
}