import { Outlet } from "react-router-dom";

import { AuthBrandPanel } from "../modules/auth/components/AuthBrandPanel";

export function AuthLayout() {
  return (
    <main className="auth-layout">
      <AuthBrandPanel />

      <section className="auth-layout__content">
        <Outlet />
      </section>
    </main>
  );
}