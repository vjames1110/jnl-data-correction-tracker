import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ItemLinksPanel } from "./ItemLinksPanel";

const hooks = vi.hoisted(() => ({
  links: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useItemLinks: (...args) => hooks.links(...args),
  useSaveItemLink: () => hooks.save(),
}));

const DATA = {
  rates: {
    CONCRETE: { rate: "5000.00", effective_from: "2026-08-26" },
    TMT: { rate: null, effective_from: null },
  },
  summary: { total: 3, linked: 2, unlinked: 1, missing_rate: 1 },
  items: [
    {
      id: "i1",
      item_no: "2.1",
      description: "RCC wall",
      unit: "cum",
      authority_rate: "10000.00",
      tender_percent: "-10",
      bid_rate: "9000.00",
      contract_rate: "9000.00",
      executed_qty: "10.000",
      executed_value: "90000.00",
      concrete_per_unit: "1.000",
      tmt_kg_per_unit: "0.000",
      material_cost_per_unit: "5000.00",
      material_cost_to_date: "50000.00",
      margin_per_unit: "4000.00",
      margin_to_date: "40000.00",
      margin_percent: "44.44",
      linked: true,
      missing_rate: false,
    },
    {
      id: "i2",
      item_no: "3.4",
      description: "Reinforcement",
      unit: "MT",
      authority_rate: null,
      tender_percent: null,
      bid_rate: "80000.00",
      contract_rate: "80000.00",
      executed_qty: "0.000",
      executed_value: "0.00",
      concrete_per_unit: "0.000",
      tmt_kg_per_unit: "1000.000",
      material_cost_per_unit: "0.00",
      material_cost_to_date: "0.00",
      margin_per_unit: "80000.00",
      margin_to_date: "0.00",
      margin_percent: "100.00",
      linked: true,
      missing_rate: true,
    },
    {
      id: "i3",
      item_no: "1.1",
      description: "Earthwork",
      unit: "cum",
      authority_rate: null,
      tender_percent: null,
      bid_rate: "100.00",
      contract_rate: "100.00",
      executed_qty: "0.000",
      executed_value: "0.00",
      concrete_per_unit: "0.000",
      tmt_kg_per_unit: "0.000",
      material_cost_per_unit: "0.00",
      material_cost_to_date: "0.00",
      margin_per_unit: "100.00",
      margin_to_date: "0.00",
      margin_percent: "100.00",
      linked: false,
      missing_rate: false,
    },
  ],
};

function renderPanel(props = {}) {
  render(<ItemLinksPanel siteId="s1" canEnter {...props} />);
}

describe("ItemLinksPanel", () => {
  beforeEach(() => {
    hooks.links.mockReturnValue({ data: DATA });
    hooks.save.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
      isError: false,
    });
  });

  it("shows the rates in force, or that one is missing", () => {
    renderPanel();

    expect(
      screen.getByText(/Concrete: .*5,000.* \/ cum \(from 26-08-2026\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("TMT: no rate set")).toBeInTheDocument();
  });

  it("summarises how many items are linked", () => {
    renderPanel();

    expect(
      screen.getByText(
        /3 items · 2 linked · 1 with no material use · 1 need a rate above/,
      ),
    ).toBeInTheDocument();
  });

  it("marks each item as linked, needing a rate, or using no material", () => {
    renderPanel();

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Linked")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Needs a rate")).toBeInTheDocument();
    expect(within(rows[3]).getByText("No material use")).toBeInTheDocument();
  });

  it("shows margin against the contract rate for a linked item", () => {
    renderPanel();

    const wall = screen.getAllByRole("row")[1];
    expect(within(wall).getByText(/4,000.*\(44\.4%\)/)).toBeInTheDocument();
  });

  it("shows the authority rate, tender % and bid rate an item was won at", () => {
    renderPanel();

    const wallCells = within(screen.getAllByRole("row")[1]).getAllByRole(
      "cell",
    );
    // Item, Unit, Authority rate, Tender %, Bid rate, Rate today.
    expect(wallCells[2]).toHaveTextContent("10,000.00");
    expect(wallCells[3]).toHaveTextContent("-10%");
    expect(wallCells[4]).toHaveTextContent("9,000.00");
    expect(wallCells[5]).toHaveTextContent("9,000.00");
  });

  it("shows a hand-typed item with no authority rate as a dash", () => {
    renderPanel();

    const cells = within(screen.getAllByRole("row")[3]).getAllByRole(
      "cell",
    );
    // Item, Unit, Authority rate, Tender %.
    expect(cells[2]).toHaveTextContent("-");
    expect(cells[3]).toHaveTextContent("-");
  });

  it("shows what has actually been executed and its value", () => {
    renderPanel();

    const wallCells = within(screen.getAllByRole("row")[1]).getAllByRole(
      "cell",
    );
    // Executed qty, Executed value.
    expect(wallCells[6]).toHaveTextContent("10");
    expect(wallCells[7]).toHaveTextContent("90,000");
  });

  it("carries the material cost and margin through to the executed total", () => {
    renderPanel();

    const wallCells = within(screen.getAllByRole("row")[1]).getAllByRole(
      "cell",
    );
    // Material cost per unit, Material cost to date, Margin per
    // unit, Margin to date.
    expect(wallCells[10]).toHaveTextContent("5,000.00");
    expect(wallCells[11]).toHaveTextContent("50,000");
    expect(wallCells[12]).toHaveTextContent("4,000.00");
    expect(wallCells[13]).toHaveTextContent("40,000");
  });

  it("lets an Admin change what an item consumes", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    hooks.save.mockReturnValue({ mutateAsync, isPending: false, isError: false });
    renderPanel();

    fireEvent.click(
      screen.getByRole("button", { name: /edit material use of RCC wall/i }),
    );
    fireEvent.change(
      screen.getByLabelText(/concrete per cum for rcc wall/i),
      { target: { value: "1.25" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        itemId: "i1",
        concrete_per_unit: 1.25,
        tmt_kg_per_unit: 0,
      }),
    );
  });

  it("is read-only for someone who cannot enter", () => {
    renderPanel({ canEnter: false });

    expect(screen.queryByRole("button", { name: /edit material use/i })).toBeNull();
  });

  it("explains an empty project", () => {
    hooks.links.mockReturnValue({
      data: { rates: {}, summary: { total: 0, linked: 0, unlinked: 0, missing_rate: 0 }, items: [] },
    });
    renderPanel();

    expect(screen.getByText(/No DPR items for this project yet/)).toBeInTheDocument();
  });
});
