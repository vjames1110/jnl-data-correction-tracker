import {
  Navigate,
  Outlet,
} from "react-router-dom";

import {
  AUTH_ROUTES,
} from "../constants/auth";
import {
  isAdminRole,
} from "../constants/roles";
import { AppLoader } from "../components/common/AppLoader";
import { useAuth } from "../hooks/useAuth";

export function GuestRoute() {
  const {
    isAuthenticated,
    isInitializing,
    user,
  } = useAuth();

  if (isInitializing) {
    return (
      <AppLoader
        label="Loading application..."
        fullScreen
      />
    );
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={
          isAdminRole(user?.role)
            ? AUTH_ROUTES.DASHBOARD
            : AUTH_ROUTES.USER_DASHBOARD
        }
        replace
      />
    );
  }

  return <Outlet />;
}
