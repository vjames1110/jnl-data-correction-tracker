export const USER_ROLES = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  USER: "USER",
  DIRECTOR: "DIRECTOR",
  RESPONSIBLE_PERSON: "RESPONSIBLE_PERSON",
  EMPLOYEE: "EMPLOYEE",
  STORE_HO: "STORE_HO",
  PROJECT_MANAGER: "PROJECT_MANAGER",
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

export function isProjectManagerRole(role) {
  return [
    USER_ROLES.PROJECT_MANAGER,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ].includes(role);
}

export function reconciliationOverviewPath(role) {
  return role === USER_ROLES.STORE_HO
    ? "/store/settings"
    : "/admin/reconciliation";
}

export function projectMonitorDashboardPath(role) {
  if (role === USER_ROLES.PROJECT_MANAGER) {
    return "/project-manager/projects";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/projects";
  }
  return "/admin/project-monitor/projects";
}

export function projectMonitorOverviewPath(role) {
  if (role === USER_ROLES.PROJECT_MANAGER) {
    return "/project-manager/dashboard";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor";
  }
  return "/admin/project-monitor";
}

export function projectMonitorStructuresPath(role) {
  if (role === USER_ROLES.PROJECT_MANAGER) {
    return "/project-manager/structures";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/structures";
  }
  return "/admin/project-monitor/structures";
}

export function projectMonitorBuildingsPath(role) {
  if (role === USER_ROLES.PROJECT_MANAGER) {
    return "/project-manager/buildings";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/buildings";
  }
  return "/admin/project-monitor/buildings";
}

export function projectMonitorGirdersPath(role) {
  if (role === USER_ROLES.PROJECT_MANAGER) {
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
  if (role === USER_ROLES.PROJECT_MANAGER) {
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
  if (role === USER_ROLES.PROJECT_MANAGER) {
    return "/project-manager/linear-works";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/linear-works";
  }
  return "/admin/project-monitor/linear-works";
}

export function projectMonitorDprBillsPath(role) {
  if (role === USER_ROLES.PROJECT_MANAGER) {
    return "/project-manager/dpr-bills";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/dpr-bills";
  }
  return "/admin/project-monitor/dpr-bills";
}

export function projectMonitorReportsPath(role) {
  if (role === USER_ROLES.PROJECT_MANAGER) {
    return "/project-manager/reports";
  }
  if (role === USER_ROLES.DIRECTOR) {
    return "/director/project-monitor/reports";
  }
  return "/admin/project-monitor/reports";
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

  if (role === USER_ROLES.PROJECT_MANAGER) {
    return "/project-manager";
  }

  return "/user";
}
