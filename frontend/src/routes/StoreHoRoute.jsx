import { Navigate, Outlet } from "react-router-dom";

import { AUTH_ROUTES } from "../constants/auth";
import { USER_ROLES } from "../constants/roles";
import { useAuth } from "../hooks/useAuth";

export function StoreHoRoute() {
  const { user } = useAuth();

  if (user?.role !== USER_ROLES.STORE_HO) {
    return (
      <Navigate
        to={AUTH_ROUTES.FORBIDDEN}
        replace
      />
    );
  }

  return <Outlet />;
}
