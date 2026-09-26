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
      contract_rate: "9000.00",
      concrete_per_unit: "1.000",
      tmt_kg_per_unit: "0.000",
      material_cost_per_unit: "5000.00",
      margin_per_unit: "4000.00",
      margin_percent: "44.44",
      linked: true,
      missing_rate: false,
    },
    {
      id: "i2",
      item_no: "3.4",
      description: "Reinforcement",
      unit: "MT",
      contract_rate: "80000.00",
      concrete_per_unit: "0.000",
      tmt_kg_per_unit: "1000.000",
      material_cost_per_unit: "0.00",
      margin_per_unit: "80000.00",
      margin_percent: "100.00",
      linked: true,
      missing_rate: true,
    },
    {
      id: "i3",
      item_no: "1.1",
      description: "Earthwork",
      unit: "cum",
      contract_rate: "100.00",
      concrete_per_unit: "0.000",
      tmt_kg_per_unit: "0.000",
      material_cost_per_unit: "0.00",
      margin_per_unit: "100.00",
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
