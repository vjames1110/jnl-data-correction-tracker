export const queryKeys = Object.freeze({
  currentUser: ["auth", "current-user"],
  adminProfile: ["admin", "profile"],
  adminCapabilities: ["admin", "capabilities"],
  adminDashboard: (period) => [
    "admin",
    "dashboard",
    period,
  ],
  adminRecentActivity: (limit) => [
    "admin",
    "recent-activity",
    limit,
  ],
  serverTime: ["admin", "server-time"],
  organizationDashboard: [
    "organization",
    "dashboard",
  ],
  organizationCompaniesDropdown: [
    "organization",
    "companies",
    "dropdown",
  ],
  organizationSites: (params) => [
    "organization",
    "sites",
    params,
  ],
  organizationSiteExport: (params) => [
    "organization",
    "sites",
    "export",
    params,
  ],
});
