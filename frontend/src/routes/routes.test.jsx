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
import { DirectorRoute } from "./DirectorRoute";
import { GuestRoute } from "./GuestRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { ResponsibleRoute } from "./ResponsibleRoute";

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
        <Route
          path="/director/dashboard"
          element={<div>Director Dashboard</div>}
        />
        <Route
          path="/responsible/dashboard"
          element={
            <div>Responsible Dashboard</div>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDirectorRoute(
  initialPath = "/director/approvals",
) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={<DirectorRoute />}
        >
          <Route
            path="/director/approvals"
            element={<div>Director Inbox</div>}
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

function renderResponsibleRoute(
  initialPath = "/responsible/dashboard",
) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={<ResponsibleRoute />}
        >
          <Route
            path="/responsible/dashboard"
            element={
              <div>Responsible Dashboard</div>
            }
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

  it("sends director users from login to their inbox", async () => {
    useAuthMock.mockReturnValue({
      isInitializing: false,
      isAuthenticated: true,
      user: {
        role: USER_ROLES.DIRECTOR,
      },
    });

    renderGuestRoute();

    expect(
      await screen.findByText(
        "Director Dashboard",
      ),
    ).toBeInTheDocument();
  });

  it("sends responsible users from login to their dashboard", async () => {
    useAuthMock.mockReturnValue({
      isInitializing: false,
      isAuthenticated: true,
      user: {
        role: USER_ROLES.RESPONSIBLE_PERSON,
      },
    });

    renderGuestRoute();

    expect(
      await screen.findByText(
        "Responsible Dashboard",
      ),
    ).toBeInTheDocument();
  });

  it("allows director users through director routes", () => {
    useAuthMock.mockReturnValue({
      user: {
        role: USER_ROLES.DIRECTOR,
        must_change_password: false,
      },
    });

    renderDirectorRoute();

    expect(
      screen.getByText("Director Inbox"),
    ).toBeInTheDocument();
  });

  it("blocks normal users from director routes", async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: USER_ROLES.USER,
        must_change_password: false,
      },
    });

    renderDirectorRoute();

    expect(
      await screen.findByText("Forbidden"),
    ).toBeInTheDocument();
  });

  it("allows responsible users through responsible routes", () => {
    useAuthMock.mockReturnValue({
      user: {
        role: USER_ROLES.RESPONSIBLE_PERSON,
        must_change_password: false,
      },
    });

    renderResponsibleRoute();

    expect(
      screen.getByText("Responsible Dashboard"),
    ).toBeInTheDocument();
  });

  it("blocks normal users from responsible routes", async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: USER_ROLES.USER,
        must_change_password: false,
      },
    });

    renderResponsibleRoute();

    expect(
      await screen.findByText("Forbidden"),
    ).toBeInTheDocument();
  });
});
