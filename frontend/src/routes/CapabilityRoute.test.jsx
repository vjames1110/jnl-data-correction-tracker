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

import { CapabilityRoute } from "./CapabilityRoute";

const { useAdminCapabilitiesMock } = vi.hoisted(
  () => ({
    useAdminCapabilitiesMock: vi.fn(),
  }),
);

vi.mock("../hooks/useAdminCapabilities", () => ({
  useAdminCapabilities: () =>
    useAdminCapabilitiesMock(),
}));

function renderCapabilityRoute() {
  render(
    <MemoryRouter initialEntries={["/admin/audit"]}>
      <Routes>
        <Route
          path="/admin/audit"
          element={
            <CapabilityRoute requiredCapability="view_audit_logs" />
          }
        >
          <Route
            index
            element={<div>Audit Logs</div>}
          />
        </Route>
        <Route
          path="/forbidden"
          element={<div>Forbidden</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CapabilityRoute", () => {
  beforeEach(() => {
    useAdminCapabilitiesMock.mockReset();
  });

  it("allows users with the required capability", () => {
    useAdminCapabilitiesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        capabilities: ["view_audit_logs"],
      },
    });

    renderCapabilityRoute();

    expect(
      screen.getByText("Audit Logs"),
    ).toBeInTheDocument();
  });

  it("blocks users without the required capability", async () => {
    useAdminCapabilitiesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        capabilities: [],
      },
    });

    renderCapabilityRoute();

    expect(
      await screen.findByText("Forbidden"),
    ).toBeInTheDocument();
  });
});
