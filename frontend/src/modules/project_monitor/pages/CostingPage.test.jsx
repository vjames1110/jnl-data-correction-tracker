import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CostingPage } from "./CostingPage";

const hooks = vi.hoisted(() => ({
  useCostingAccess: vi.fn(),
  useCostingGlance: vi.fn(),
  useCostingTable: vi.fn(),
  useCostingBoq: vi.fn(),
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
  useCostingBoq: (...a) => hooks.useCostingBoq(...a),
  useCreateCostingBoqItem: () => mutation,
  useUpdateCostingBoqItem: () => mutation,
  useDeleteCostingBoqItem: () => mutation,
  useImportCostingBoq: () => mutation,
  useCostingContractSettings: () => ({
    data: {
      tender_percent: null,
      authority_escalation_percent: null,
      gst_percent: null,
    },
  }),
  useUpdateCostingContractSettings: () => mutation,
  useConcreteProduction: (...a) =>
    hooks.useConcreteProduction(...a),
  useCreateConcreteProduction: () => mutation,
  useDeleteConcreteProduction: () => mutation,
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: "ADMIN" } }),
}));

const GLANCE = {
  selected: {
    period: "today",
    label: "Today",
    start: "2026-09-19",
    end: "2026-09-19",
    days: 1,
    single_day: true,
    value: "0.00",
    total_expense: "0.00",
    margin: "0.00",
    expense_ratio: null,
    flagged: false,
    concrete_cum: "0.000",
    concrete_source: "NONE",
    labour: { kind: "on_site", value: "0.00" },
    missing_feeds: { dpr: 0, hr: 0, machinery: 0 },
  },
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
    hooks.useCostingBoq.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: [], summary: null },
    });
    hooks.useConcreteProduction.mockReturnValue({ data: [] });
  });

  it("shows Today at a glance by default", () => {
    renderPage();

    expect(
      screen.getByRole("tab", { name: "Today", selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByText("Labour on site")).toBeInTheDocument();
    expect(hooks.useCostingGlance).toHaveBeenLastCalledWith(
      "site-1",
      expect.objectContaining({ period: "today" }),
      true,
    );
  });

  it("asks for the chosen period when the filter changes", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Yesterday" }));

    expect(hooks.useCostingGlance).toHaveBeenLastCalledWith(
      "site-1",
      expect.objectContaining({ period: "yesterday" }),
      true,
    );
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

  it("switches to concrete production", () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("tab", { name: /concrete production/i }),
    );

    expect(
      screen.getByText("Concrete production (stores)"),
    ).toBeInTheDocument();
  });

  it("switches to the BOQ and Costing workspace", () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("tab", { name: /boq & costing/i }),
    );

    expect(
      screen.getByRole("button", { name: /add boq item/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no boq items yet/i),
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
