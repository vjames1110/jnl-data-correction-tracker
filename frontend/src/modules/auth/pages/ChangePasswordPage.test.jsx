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

import {
  SESSION_END_REASONS,
} from "../../../constants/auth";
import { authService } from "../../../services/authService";
import { ChangePasswordPage } from "./ChangePasswordPage";

const {
  terminateLocalSessionMock,
  logoutMock,
} = vi.hoisted(() => ({
  terminateLocalSessionMock: vi.fn(),
  logoutMock: vi.fn(),
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      full_name: "Admin User",
    },
    logout: logoutMock,
    terminateLocalSession:
      terminateLocalSessionMock,
  }),
}));

vi.mock("../../../services/authService", () => ({
  authService: {
    changePassword: vi.fn(),
  },
}));

function renderChangePasswordPage() {
  render(
    <MemoryRouter
      initialEntries={["/admin/change-password"]}
    >
      <Routes>
        <Route
          path="/admin/change-password"
          element={<ChangePasswordPage />}
        />
        <Route
          path="/admin/login"
          element={<div>Login Page</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ChangePasswordPage", () => {
  beforeEach(() => {
    terminateLocalSessionMock.mockReset();
    logoutMock.mockReset();
    authService.changePassword.mockReset();
  });

  it("terminates local session after password change", async () => {
    authService.changePassword.mockResolvedValue({
      message:
        "Password changed successfully. Please sign in again.",
    });

    renderChangePasswordPage();

    await userEvent.type(
      screen.getByLabelText(/current password/i),
      "OldPassword@123",
    );
    await userEvent.type(
      screen.getByLabelText(/^new password$/i),
      "NewPassword@123",
    );
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      "NewPassword@123",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /change password/i,
      }),
    );

    expect(
      terminateLocalSessionMock,
    ).toHaveBeenCalledWith(
      SESSION_END_REASONS.PASSWORD_CHANGED,
    );
    expect(logoutMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Login Page"),
    ).toBeInTheDocument();
  });
});
