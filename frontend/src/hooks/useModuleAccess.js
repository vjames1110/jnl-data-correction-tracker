import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { isAdminRole } from "../constants/roles";
import {
  getAccessibleModules,
  getModuleNav,
  MODULES,
  readStoredModuleKey,
  resolveActiveModuleKey,
  storeModuleKey,
} from "../navigation/moduleRegistry";
import { useAdminCapabilities } from "./useAdminCapabilities";
import { useAuth } from "./useAuth";

/**
 * What the shell needs to draw itself for the signed-in person: the
 * modules they can open, the one the current page belongs to, and that
 * module's sidebar items. Navigation is derived from the role today;
 * per-user module assignments will plug in at `getAccessibleModules`.
 */
export function useModuleAccess() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const role = user?.role;

  const capabilitiesQuery = useAdminCapabilities({
    enabled: isAdminRole(role),
  });

  const modules = getAccessibleModules(role);
  const activeKey = resolveActiveModuleKey(
    role,
    pathname,
    readStoredModuleKey(),
  );
  const activeModule = activeKey
    ? MODULES[activeKey]
    : null;

  useEffect(() => {
    if (activeKey) {
      storeModuleKey(activeKey);
    }
  }, [activeKey]);

  const needsCapabilities = isAdminRole(role);
  const navItems = activeKey
    ? getModuleNav(
        role,
        activeKey,
        needsCapabilities
          ? capabilitiesQuery.data?.capabilities
          : undefined,
      )
    : [];

  return {
    role,
    modules,
    activeModule,
    navItems,
    isLoading:
      needsCapabilities &&
      capabilitiesQuery.isLoading,
    isError:
      needsCapabilities &&
      capabilitiesQuery.isError,
    error: capabilitiesQuery.error,
    refetch: capabilitiesQuery.refetch,
  };
}
