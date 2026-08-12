export const USER_ROLES = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  USER: "USER",
  DIRECTOR: "DIRECTOR",
  RESPONSIBLE_PERSON: "RESPONSIBLE_PERSON",
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

  return "/user";
}
