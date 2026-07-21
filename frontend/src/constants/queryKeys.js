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
  organizationSitesDropdown: [
    "organization",
    "sites",
    "dropdown",
  ],
  organizationDepartmentsDropdown: [
    "organization",
    "departments",
    "dropdown",
  ],
  organizationUsersDropdown: [
    "organization",
    "users",
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
  organizationDepartments: (params) => [
    "organization",
    "departments",
    params,
  ],
  organizationDepartmentExport: (params) => [
    "organization",
    "departments",
    "export",
    params,
  ],
  organizationDesignations: (params) => [
    "organization",
    "designations",
    params,
  ],
  organizationDesignationExport: (params) => [
    "organization",
    "designations",
    "export",
    params,
  ],
  organizationDirectorMappings: (params) => [
    "organization",
    "director-mappings",
    params,
  ],
  organizationDirectorMappingExport: (params) => [
    "organization",
    "director-mappings",
    "export",
    params,
  ],
});
