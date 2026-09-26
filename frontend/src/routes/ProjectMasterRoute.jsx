import { Navigate, Outlet } from "react-router-dom";

import { AUTH_ROUTES } from "../constants/auth";
import { canManageProjectMasters } from "../constants/roles";
import { useAuth } from "../hooks/useAuth";

/**
 * The Project Management masters (Structure Types, RDSO span
 * library): only Admin, Director and the Project Management HO get
 * past this. Sits inside the role's own portal route, which already
 * handled sign-in and the forced password change.
 */
export function ProjectMasterRoute() {
  const { user } = useAuth();

  if (!canManageProjectMasters(user?.role)) {
    return <Navigate to={AUTH_ROUTES.FORBIDDEN} replace />;
  }

  return <Outlet />;
}
