import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { describe, expect, it } from "vitest";

import { USER_ROLES } from "../../constants/roles";
import {
  getAccessibleModules,
  MODULES,
  MODULE_KEYS,
} from "../../navigation/moduleRegistry";
import { ModuleSwitcher } from "./ModuleSwitcher";

function Where() {
  return (
    <span data-testid="where">
      {useLocation().pathname}
    </span>
  );
}

function renderSwitcher({
  role = USER_ROLES.ADMIN,
  active = MODULE_KEYS.APPROVAL,
  collapsed = false,
} = {}) {
  render(
    <MemoryRouter initialEntries={["/start"]}>
      <ModuleSwitcher
        role={role}
        modules={getAccessibleModules(role)}
        activeModule={MODULES[active]}
        collapsed={collapsed}
      />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ModuleSwitcher", () => {
  it("lists exactly the modules the role can open", () => {
    renderSwitcher({ role: USER_ROLES.DIRECTOR });
    fireEvent.click(
      screen.getByRole("button", {
        name: /module: approval management/i,
      }),
    );

    // The Director opens Administration too (users and setup only).
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(4);
    expect(
      screen.getByRole("option", {
        name: /administration/i,
      }),
    ).toBeTruthy();
  });

  it("does not offer Administration to a Project Incharge", () => {
    renderSwitcher({ role: USER_ROLES.PROJECT_INCHARGE });

    expect(
      screen.queryByRole("option", {
        name: /administration/i,
      }),
    ).toBeNull();
  });

  it("shows all four modules to an Admin", () => {
    renderSwitcher();
    fireEvent.click(
      screen.getByRole("button", {
        name: /module: approval management/i,
      }),
    );
    expect(screen.getAllByRole("option")).toHaveLength(
      4,
    );
  });

  it("navigates to the chosen module's home", () => {
    renderSwitcher();
    fireEvent.click(
      screen.getByRole("button", {
        name: /module: approval management/i,
      }),
    );
    fireEvent.click(
      screen.getByRole("option", {
        name: /project management/i,
      }),
    );

    expect(screen.getByTestId("where")).toHaveTextContent(
      "/admin/project-monitor",
    );
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Escape without navigating", () => {
    renderSwitcher();
    fireEvent.click(
      screen.getByRole("button", {
        name: /module: approval management/i,
      }),
    );
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/start",
    );
  });

  it("has no picker for a single-module role", () => {
    renderSwitcher({
      role: USER_ROLES.PROJECT_MANAGER,
      active: MODULE_KEYS.PROJECT,
    });

    const trigger = screen.getByRole("button", {
      name: /module: project management/i,
    });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows one icon button per module when collapsed", () => {
    renderSwitcher({ collapsed: true });

    expect(screen.getAllByRole("button")).toHaveLength(
      4,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Administration",
      }),
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/admin/users",
    );
  });
});
