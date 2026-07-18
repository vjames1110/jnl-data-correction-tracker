import {
  createBrowserRouter,
} from "react-router-dom";

import { AdminLayout } from "../layouts/AdminLayout";
import { AuthLayout } from "../layouts/AuthLayout";
import { AdminDashboardPage } from "../modules/admin/pages/AdminDashboardPage";
import { PlaceholderAdminPage } from "../modules/admin/pages/PlaceholderAdminPage";
import { ChangePasswordPage } from "../modules/auth/pages/ChangePasswordPage";
import { LoginPage } from "../modules/auth/pages/LoginPage";
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
                  <PlaceholderAdminPage />,
              },
              {
                path: "/admin/organization",
                element:
                  <PlaceholderAdminPage />,
              },
              {
                path: "/admin/vouchers",
                element:
                  <PlaceholderAdminPage />,
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
