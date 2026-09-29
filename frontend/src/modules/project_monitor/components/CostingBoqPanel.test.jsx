import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CostingBoqPanel } from "./CostingBoqPanel";

const hooks = vi.hoisted(() => ({
  boq: vi.fn(),
  contractSettings: vi.fn(),
}));

const mutations = vi.hoisted(() => ({
  create: { mutate: vi.fn(), isPending: false, isError: false },
  update: { mutate: vi.fn(), isPending: false, isError: false },
  del: { mutate: vi.fn(), isPending: false, isError: false },
  importBoq: { mutateAsync: vi.fn() },
  updateSettings: {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isError: false,
  },
}));

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useCostingBoq: (...args) => hooks.boq(...args),
  useCreateCostingBoqItem: () => mutations.create,
  useUpdateCostingBoqItem: () => mutations.update,
  useDeleteCostingBoqItem: () => mutations.del,
  useImportCostingBoq: () => mutations.importBoq,
  useCostingContractSettings: (...args) =>
    hooks.contractSettings(...args),
  useUpdateCostingContractSettings: () => mutations.updateSettings,
}));

vi.mock("../../../services/projectMonitorService", () => ({
  projectMonitorService: {
    downloadCostingBoqTemplate: vi.fn(),
  },
}));

const WALL = {
  id: "wall",
  parent_id: null,
  level: 1,
  has_children: true,
  item_no: "1",
  description: "RCC retaining wall",
  unit: "cum",
  qty: "100.000",
  authority_rate: "10000.00",
  escalated_authority_rate: "10000.00",
  tender_percent: "-10.000",
  bid_rate: "9000.00",
  bid_amount: "900000.00",
  our_cost_rate: "3024.00",
  cost_amount: "302400.00",
  gst_percent: "18.00",
  gst_amount: "162000.00",
  bid_amount_incl_gst: "1062000.00",
  profit_per_unit: "5976.00",
  profit_amount: "597600.00",
  is_active: true,
};

const CEMENT = {
  id: "cement",
  parent_id: "wall",
  level: 2,
  has_children: false,
  item_no: "1.1",
  description: "Supply of cement",
  unit: "bag",
  qty: "640.000",
  authority_rate: null,
  escalated_authority_rate: null,
  tender_percent: null,
  bid_rate: "380.00",
  bid_amount: "243200.00",
  our_cost_rate: "360.00",
  cost_amount: "230400.00",
  gst_percent: null,
  gst_amount: "0.00",
  bid_amount_incl_gst: "243200.00",
  profit_per_unit: "20.00",
  profit_amount: "12800.00",
  is_active: true,
};

const SUMMARY = {
  bid_amount: "900000.00",
  cost_amount: "302400.00",
  gst_amount: "162000.00",
  bid_amount_incl_gst: "1062000.00",
  profit_amount: "597600.00",
};

function renderPanel(props = {}) {
  render(
    <CostingBoqPanel siteId="site-1" canEnter {...props} />,
  );
}

function rowFor(description) {
  return screen.getByText(
    new RegExp(description),
  ).closest("tr");
}

describe("CostingBoqPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.boq.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: [WALL, CEMENT], summary: SUMMARY },
    });
    hooks.contractSettings.mockReturnValue({
      data: {
        tender_percent: "-10.000",
        authority_escalation_percent: null,
        gst_percent: "18.00",
      },
    });
  });

  it("renders the tree with each row's rollup figures", () => {
    renderPanel();

    const wallRow = rowFor("RCC retaining wall");
    expect(within(wallRow).getByText(/10,000\.00/)).toBeInTheDocument();
    expect(within(wallRow).getByText(/9,000\.00/)).toBeInTheDocument();
    expect(within(wallRow).getByText(/₹3,02,400/)).toBeInTheDocument();
    expect(within(wallRow).getByText(/₹5,97,600/)).toBeInTheDocument();

    const cementRow = rowFor("Supply of cement");
    expect(within(cementRow).getByText("bag")).toBeInTheDocument();
    expect(within(cementRow).getByText(/₹2,30,400/)).toBeInTheDocument();
  });

  it("shows the contract-wide totals", () => {
    renderPanel();

    const totalsRow = screen.getByText("Contract total").closest("tr");
    expect(within(totalsRow).getByText(/₹9,00,000/)).toBeInTheDocument();
    expect(within(totalsRow).getByText(/₹5,97,600/)).toBeInTheDocument();
  });

  it("collapses and expands a parent row's materials", () => {
    renderPanel();

    expect(screen.getByText(/Supply of cement/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse RCC retaining wall" }),
    );
    expect(screen.queryByText(/Supply of cement/)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Expand RCC retaining wall" }),
    );
    expect(screen.getByText(/Supply of cement/)).toBeInTheDocument();
  });

  it("adds a new top-level BOQ item", () => {
    renderPanel();

    fireEvent.click(
      screen.getByRole("button", { name: "Add BOQ item" }),
    );
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Excavation" },
    });
    fireEvent.change(screen.getByLabelText("Qty"), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mutations.create.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Excavation",
        qty: 50,
        parent_id: undefined,
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("adds a material under a row via its own + button", () => {
    renderPanel();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add a material under RCC retaining wall",
      }),
    );
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Supply of sand" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mutations.create.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Supply of sand",
        parent_id: "wall",
      }),
      expect.anything(),
    );
  });

  it("opens the edit form pre-filled and submits changes", () => {
    renderPanel();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit RCC retaining wall" }),
    );

    expect(screen.getByLabelText("Qty")).toHaveValue(100);

    fireEvent.change(screen.getByLabelText("Qty"), {
      target: { value: "120" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mutations.update.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: "wall", qty: 120 }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("deletes a leaf row after confirming", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Supply of cement" }),
    );

    expect(mutations.del.mutate).toHaveBeenCalledWith("cement");
    window.confirm.mockRestore();
  });

  it("warns instead of deleting a row that still has children", () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(true);

    renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete RCC retaining wall" }),
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("delete those first"),
    );
    confirmSpy.mockRestore();
  });

  it("hides every entry control for someone who cannot enter", () => {
    renderPanel({ canEnter: false });

    expect(
      screen.queryByRole("button", { name: "Add BOQ item" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /edit/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).toBeNull();
  });

  it("says so when the project has no BOQ items yet", () => {
    hooks.boq.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: [], summary: null },
    });

    renderPanel();

    expect(
      screen.getByText(/No BOQ items yet/),
    ).toBeInTheDocument();
  });

  it("shows a loading state", () => {
    hooks.boq.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    });

    renderPanel();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows the contract-wide tender %, escalation and GST", () => {
    renderPanel();

    expect(screen.getByText("-10.000")).toBeInTheDocument();
    expect(screen.getByText("18.00")).toBeInTheDocument();
  });

  it("edits the contract settings and reports how many items were re-priced", async () => {
    mutations.updateSettings.mutateAsync.mockResolvedValueOnce({
      recalculated: 3,
    });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(
      screen.getByLabelText(/Departmental escalation/),
      { target: { value: "5" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mutations.updateSettings.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        tender_percent: -10,
        authority_escalation_percent: 5,
        gst_percent: 18,
      }),
    );

    await screen.findByText(/3 item\(s\) re-priced/);
  });

  it("hides the settings Edit button for someone who cannot enter", () => {
    renderPanel({ canEnter: false });

    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).toBeNull();
  });
});
