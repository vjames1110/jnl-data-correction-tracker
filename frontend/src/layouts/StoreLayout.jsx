import { useState } from "react";
import { Outlet } from "react-router-dom";

import { StoreHeader } from "../components/layout/StoreHeader";
import { StoreSidebar } from "../components/layout/StoreSidebar";

export function StoreLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  return (
    <div
      className={
        sidebarCollapsed
          ? "user-shell store-shell user-shell--collapsed"
          : "user-shell store-shell"
      }
    >
      <StoreSidebar
        collapsed={sidebarCollapsed}
        onCollapse={() =>
          setSidebarCollapsed(
            (current) => !current,
          )
        }
      />

      <div className="user-shell__content">
        <StoreHeader
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
