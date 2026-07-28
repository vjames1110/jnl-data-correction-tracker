import { Navigate } from "react-router-dom";

import {
  AUTH_ROUTES,
} from "../constants/auth";
import {
  isAdminRole,
  USER_ROLES,
} from "../constants/roles";
import { AppLoader } from "../components/common/AppLoader";
import { useAuth } from "../hooks/useAuth";

export function RootRedirectPage() {
  const {
    user,
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
      />
    );
  }

  if (user?.must_change_password) {
    return (
      <Navigate
        to={AUTH_ROUTES.CHANGE_PASSWORD}
        replace
      />
    );
  }

  if (isAdminRole(user?.role)) {
    return (
      <Navigate
        to={AUTH_ROUTES.DASHBOARD}
        replace
      />
    );
  }

  if (user?.role === USER_ROLES.DIRECTOR) {
    return (
      <Navigate
        to={AUTH_ROUTES.DIRECTOR_DASHBOARD}
        replace
      />
    );
  }

  return (
    <Navigate
      to={AUTH_ROUTES.USER_DASHBOARD}
      replace
    />
  );
}
