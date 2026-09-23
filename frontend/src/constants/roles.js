export const USER_ROLES = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  USER: "USER",
  DIRECTOR: "DIRECTOR",
  RESPONSIBLE_PERSON: "RESPONSIBLE_PERSON",
  EMPLOYEE: "EMPLOYEE",
  STORE_HO: "STORE_HO",
  PROJECT_MANAGER: "PROJECT_MANAGER",
  PROJECT_INCHARGE: "PROJECT_INCHARGE",
});

export const ADMIN_ROLES = Object.freeze([
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.ADMIN,
]);

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function isApprovalRole(role) {
  return [
    USER_ROLES.DIRECTOR,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ].includes(role);
}

export function isResponsibleRole(role) {
  return [
    USER_ROLES.RESPONSIBLE_PERSON,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ].includes(role);
}

export function isStoreRole(role) {
  return [
    USER_ROLES.STORE_HO,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ].includes(role);
}

/**
 * People who work in the Project Management portal (entries limited
 * to their own sites, enforced by the backend): the Project Incharge
 * - who makes the entries - and the Project Manager, kept for now.
 */
export function usesProjectPortal(role) {
  return (
    role === USER_ROLES.PROJECT_MANAGER ||
    role === USER_ROLES.PROJECT_INCHARGE
  );
}

/**
 * Who sees every project on All Projects: Admin, Super Admin and
 * Director. Everyone else sees only the sites they were assigned
 * (the backend enforces it; this only words the page).
 */
export function seesEveryProject(role) {
  return isAdminRole(role) || role === USER_ROLES.DIRECTOR;
}

/** Roles that may enter Project Monitor data (Director only views). */
export function isProjectEntryRole(role) {
  return (
    usesProjectPortal(role) || isAdminRole(role)
  );
}

export function reconciliationOverviewPath(role) {
  return role === USER_ROLES.STORE_HO
    ? "/store/settings"
    : "/admin/reconciliation";
}

export function projectMonitorDashboardPath(role) {
  if (usesProjectPortal(role)) {
    return "/project-manager/projects";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/projects";
  }
  return "/admin/project-monitor/projects";
}

export function projectMonitorOverviewPath(role) {
  if (usesProjectPortal(role)) {
    return "/project-manager/dashboard";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor";
  }
  return "/admin/project-monitor";
}

export function projectMonitorStructuresPath(role) {
  if (usesProjectPortal(role)) {
    return "/project-manager/structures";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/structures";
  }
  return "/admin/project-monitor/structures";
}

export function projectMonitorBuildingsPath(role) {
  if (usesProjectPortal(role)) {
    return "/project-manager/buildings";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/buildings";
  }
  return "/admin/project-monitor/buildings";
}

export function projectMonitorGirdersPath(role) {
  if (usesProjectPortal(role)) {
    return "/project-manager/girders";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/girders";
  }
  return "/admin/project-monitor/girders";
}

export function projectMonitorActionItemsPath(
  role,
) {
  if (usesProjectPortal(role)) {
    return "/project-manager/action-items";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/action-items";
  }
  return "/admin/project-monitor/action-items";
}

export function projectMonitorLinearWorksPath(
  role,
) {
  if (usesProjectPortal(role)) {
    return "/project-manager/linear-works";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/linear-works";
  }
  return "/admin/project-monitor/linear-works";
}

export function projectMonitorDprBillsPath(role) {
  if (usesProjectPortal(role)) {
    return "/project-manager/dpr-bills";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/dpr-bills";
  }
  return "/admin/project-monitor/dpr-bills";
}

export function projectMonitorHrPath(role) {
  if (usesProjectPortal(role)) {
    return "/project-manager/hr";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/hr";
  }
  return "/admin/project-monitor/hr";
}

export function projectMonitorMachineryPath(role) {
  if (usesProjectPortal(role)) {
    return "/project-manager/machinery";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/machinery";
  }
  return "/admin/project-monitor/machinery";
}

export function projectMonitorReportsPath(role) {
  if (usesProjectPortal(role)) {
    return "/project-manager/reports";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/reports";
  }
  return "/admin/project-monitor/reports";
}

/**
 * Costing has no Project Manager/Incharge branch: only Director and
 * Admin/Super Admin ever hold this task (see ``seesEveryProject``,
 * the same role set), so there is no "/project-manager/costing".
 */
export function projectMonitorCostingPath(role) {
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/costing";
  }
  return "/admin/project-monitor/costing";
}

export function portalBasePath(role) {
  if (isAdminRole(role)) {
    return "/admin";
  }

  if (role === USER_ROLES.DIRECTOR) {
    return "/director";
  }

  if (role === USER_ROLES.RESPONSIBLE_PERSON) {
    return "/responsible";
  }

  if (role === USER_ROLES.STORE_HO) {
    return "/store";
  }

  if (usesProjectPortal(role)) {
    return "/project-manager";
  }

  return "/user";
}
