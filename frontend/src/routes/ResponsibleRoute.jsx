import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  AUTH_ROUTES,
} from "../constants/auth";
import {
  isResponsibleRole,
} from "../constants/roles";
import { useAuth } from "../hooks/useAuth";

export function ResponsibleRoute() {
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

  if (!isResponsibleRole(user?.role)) {
    return (
      <Navigate
        to={AUTH_ROUTES.FORBIDDEN}
        replace
      />
    );
  }

  return <Outlet />;
}
