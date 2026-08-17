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
  employeeDropdown: (params) => [
    "employees",
    "dropdown",
    params,
  ],
  employeeImportColumns: [
    "employees",
    "import-columns",
  ],
  siteImportColumns: [
    "organization",
    "sites",
    "import-columns",
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
  erpDashboard: ["erp", "dashboard"],
  erpModulesDropdown: [
    "erp",
    "modules",
    "dropdown",
  ],
  erpModules: (params) => [
    "erp",
    "modules",
    params,
  ],
  erpModuleExport: (params) => [
    "erp",
    "modules",
    "export",
    params,
  ],
  erpVoucherTypes: (params) => [
    "erp",
    "voucher-types",
    params,
  ],
  erpVoucherTypeExport: (params) => [
    "erp",
    "voucher-types",
    "export",
    params,
  ],
  erpVoucherTypesDropdown: [
    "erp",
    "voucher-types",
    "dropdown",
  ],
  erpWorkTypes: (params) => [
    "erp",
    "work-types",
    params,
  ],
  erpWorkTypeExport: (params) => [
    "erp",
    "work-types",
    "export",
    params,
  ],
  erpWorkTypesDropdown: [
    "erp",
    "work-types",
    "dropdown",
  ],
  erpReasonCategories: (params) => [
    "erp",
    "reason-categories",
    params,
  ],
  erpReasonCategoryExport: (params) => [
    "erp",
    "reason-categories",
    "export",
    params,
  ],
  erpReasonCategoriesDropdown: [
    "erp",
    "reason-categories",
    "dropdown",
  ],
  erpPriorities: (params) => [
    "erp",
    "priorities",
    params,
  ],
  erpPriorityExport: (params) => [
    "erp",
    "priorities",
    "export",
    params,
  ],
  erpPrioritiesDropdown: [
    "erp",
    "priorities",
    "dropdown",
  ],
  erpResponsiblePersonMappings: (params) => [
    "erp",
    "responsible-person-mappings",
    params,
  ],
  erpResponsiblePersonMappingExport: (
    params,
  ) => [
    "erp",
    "responsible-person-mappings",
    "export",
    params,
  ],
  erpRequestFieldConfigurations: (params) => [
    "erp",
    "request-field-configurations",
    params,
  ],
  erpRequestFieldConfigurationExport: (
    params,
  ) => [
    "erp",
    "request-field-configurations",
    "export",
    params,
  ],
  correctionRequests: (params) => [
    "corrections",
    "requests",
    params,
  ],
  correctionRequest: (id) => [
    "corrections",
    "requests",
    id,
  ],
  correctionMyRequests: (params) => [
    "corrections",
    "requests",
    "my",
    params,
  ],
  correctionMyAssignments: (params) => [
    "corrections",
    "requests",
    "my-assignments",
    params,
  ],
  correctionAssignmentCounts: [
    "corrections",
    "requests",
    "assignment-counts",
  ],
  correctionAssignmentAnalytics: [
    "corrections",
    "requests",
    "assignment-analytics",
  ],
  correctionDashboard: [
    "corrections",
    "dashboard",
  ],
  correctionAnalytics: [
    "corrections",
    "analytics",
  ],
  correctionTimeline: (requestId) => [
    "corrections",
    "timeline",
    requestId,
  ],
  correctionAttachments: (requestId) => [
    "corrections",
    "attachments",
    requestId,
  ],
  approvalInbox: (params) => [
    "corrections",
    "approvals",
    "inbox",
    params,
  ],
  approvalStep: (id) => [
    "corrections",
    "approvals",
    id,
  ],
  approvalSteps: (params) => [
    "corrections",
    "approvals",
    params,
  ],
  approvalHistory: (id) => [
    "corrections",
    "approvals",
    id,
    "history",
  ],
  approvalPendingCounts: [
    "corrections",
    "approvals",
    "pending-counts",
  ],
  notifications: (params) => [
    "notifications",
    "list",
    params,
  ],
  notification: (id) => [
    "notifications",
    "detail",
    id,
  ],
  notificationUnreadCount: [
    "notifications",
    "unread-count",
  ],
  notificationPreferences: [
    "notifications",
    "preferences",
  ],
});
