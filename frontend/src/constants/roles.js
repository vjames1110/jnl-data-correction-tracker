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
  PROJECT_HO: "PROJECT_HO",
  HR_DEPARTMENT: "HR_DEPARTMENT",
  MACHINERY_DEPARTMENT: "MACHINERY_DEPARTMENT",
});

export const ADMIN_ROLES = Object.freeze([
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.ADMIN,
]);

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

/**
 * The accounts that run setup: Admin, Super Admin and the Director.
 * They manage users and organization setup and hold every Project
 * Management entry right on every site. What only the Super Admin may
 * do (audit logs, system settings, Super Admin accounts) is enforced by
 * the backend and the capability list.
 */
export function canManageSetup(role) {
  return isAdminRole(role) || role === USER_ROLES.DIRECTOR;
}

/**
 * Whether the person may run account actions (edit, deactivate, reset
 * password, change role...) on an account of the given role. A
 * Director manages every account except Super Admin ones.
 */
export function canManageAccountOf(actorRole, targetRole) {
  return !(
    actorRole === USER_ROLES.DIRECTOR &&
    targetRole === USER_ROLES.SUPER_ADMIN
  );
}

/**
 * The role options a person may hand out. A Director manages every
 * account except the Super Admin ones, so that option is dropped for
 * them (the backend refuses it too); the option already in use stays
 * so an existing value never disappears from the list.
 */
export function assignableRoleOptions(
  actorRole,
  options,
  currentValue,
) {
  if (actorRole !== USER_ROLES.DIRECTOR) {
    return options;
  }
  return options.filter(
    (option) =>
      option.value !== USER_ROLES.SUPER_ADMIN ||
      option.value === currentValue,
  );
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
 * The HR and Machinery departments: company-wide accounts that alone
 * enter HR and machinery data, on every site (enforced by the
 * backend).
 */
export function isDepartmentRole(role) {
  return (
    role === USER_ROLES.HR_DEPARTMENT ||
    role === USER_ROLES.MACHINERY_DEPARTMENT
  );
}

/**
 * People who work in the Project Management portal: the Project
 * Incharge (makes the entries, on granted sites and tasks), the
 * Project Manager (kept for now), the Project Management HO (every
 * site, enters only the Overview and masters) and the two
 * departments (their own tab, every site). What each may actually do
 * is decided by the backend per site and task.
 */
export function usesProjectPortal(role) {
  return (
    role === USER_ROLES.PROJECT_MANAGER ||
    role === USER_ROLES.PROJECT_INCHARGE ||
    role === USER_ROLES.PROJECT_HO ||
    isDepartmentRole(role)
  );
}

/**
 * Who sees every project on All Projects: Admin, Super Admin,
 * Director and the Project Management HO. Everyone else sees only
 * the sites they were assigned (the backend enforces it; this only
 * words the page).
 */
export function seesEveryProject(role) {
  return (
    isAdminRole(role) ||
    role === USER_ROLES.DIRECTOR ||
    role === USER_ROLES.PROJECT_HO
  );
}

/** Costing (margins) stays with Director and Admin only. */
export function seesCosting(role) {
  return isAdminRole(role) || role === USER_ROLES.DIRECTOR;
}

/**
 * Who manages the Project Management masters (Structure Types, RDSO
 * span library): Admin, Director and the Project Management HO.
 */
export function canManageProjectMasters(role) {
  return (
    isAdminRole(role) ||
    role === USER_ROLES.DIRECTOR ||
    role === USER_ROLES.PROJECT_HO
  );
}

/**
 * Roles that work in the Project Management portal or hold every
 * entry right on it (Admin). The Director enters everywhere too but
 * uses the /director tree, so it is not part of this portal check.
 */
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
  // The departments have no Overview: their home is their own page.
  if (role === USER_ROLES.HR_DEPARTMENT) {
    return "/project-manager/hr";
  }
  if (role === USER_ROLES.MACHINERY_DEPARTMENT) {
    return "/project-manager/machinery";
  }
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

/**
 * Site Access is granted by the Admin and the Director alike; both
 * open the same page (its URL sits with the other setup screens).
 */
export function projectMonitorSiteAccessPath() {
  return "/admin/project-monitor/site-access";
}

export function projectMonitorStructureTypesPath(role) {
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/structure-types";
  }
  if (usesProjectPortal(role)) {
    return "/project-manager/structure-types";
  }
  return "/admin/project-monitor/structure-types";
}

export function projectMonitorRdsoPath(role) {
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/rdso-span-library";
  }
  if (usesProjectPortal(role)) {
    return "/project-manager/rdso-span-library";
  }
  return "/admin/project-monitor/rdso-span-library";
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

/**
 * Where a person lands after signing in (unless they were sent to a
 * page they asked for): their portal's dashboard, or - for the HR and
 * Machinery departments, who have no dashboard - their own page.
 */
export function landingPath(role) {
  if (isDepartmentRole(role)) {
    return projectMonitorOverviewPath(role);
  }
  return `${portalBasePath(role)}/dashboard`;
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
