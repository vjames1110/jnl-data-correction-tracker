import {
  render,
  screen,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { USER_ROLES } from "../constants/roles";
import { AdminRoute } from "./AdminRoute";
import { GuestRoute } from "./GuestRoute";
import { ProtectedRoute } from "./ProtectedRoute";

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

function renderProtectedRoute(
  initialPath = "/admin/dashboard",
) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={<ProtectedRoute />}
        >
          <Route
            path="/admin/dashboard"
            element={<div>Dashboard</div>}
          />
        </Route>
        <Route
          path="/admin/login"
          element={<div>Login</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderAdminRoute(
  initialPath = "/admin/dashboard",
) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={<AdminRoute />}
        >
          <Route
            path="/admin/dashboard"
            element={<div>Dashboard</div>}
          />
        </Route>
        <Route
          path="/admin/change-password"
          element={<div>Change Password</div>}
        />
        <Route
          path="/forbidden"
          element={<div>Forbidden</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderGuestRoute(
  initialPath = "/admin/login",
) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={<GuestRoute />}
        >
          <Route
            path="/admin/login"
            element={<div>Login</div>}
          />
        </Route>
        <Route
          path="/admin/dashboard"
          element={<div>Dashboard</div>}
        />
        <Route
          path="/user/dashboard"
          element={<div>User Dashboard</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("route guards", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("sends unauthenticated users to login", async () => {
    useAuthMock.mockReturnValue({
      isInitializing: false,
      isAuthenticated: false,
      sessionEndReason: null,
    });

    renderProtectedRoute();

    expect(
      await screen.findByText("Login"),
    ).toBeInTheDocument();
  });

  it("allows authenticated users through protected routes", () => {
    useAuthMock.mockReturnValue({
      isInitializing: false,
      isAuthenticated: true,
      user: {
        role: USER_ROLES.USER,
      },
    });

    renderProtectedRoute();

    expect(
      screen.getByText("Dashboard"),
    ).toBeInTheDocument();
  });

  it("sends temporary-password admins to password change", async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: USER_ROLES.ADMIN,
        must_change_password: true,
      },
    });

    renderAdminRoute();

    expect(
      await screen.findByText("Change Password"),
    ).toBeInTheDocument();
  });

  it("blocks non-admin users from admin routes", async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: USER_ROLES.DIRECTOR,
        must_change_password: false,
      },
    });

    renderAdminRoute();

    expect(
      await screen.findByText("Forbidden"),
    ).toBeInTheDocument();
  });

  it("keeps authenticated guests away from login", async () => {
    useAuthMock.mockReturnValue({
      isInitializing: false,
      isAuthenticated: true,
    });

    renderGuestRoute();

    expect(
      await screen.findByText("User Dashboard"),
    ).toBeInTheDocument();
  });
});
