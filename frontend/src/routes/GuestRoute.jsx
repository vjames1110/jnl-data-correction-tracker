import {
  Navigate,
  Outlet,
} from "react-router-dom";

import {
  landingPath,
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
        to={landingPath(user?.role)}
        replace
      />
    );
  }

  return <Outlet />;
}
