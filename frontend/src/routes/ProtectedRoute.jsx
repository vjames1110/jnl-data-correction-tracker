import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  AUTH_ROUTES,
} from "../constants/auth";
import { AppLoader } from "../components/common/AppLoader";
import { useAuth } from "../hooks/useAuth";

export function ProtectedRoute() {
  const location = useLocation();
  const {
    isAuthenticated,
    isInitializing,
  } = useAuth();

  if (isInitializing) {
    return (
      <AppLoader
        label="Loading application..."
        fullScreen
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={AUTH_ROUTES.LOGIN}
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  return <Outlet />;
}
