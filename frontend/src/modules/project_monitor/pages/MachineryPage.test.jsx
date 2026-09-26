import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { MachineryPage } from "./MachineryPage";

const hooks = vi.hoisted(() => ({
  useMachineryAccess: vi.fn(),
  useMachinerySummary: vi.fn(),
  useMachines: vi.fn(),
  useMachineUsage: vi.fn(),
  useFuelEntries: vi.fn(),
}));

const mutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
};

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useVisibleTasks: () => ({ isLoading: false, has: () => true }),
  useProjectSites: () => ({
    data: [{ id: "site-1", code: "CHK", label: "Chunar" }],
  }),
  useAutoSelectSite: () => {},
  useMachineryAccess: (...a) => hooks.useMachineryAccess(...a),
  useMachinerySummary: (...a) => hooks.useMachinerySummary(...a),
  useMachines: (...a) => hooks.useMachines(...a),
  useMachineUsage: (...a) => hooks.useMachineUsage(...a),
  useFuelEntries: (...a) => hooks.useFuelEntries(...a),
  useCreateMachine: () => mutation,
  useUpdateMachine: () => mutation,
  useDeleteMachine: () => mutation,
  useSaveMachineUsage: () => mutation,
  useDeleteMachineUsage: () => mutation,
  useCreateFuel: () => mutation,
  useDeleteFuel: () => mutation,
  useUploadMachinery: () => mutation,
  useOverdueCounts: () => ({ data: {} }),
}));

const auth = vi.hoisted(() => ({ role: "PROJECT_MANAGER" }));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: auth.role } }),
}));

const SUMMARY = {
  month: "2026-09",
  days: [
    {
      date: "2026-09-01",
      market_hire: "9000.00",
      ho_hire: "0.00",
      fuel: "0.00",
      maintenance: "0.00",
      other: "0.00",
      total: "9000.00",
    },
  ],
  totals: {
    market_hire: "9000.00",
    ho_hire: "0.00",
    fuel: "0.00",
    maintenance: "0.00",
    other: "0.00",
    total: "9000.00",
  },
  by_machine: [],
  site_fuel: "0.00",
};

const MACHINE = {
  id: "m1",
  name: "JCB 3DX",
  reg_no: "",
  source: "MARKET",
  agency: "",
  hire_basis: "DAY",
  rate: "9000.00",
  is_active: true,
  needs_review: false,
};

function renderPage() {
  render(
    <MemoryRouter
      initialEntries={["/project-manager/machinery?site=site-1"]}
    >
      <MachineryPage />
    </MemoryRouter>,
  );
}

describe("MachineryPage", () => {
  beforeEach(() => {
    auth.role = "PROJECT_MANAGER";
    hooks.useMachinerySummary.mockReturnValue({
      data: SUMMARY,
    });
    hooks.useMachines.mockReturnValue({ data: [MACHINE] });
    hooks.useMachineUsage.mockReturnValue({ data: [] });
    hooks.useFuelEntries.mockReturnValue({ data: [] });
  });

  it("explains the missing access to an unassigned Project Manager", () => {
    hooks.useMachineryAccess.mockReturnValue({
      data: { can_view: false, can_enter: false },
    });
    renderPage();

    expect(
      screen.getByText(
        "No access to this site's machinery data",
      ),
    ).toBeInTheDocument();
  });

  it("shows the cost table to someone who can view", () => {
    hooks.useMachineryAccess.mockReturnValue({
      data: { can_view: true, can_enter: false },
    });
    renderPage();

    expect(
      screen.getByText("Machinery cost this month"),
    ).toBeInTheDocument();
  });

  it("hides every entry form from a view-only user", () => {
    hooks.useMachineryAccess.mockReturnValue({
      data: { can_view: true, can_enter: false },
    });
    renderPage();

    screen.getByRole("tab", { name: /usage/i }).click();
    expect(
      screen.queryByRole("button", {
        name: /save machine day/i,
      }),
    ).toBeNull();
    screen.getByRole("tab", { name: /machines/i }).click();
    expect(
      screen.queryByRole("button", { name: /add machine/i }),
    ).toBeNull();
  });

  it("offers the entry forms to the assigned owner", async () => {
    hooks.useMachineryAccess.mockReturnValue({
      data: { can_view: true, can_enter: true },
    });
    renderPage();

    screen.getByRole("tab", { name: /usage/i }).click();
    expect(
      await screen.findByRole("button", {
        name: /save machine day/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add fuel/i }),
    ).toBeInTheDocument();
  });

  describe("bulk upload scope", () => {
    beforeEach(() => {
      hooks.useMachineryAccess.mockReturnValue({
        data: { can_view: true, can_enter: true },
      });
    });

    it("opens the Machinery Department on the all-sites upload", () => {
      auth.role = "MACHINERY_DEPARTMENT";
      renderPage();

      expect(
        screen.getByRole("region", {
          name: "Machine days, fuel and maintenance",
        }),
      ).toBeInTheDocument();
    });

    it("lets an Admin switch between one site and the bulk upload", () => {
      auth.role = "ADMIN";
      renderPage();

      expect(
        screen.queryByRole("region", {
          name: "Machine days, fuel and maintenance",
        }),
      ).toBeNull();
      fireEvent.click(
        screen.getByRole("tab", { name: /bulk upload/i }),
      );
      expect(
        screen.getByRole("region", {
          name: "Machine days, fuel and maintenance",
        }),
      ).toBeInTheDocument();
    });

    it("gives a Project Manager no bulk upload at all", () => {
      renderPage();

      expect(
        screen.queryByRole("tab", { name: /bulk upload/i }),
      ).toBeNull();
    });
  });
});
