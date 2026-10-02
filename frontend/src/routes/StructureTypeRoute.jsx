import { Navigate, Outlet } from "react-router-dom";

import { AUTH_ROUTES } from "../constants/auth";
import { canAccessStructureTypeMaster } from "../constants/roles";
import { useAuth } from "../hooks/useAuth";

/**
 * The Structure Type master alone (not the RDSO span library, which
 * stays behind ``ProjectMasterRoute``): Admin, Director and the
 * Project Management HO manage every type; a Project Manager/Incharge
 * may also open it to create/edit a type owned by their own site -
 * the page itself (and the backend) scope what they can actually do
 * once inside.
 */
export function StructureTypeRoute() {
  const { user } = useAuth();

  if (!canAccessStructureTypeMaster(user?.role)) {
    return <Navigate to={AUTH_ROUTES.FORBIDDEN} replace />;
  }

  return <Outlet />;
}
