import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import { AUTH_ROUTES } from "../constants/auth";
import { canManageSetup } from "../constants/roles";
import { useAuth } from "../hooks/useAuth";

/**
 * The setup screens shared by the Admin and the Director: User
 * Management, Organization Setup and Project Monitor Site Access.
 * The Super Admin-only screens (audit logs, system settings) stay
 * behind `AdminRoute` and their own capability check.
 */
export function AdministrationRoute() {
  const location = useLocation();
  const { user } = useAuth();

  if (user?.must_change_password) {
    return (
      <Navigate
        to={AUTH_ROUTES.CHANGE_PASSWORD}
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  if (!canManageSetup(user?.role)) {
    return (
      <Navigate
        to={AUTH_ROUTES.FORBIDDEN}
        replace
      />
    );
  }

  return <Outlet />;
}
