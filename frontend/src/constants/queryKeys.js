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
  employeeDashboard: [
    "employees",
    "dashboard",
  ],
  employeeProfiles: (params) => [
    "employees",
    "profiles",
    params,
  ],
  employeeProfileExport: (params) => [
    "employees",
    "profiles",
    "export",
    params,
  ],
  employeeFilterOptions: [
    "employees",
    "filter-options",
  ],
  employeeDropdown: [
    "employees",
    "dropdown",
  ],
  employeeLoginHistory: (profileId) => [
    "employees",
    "profiles",
    profileId,
    "login-history",
  ],
  organizationDashboard: [
    "organization",
    "dashboard",
  ],
  organizationHodMappings: [
    "organization",
    "hod-mappings",
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
  organizationDesignationsDropdown: [
    "organization",
    "designations",
    "dropdown",
  ],
  organizationUsersDropdown: (params) => [
    "organization",
    "users",
    "dropdown",
    params,
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
