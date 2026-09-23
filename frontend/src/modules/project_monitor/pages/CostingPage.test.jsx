import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CostingPage } from "./CostingPage";

const hooks = vi.hoisted(() => ({
  useCostingAccess: vi.fn(),
  useCostingGlance: vi.fn(),
  useCostingTable: vi.fn(),
  useMaterialRates: vi.fn(),
  useConcreteProduction: vi.fn(),
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
  useOverdueCounts: () => ({ data: {} }),
  useCostingAccess: (...a) => hooks.useCostingAccess(...a),
  useCostingGlance: (...a) => hooks.useCostingGlance(...a),
  useCostingTable: (...a) => hooks.useCostingTable(...a),
  useMaterialRates: (...a) => hooks.useMaterialRates(...a),
  useCreateMaterialRate: () => mutation,
  useDeleteMaterialRate: () => mutation,
  useConcreteProduction: (...a) =>
    hooks.useConcreteProduction(...a),
  useCreateConcreteProduction: () => mutation,
  useDeleteConcreteProduction: () => mutation,
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: "ADMIN" } }),
}));

const GLANCE = {
  as_on: "2026-09-19",
  today: {
    value: "0.00",
    total_expense: "0.00",
    margin: "0.00",
    expense_ratio: null,
    flagged: false,
    concrete_cum: "0.000",
    concrete_source: "NONE",
  },
  yesterday: {
    value: "0.00",
    total_expense: "0.00",
    margin: "0.00",
    expense_ratio: null,
    flagged: false,
  },
  month_to_date: {
    value: "0.00",
    total_expense: "0.00",
    margin: "0.00",
    expense_ratio: null,
  },
  cumulative: null,
  labour_on_site_today: "0.00",
};

function renderPage() {
  render(
    <MemoryRouter
      initialEntries={["/admin/project-monitor/costing?site=site-1"]}
    >
      <CostingPage />
    </MemoryRouter>,
  );
}

describe("CostingPage", () => {
  beforeEach(() => {
    hooks.useCostingAccess.mockReturnValue({
      data: { can_enter: true },
    });
    hooks.useCostingGlance.mockReturnValue({
      isLoading: false,
      isError: false,
      data: GLANCE,
    });
    hooks.useCostingTable.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { start: "", end: "", days: [], totals: {} },
    });
    hooks.useMaterialRates.mockReturnValue({ data: [] });
    hooks.useConcreteProduction.mockReturnValue({ data: [] });
  });

  it("shows Today at a glance by default", () => {
    renderPage();

    expect(
      screen.getByText("Labour on site today"),
    ).toBeInTheDocument();
  });

  it("switches to the cost table workspace", () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("tab", { name: /cost table/i }),
    );

    expect(
      screen.getByText("Nothing recorded in this range."),
    ).toBeInTheDocument();
  });

  it("switches to rates and production", () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("tab", { name: /rates & production/i }),
    );

    expect(screen.getByText("Material rates")).toBeInTheDocument();
    expect(
      screen.getByText("Concrete production (stores)"),
    ).toBeInTheDocument();
  });

  it("asks to pick a project first", () => {
    render(
      <MemoryRouter initialEntries={["/admin/project-monitor/costing"]}>
        <CostingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Pick a project to get started"),
    ).toBeInTheDocument();
  });
});
