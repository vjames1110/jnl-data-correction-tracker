export const AUTH_STORAGE_KEYS = Object.freeze({
  ACCESS_TOKEN: "jnl_dct_access_token",
  REFRESH_TOKEN: "jnl_dct_refresh_token",
});

export const AUTH_ROUTES = Object.freeze({
  LOGIN: "/admin/login",
  CHANGE_PASSWORD: "/admin/change-password",
  DASHBOARD: "/admin/dashboard",
  FORBIDDEN: "/forbidden",
});

export const AUTH_STATUS = Object.freeze({
  INITIALIZING: "initializing",
  AUTHENTICATED: "authenticated",
  UNAUTHENTICATED: "unauthenticated",
});