import {
  Navigate,
  Outlet,
} from "react-router-dom";

import {
  portalBasePath,
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
        to={`${portalBasePath(
          user?.role,
        )}/dashboard`}
        replace
      />
    );
  }

  return <Outlet />;
}
