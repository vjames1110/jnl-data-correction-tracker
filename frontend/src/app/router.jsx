import {
  createBrowserRouter,
} from "react-router-dom";

import { AuthLayout } from "../layouts/AuthLayout";
import { JnlOpsLayout } from "../layouts/JnlOpsLayout";
import { AdminDashboardPage } from "../modules/admin/pages/AdminDashboardPage";
import { CorrectionRequestManagementPage } from "../modules/admin/pages/CorrectionRequestManagementPage";
import { DepartmentManagementPage } from "../modules/admin/pages/DepartmentManagementPage";
import { DesignationManagementPage } from "../modules/admin/pages/DesignationManagementPage";
import { DirectorMappingPage } from "../modules/admin/pages/DirectorMappingPage";
import { EmployeeManagementPage } from "../modules/admin/pages/EmployeeManagementPage";
import { ErpDashboardPage } from "../modules/admin/pages/ErpDashboardPage";
import { ErpFieldConfigurationPage } from "../modules/admin/pages/ErpFieldConfigurationPage";
import { ErpImportExportPage } from "../modules/admin/pages/ErpImportExportPage";
import { ErpModuleManagementPage } from "../modules/admin/pages/ErpModuleManagementPage";
import { ErpPriorityManagementPage } from "../modules/admin/pages/ErpPriorityManagementPage";
import { ErpReasonCategoryManagementPage } from "../modules/admin/pages/ErpReasonCategoryManagementPage";
import { ErpResponsibleMappingPage } from "../modules/admin/pages/ErpResponsibleMappingPage";
import { ErpVoucherTypeManagementPage } from "../modules/admin/pages/ErpVoucherTypeManagementPage";
import { ErpWorkTypeManagementPage } from "../modules/admin/pages/ErpWorkTypeManagementPage";
import { HodMappingPage } from "../modules/admin/pages/HodMappingPage";
import { OrganizationDashboardPage } from "../modules/admin/pages/OrganizationDashboardPage";
import { PlaceholderAdminPage } from "../modules/admin/pages/PlaceholderAdminPage";
import { SiteManagementPage } from "../modules/admin/pages/SiteManagementPage";
import { StoreItemCategoryManagementPage } from "../modules/admin/pages/StoreItemCategoryManagementPage";
import { StoreItemManagementPage } from "../modules/admin/pages/StoreItemManagementPage";
import { StoreItemStandardManagementPage } from "../modules/admin/pages/StoreItemStandardManagementPage";
import { StoreReconciliationDashboardPage } from "../modules/admin/pages/StoreReconciliationDashboardPage";
import { StoreSiteItemConfigManagementPage } from "../modules/admin/pages/StoreSiteItemConfigManagementPage";
import { StoreToleranceSettingsPage } from "../modules/admin/pages/StoreToleranceSettingsPage";
import { ChangePasswordPage } from "../modules/auth/pages/ChangePasswordPage";
import { LoginPage } from "../modules/auth/pages/LoginPage";
import { NotificationsPage } from "../modules/notifications/pages/NotificationsPage";
import { ProjectOverviewPage } from "../modules/project_monitor/pages/ProjectOverviewPage";
import { StructuresPage } from "../modules/project_monitor/pages/StructuresPage";
import { BuildingsPage } from "../modules/project_monitor/pages/BuildingsPage";
import { GirdersPage } from "../modules/project_monitor/pages/GirdersPage";
import { ActionItemsPage } from "../modules/project_monitor/pages/ActionItemsPage";
import { ProjectDashboardPage } from "../modules/project_monitor/pages/ProjectDashboardPage";
import { CostingPage } from "../modules/project_monitor/pages/CostingPage";
import { HrPage } from "../modules/project_monitor/pages/HrPage";
import { MachineryPage } from "../modules/project_monitor/pages/MachineryPage";
import { DprBillsPage } from "../modules/project_monitor/pages/DprBillsPage";
import { LinearWorksPage } from "../modules/project_monitor/pages/LinearWorksPage";
import { ProjectMonitorReportPage } from "../modules/project_monitor/pages/ProjectMonitorReportPage";
import { ProjectMonitorSiteAccessPage } from "../modules/admin/pages/ProjectMonitorSiteAccessPage";
import { RdsoSpanLibraryPage } from "../modules/admin/pages/RdsoSpanLibraryPage";
import { StructureTypeManagementPage } from "../modules/admin/pages/StructureTypeManagementPage";
import { DirectorAnalyticsPage } from "../modules/director/pages/DirectorAnalyticsPage";
import { DirectorApprovalDetailPage } from "../modules/director/pages/DirectorApprovalDetailPage";
import { DirectorApprovalInboxPage } from "../modules/director/pages/DirectorApprovalInboxPage";
import { DirectorDashboardPage } from "../modules/director/pages/DirectorDashboardPage";
import { DirectorExportPage } from "../modules/director/pages/DirectorExportPage";
import { ResponsibleAnalyticsPage } from "../modules/responsible/pages/ResponsibleAnalyticsPage";
import { ResponsibleAssignmentDetailPage } from "../modules/responsible/pages/ResponsibleAssignmentDetailPage";
import { ResponsibleAssignmentsPage } from "../modules/responsible/pages/ResponsibleAssignmentsPage";
import { ResponsibleDashboardPage } from "../modules/responsible/pages/ResponsibleDashboardPage";
import { StoreApprovalInboxPage } from "../modules/store/pages/StoreApprovalInboxPage";
import { StoreDashboardPage } from "../modules/store/pages/StoreDashboardPage";
import { StoreEntryPage } from "../modules/store/pages/StoreEntryPage";
import { StoreReconciliationReportsPage } from "../modules/store/pages/StoreReconciliationReportsPage";
import { StoreSettingsPage } from "../modules/store/pages/StoreSettingsPage";
import { StoreStatementPackPage } from "../modules/store/pages/StoreStatementPackPage";
import { CreateTrackerPage } from "../modules/user/pages/CreateTrackerPage";
import { RequestDetailsPage } from "../modules/user/pages/RequestDetailsPage";
import { UserAnalyticsPage } from "../modules/user/pages/UserAnalyticsPage";
import { UserDashboardPage } from "../modules/user/pages/UserDashboardPage";
import { UserRequestsPage } from "../modules/user/pages/UserRequestsPage";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { RootRedirectPage } from "../pages/RootRedirectPage";
import { AdminRoute } from "../routes/AdminRoute";
import { AdministrationRoute } from "../routes/AdministrationRoute";
import { DirectorRoute } from "../routes/DirectorRoute";
import { GuestRoute } from "../routes/GuestRoute";
import { ProtectedRoute } from "../routes/ProtectedRoute";
import { ProjectManagerRoute } from "../routes/ProjectManagerRoute";
import { ProjectMasterRoute } from "../routes/ProjectMasterRoute";
import { ResponsibleRoute } from "../routes/ResponsibleRoute";
import { StoreHoRoute } from "../routes/StoreHoRoute";
import { StoreRoute } from "../routes/StoreRoute";
import { UserRoute } from "../routes/UserRoute";
import { CapabilityRoute } from "../routes/CapabilityRoute";
import {
  ADMIN_CAPABILITIES,
} from "../constants/adminCapabilities";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirectPage />,
  },
  {
    element: <GuestRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            path: "/admin/login",
            element: <LoginPage />,
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/admin/change-password",
        element: <ChangePasswordPage />,
      },
      {
        element: <UserRoute />,
        children: [
          {
            element: <JnlOpsLayout />,
            children: [
              {
                path: "/user/dashboard",
                element: <UserDashboardPage />,
              },
              {
                path: "/user/requests",
                element: <UserRequestsPage />,
              },
              {
                path: "/user/analytics",
                element: <UserAnalyticsPage />,
              },
              {
                path: "/user/requests/new",
                element: <CreateTrackerPage />,
              },
              {
                path: "/user/requests/:requestId/continue",
                element: <CreateTrackerPage />,
              },
              {
                path: "/user/requests/:requestId",
                element: <RequestDetailsPage />,
              },
              {
                path: "/user/notifications",
                element: <NotificationsPage />,
              },
            ],
          },
        ],
      },
      {
        element: <ResponsibleRoute />,
        children: [
          {
            element: <JnlOpsLayout />,
            children: [
              {
                path: "/responsible/dashboard",
                element:
                  <ResponsibleDashboardPage />,
              },
              {
                path: "/responsible/assignments",
                element:
                  <ResponsibleAssignmentsPage />,
              },
              {
                path: "/responsible/assignments/:assignmentId",
                element:
                  <ResponsibleAssignmentDetailPage />,
              },
              {
                path: "/responsible/analytics",
                element:
                  <ResponsibleAnalyticsPage />,
              },
              {
                path: "/responsible/notifications",
                element:
                  <NotificationsPage />,
              },
            ],
          },
        ],
      },
      {
        element: <StoreRoute />,
        children: [
          {
            element: <JnlOpsLayout />,
            children: [
              {
                path: "/store/dashboard",
                element:
                  <StoreDashboardPage />,
              },
              {
                path: "/store/entry",
                element: <StoreEntryPage />,
              },
              {
                path: "/store/reports",
                element: (
                  <StoreReconciliationReportsPage />
                ),
              },
              {
                path: "/store/statement-pack",
                element: (
                  <StoreStatementPackPage />
                ),
              },
              {
                path: "/store/settings",
                element: <StoreHoRoute />,
                children: [
                  {
                    index: true,
                    element: (
                      <StoreSettingsPage />
                    ),
                  },
                  {
                    path: "categories",
                    element: (
                      <StoreItemCategoryManagementPage />
                    ),
                  },
                  {
                    path: "items",
                    element: (
                      <StoreItemManagementPage />
                    ),
                  },
                  {
                    path: "standards",
                    element: (
                      <StoreItemStandardManagementPage />
                    ),
                  },
                  {
                    path: "site-configs",
                    element: (
                      <StoreSiteItemConfigManagementPage />
                    ),
                  },
                  {
                    path: "tolerance-settings",
                    element: (
                      <StoreToleranceSettingsPage />
                    ),
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        element: <ProjectManagerRoute />,
        children: [
          {
            element: <JnlOpsLayout />,
            children: [
              {
                path: "/project-manager/dashboard",
                element: (
                  <ProjectOverviewPage />
                ),
              },
              {
                path: "/project-manager/structures",
                element: (
                  <StructuresPage />
                ),
              },
              {
                path: "/project-manager/buildings",
                element: (
                  <BuildingsPage />
                ),
              },
              {
                path: "/project-manager/girders",
                element: (
                  <GirdersPage />
                ),
              },
              {
                path: "/project-manager/action-items",
                element: (
                  <ActionItemsPage />
                ),
              },
              {
                path: "/project-manager/linear-works",
                element: (
                  <LinearWorksPage />
                ),
              },
              {
                path: "/project-manager/projects",
                element: (
                  <ProjectDashboardPage />
                ),
              },
              {
                path: "/project-manager/machinery",
                element: <MachineryPage />,
              },
              {
                path: "/project-manager/hr",
                element: <HrPage />,
              },
              {
                path: "/project-manager/dpr-bills",
                element: (
                  <DprBillsPage />
                ),
              },
              {
                path: "/project-manager/reports",
                element: (
                  <ProjectMonitorReportPage />
                ),
              },
              {
                element: <ProjectMasterRoute />,
                children: [
                  {
                    path: "/project-manager/structure-types",
                    element: (
                      <StructureTypeManagementPage />
                    ),
                  },
                  {
                    path: "/project-manager/rdso-span-library",
                    element: (
                      <RdsoSpanLibraryPage />
                    ),
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        element: <DirectorRoute />,
        children: [
          {
            element: <JnlOpsLayout />,
            children: [
              {
                path: "/director/dashboard",
                element:
                  <DirectorDashboardPage />,
              },
              {
                path: "/director/approvals",
                element:
                  <DirectorApprovalInboxPage />,
              },
              {
                path: "/director/approvals/:approvalId",
                element:
                  <DirectorApprovalDetailPage />,
              },
              {
                path: "/director/analytics",
                element:
                  <DirectorAnalyticsPage />,
              },
              {
                path: "/director/reconciliation",
                element: (
                  <StoreReconciliationReportsPage />
                ),
              },
              {
                path: "/director/reconciliation-pack",
                element: (
                  <StoreStatementPackPage />
                ),
              },
              {
                path: "/director/reconciliation-approvals",
                element: (
                  <StoreApprovalInboxPage />
                ),
              },
              {
                path: "/director/reconciliation-entry",
                element: <StoreEntryPage />,
              },
              {
                path: "/director/project-monitor",
                element: (
                  <ProjectOverviewPage />
                ),
              },
              {
                path: "/director/project-monitor/structures",
                element: (
                  <StructuresPage />
                ),
              },
              {
                path: "/director/project-monitor/buildings",
                element: (
                  <BuildingsPage />
                ),
              },
              {
                path: "/director/project-monitor/girders",
                element: (
                  <GirdersPage />
                ),
              },
              {
                path: "/director/project-monitor/action-items",
                element: (
                  <ActionItemsPage />
                ),
              },
              {
                path: "/director/project-monitor/linear-works",
                element: (
                  <LinearWorksPage />
                ),
              },
              {
                path: "/director/project-monitor/projects",
                element: (
                  <ProjectDashboardPage />
                ),
              },
              {
                path: "/director/project-monitor/machinery",
                element: <MachineryPage />,
              },
              {
                path: "/director/project-monitor/hr",
                element: <HrPage />,
              },
              {
                path: "/director/project-monitor/dpr-bills",
                element: (
                  <DprBillsPage />
                ),
              },
              {
                path: "/director/project-monitor/reports",
                element: (
                  <ProjectMonitorReportPage />
                ),
              },
              {
                path: "/director/project-monitor/costing",
                element: <CostingPage />,
              },
              {
                element: <ProjectMasterRoute />,
                children: [
                  {
                    path: "/director/project-monitor/structure-types",
                    element: (
                      <StructureTypeManagementPage />
                    ),
                  },
                  {
                    path: "/director/project-monitor/rdso-span-library",
                    element: (
                      <RdsoSpanLibraryPage />
                    ),
                  },
                ],
              },
              {
                path: "/director/export",
                element:
                  <DirectorExportPage />,
              },
              {
                path: "/director/notifications",
                element:
                  <NotificationsPage />,
              },
            ],
          },
        ],
      },
      {
        element: <AdministrationRoute />,
        children: [
          {
            element: <JnlOpsLayout />,
            children: [
              {
                path: "/admin/users",
                element:
                  <EmployeeManagementPage />,
              },
              {
                path: "/admin/organization",
                element:
                  <OrganizationDashboardPage />,
              },
              {
                path: "/admin/organization/sites",
                element:
                  <SiteManagementPage />,
              },
              {
                path: "/admin/organization/departments",
                element:
                  <DepartmentManagementPage />,
              },
              {
                path: "/admin/organization/designations",
                element:
                  <DesignationManagementPage />,
              },
              {
                path: "/admin/organization/director-mappings",
                element:
                  <DirectorMappingPage />,
              },
              {
                path: "/admin/organization/hod-mappings",
                element:
                  <HodMappingPage />,
              },
              {
                path: "/admin/project-monitor/site-access",
                element: (
                  <ProjectMonitorSiteAccessPage />
                ),
              },
            ],
          },
        ],
      },
      {
        element: <AdminRoute />,
        children: [
          {
            element: <JnlOpsLayout />,
            children: [
              {
                path: "/admin/dashboard",
                element:
                  <AdminDashboardPage />,
              },
              {
                path: "/admin/requests",
                element:
                  <CorrectionRequestManagementPage />,
              },
              {
                path: "/admin/vouchers",
                element:
                  <ErpDashboardPage />,
              },
              {
                path: "/admin/vouchers/modules",
                element:
                  <ErpModuleManagementPage />,
              },
              {
                path: "/admin/vouchers/voucher-types",
                element:
                  <ErpVoucherTypeManagementPage />,
              },
              {
                path: "/admin/vouchers/work-types",
                element:
                  <ErpWorkTypeManagementPage />,
              },
              {
                path: "/admin/vouchers/reasons",
                element:
                  <ErpReasonCategoryManagementPage />,
              },
              {
                path: "/admin/vouchers/priorities",
                element:
                  <ErpPriorityManagementPage />,
              },
              {
                path: "/admin/vouchers/mappings",
                element:
                  <ErpResponsibleMappingPage />,
              },
              {
                path: "/admin/vouchers/fields",
                element:
                  <ErpFieldConfigurationPage />,
              },
              {
                path: "/admin/vouchers/import-export",
                element:
                  <ErpImportExportPage />,
              },
              {
                path: "/admin/reconciliation",
                element:
                  <StoreReconciliationDashboardPage />,
              },
              {
                path: "/admin/project-monitor",
                element: (
                  <ProjectOverviewPage />
                ),
              },
              {
                path: "/admin/project-monitor/structures",
                element: (
                  <StructuresPage />
                ),
              },
              {
                path: "/admin/project-monitor/buildings",
                element: (
                  <BuildingsPage />
                ),
              },
              {
                path: "/admin/project-monitor/girders",
                element: (
                  <GirdersPage />
                ),
              },
              {
                path: "/admin/project-monitor/action-items",
                element: (
                  <ActionItemsPage />
                ),
              },
              {
                path: "/admin/project-monitor/linear-works",
                element: (
                  <LinearWorksPage />
                ),
              },
              {
                path: "/admin/project-monitor/projects",
                element: (
                  <ProjectDashboardPage />
                ),
              },
              {
                path: "/admin/project-monitor/machinery",
                element: <MachineryPage />,
              },
              {
                path: "/admin/project-monitor/hr",
                element: <HrPage />,
              },
              {
                path: "/admin/project-monitor/dpr-bills",
                element: (
                  <DprBillsPage />
                ),
              },
              {
                path: "/admin/project-monitor/reports",
                element: (
                  <ProjectMonitorReportPage />
                ),
              },
              {
                path: "/admin/project-monitor/costing",
                element: <CostingPage />,
              },
              {
                path: "/admin/project-monitor/structure-types",
                element: (
                  <StructureTypeManagementPage />
                ),
              },
              {
                path: "/admin/project-monitor/rdso-span-library",
                element: (
                  <RdsoSpanLibraryPage />
                ),
              },
              {
                path: "/admin/reconciliation/categories",
                element:
                  <StoreItemCategoryManagementPage />,
              },
              {
                path: "/admin/reconciliation/items",
                element:
                  <StoreItemManagementPage />,
              },
              {
                path: "/admin/reconciliation/standards",
                element:
                  <StoreItemStandardManagementPage />,
              },
              {
                path: "/admin/reconciliation/site-configs",
                element:
                  <StoreSiteItemConfigManagementPage />,
              },
              {
                path: "/admin/reconciliation/tolerance-settings",
                element:
                  <StoreToleranceSettingsPage />,
              },
              {
                path: "/admin/reconciliation/approvals",
                element: (
                  <StoreApprovalInboxPage />
                ),
              },
              {
                path: "/admin/reconciliation/reports",
                element: (
                  <StoreReconciliationReportsPage />
                ),
              },
              {
                path: "/admin/reconciliation/statement-pack",
                element: (
                  <StoreStatementPackPage />
                ),
              },
              {
                path: "/admin/reports",
                element:
                  <PlaceholderAdminPage />,
              },
              {
                path: "/admin/notifications",
                element:
                  <NotificationsPage />,
              },
              {
                path: "/admin/audit",
                element: (
                  <CapabilityRoute
                    requiredCapability={
                      ADMIN_CAPABILITIES
                        .VIEW_AUDIT_LOGS
                    }
                  />
                ),
                children: [
                  {
                    index: true,
                    element:
                      <PlaceholderAdminPage />,
                  },
                ],
              },
              {
                path: "/admin/settings",
                element: (
                  <CapabilityRoute
                    requiredCapability={
                      ADMIN_CAPABILITIES
                        .MANAGE_SYSTEM_SETTINGS
                    }
                  />
                ),
                children: [
                  {
                    index: true,
                    element:
                      <PlaceholderAdminPage />,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "/forbidden",
    element: <ForbiddenPage />,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
