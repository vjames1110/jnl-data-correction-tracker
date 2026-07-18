import {
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

import { USER_ROLES } from "../../../constants/roles";
import { LoginPage } from "./LoginPage";

const { loginMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    login: loginMock,
  }),
}));

function renderLoginPage() {
  render(
    <MemoryRouter initialEntries={["/admin/login"]}>
      <Routes>
        <Route
          path="/admin/login"
          element={<LoginPage />}
        />
        <Route
          path="/admin/dashboard"
          element={<div>Dashboard</div>}
        />
        <Route
          path="/admin/change-password"
          element={<div>Change Password</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("logs admin users into the dashboard", async () => {
    loginMock.mockResolvedValue({
      must_change_password: false,
      user: {
        role: USER_ROLES.ADMIN,
      },
    });

    renderLoginPage();

    await userEvent.type(
      screen.getByLabelText(/employee id/i),
      "JNL00001",
    );
    await userEvent.type(
      screen.getByLabelText(/^password$/i),
      "Password@123",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /sign in/i,
      }),
    );

    expect(
      await screen.findByText("Dashboard"),
    ).toBeInTheDocument();
  });

  it("redirects temporary-password users", async () => {
    loginMock.mockResolvedValue({
      must_change_password: true,
      user: {
        role: USER_ROLES.ADMIN,
      },
    });

    renderLoginPage();

    await userEvent.type(
      screen.getByLabelText(/employee id/i),
      "JNL00001",
    );
    await userEvent.type(
      screen.getByLabelText(/^password$/i),
      "Password@123",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /sign in/i,
      }),
    );

    expect(
      await screen.findByText("Change Password"),
    ).toBeInTheDocument();
  });
});
