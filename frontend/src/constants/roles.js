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