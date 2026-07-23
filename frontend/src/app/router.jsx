import {
  createBrowserRouter,
} from "react-router-dom";

import { AdminLayout } from "../layouts/AdminLayout";
import { AuthLayout } from "../layouts/AuthLayout";
import { UserLayout } from "../layouts/UserLayout";
import { AdminDashboardPage } from "../modules/admin/pages/AdminDashboardPage";
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
import { ChangePasswordPage } from "../modules/auth/pages/ChangePasswordPage";
import { LoginPage } from "../modules/auth/pages/LoginPage";
import { CreateTrackerPage } from "../modules/user/pages/CreateTrackerPage";
import { UserDashboardPage } from "../modules/user/pages/UserDashboardPage";
import { UserRequestsPage } from "../modules/user/pages/UserRequestsPage";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { RootRedirectPage } from "../pages/RootRedirectPage";
import { AdminRoute } from "../routes/AdminRoute";
import { GuestRoute } from "../routes/GuestRoute";
import { ProtectedRoute } from "../routes/ProtectedRoute";
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
        element: <UserLayout />,
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
            path: "/user/requests/new",
            element: <CreateTrackerPage />,
          },
          {
            path: "/user/requests/:requestId/continue",
            element: <CreateTrackerPage />,
          },
        ],
      },
      {
        element: <AdminRoute />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              {
                path: "/admin/dashboard",
                element:
                  <AdminDashboardPage />,
              },
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
                path: "/admin/reports",
                element:
                  <PlaceholderAdminPage />,
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
