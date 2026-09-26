import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { DprGrid } from "./DprGrid";

function row(overrides) {
  return {
    scope_qty: "0.000",
    rate: "0.00",
    amount: "0.00",
    percent_of_contract: 0,
    is_major: false,
    concrete_per_unit: "0.000",
    tmt_kg_per_unit: "0.000",
    is_active: true,
    executed_qty: "0.000",
    executed_value: "0.00",
    billed_qty: "0.000",
    balance_qty: "0.000",
    days: {},
    is_heading: false,
    level: 1,
    parent_id: null,
    authority_rate: null,
    tender_percent: null,
    applied_tender_percent: null,
    escalation_percent: "0",
    effective_rate: "0.00",
    ...overrides,
  };
}

const GROUP = row({
  id: "g",
  item_no: "4",
  description: "Earthwork",
  is_heading: true,
  has_children: true,
  amount: "3000.00",
  executed_value: "700.00",
});
const LEAF_A = row({
  id: "a",
  item_no: "4.1",
  description: "Embankment",
  unit: "cum",
  level: 2,
  parent_id: "g",
  scope_qty: "10.000",
  rate: "236.25",
  amount: "2362.50",
  authority_rate: "250.00",
  tender_percent: "-5.500",
  applied_tender_percent: "-5.500",
  escalation_percent: "10",
  effective_rate: "259.88",
  executed_value: "700.00",
  days: { "2026-09-19": "3.000" },
});
const LEAF_B = row({
  id: "b",
  item_no: "5",
  description: "Plain item",
  unit: "nos",
  scope_qty: "2.000",
  rate: "300.00",
  amount: "600.00",
});

const GRID = {
  edit_window_days: 3,
  dates: [
    {
      date: "2026-09-19",
      editable: true,
      unlocked_by_admin: false,
      value: "700.00",
    },
  ],
  items: [GROUP, LEAF_A, LEAF_B],
};

function renderGrid(props = {}) {
  const handlers = {
    onSave: vi.fn(),
    onEditItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onAddChild: vi.fn(),
  };
  render(
    <DprGrid
      grid={GRID}
      canEnter
      isSaving={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

// This Node version ships a non-functional native `localStorage`
// that shadows jsdom's, so an in-memory one is installed (see
// services/offlineReadCache.test.js).
beforeAll(() => {
  const store = new Map();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) =>
        store.has(key) ? store.get(key) : null,
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("DprGrid BOQ tree", () => {
  it("takes entries only against items, not groups", () => {
    renderGrid();

    expect(
      screen.getAllByRole("spinbutton"),
    ).toHaveLength(2);
    expect(
      screen.queryByLabelText(/Earthwork on/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Embankment on 19-09-2026"),
    ).toHaveValue(3);
  });

  it("rolls a group up and totals only the items", () => {
    renderGrid();

    const groupRow = screen.getByText("Earthwork").closest("tr");
    expect(
      within(groupRow).getByText("₹3,000"),
    ).toBeInTheDocument();
    // 2,362.50 + 600 - never the group's own 3,000 as well.
    const totalRow = screen.getByText("Total").closest("tr");
    expect(
      within(totalRow).getByText("₹2,963"),
    ).toBeInTheDocument();
  });

  it("collapses and expands a group", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.click(
      screen.getByRole("button", { name: "Collapse Earthwork" }),
    );

    expect(
      screen.queryByText("Embankment"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Plain item")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Expand Earthwork" }),
    );
    expect(screen.getByText("Embankment")).toBeInTheDocument();
  });

  it("collapses and expands every group at once", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.click(
      screen.getByRole("button", { name: "Collapse all" }),
    );
    expect(
      screen.queryByText("Embankment"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Expand all" }),
    );
    expect(screen.getByText("Embankment")).toBeInTheDocument();
  });

  it("keeps the BOQ columns behind the column chooser", async () => {
    const user = userEvent.setup();
    renderGrid();

    expect(
      screen.queryByRole("columnheader", {
        name: "Authority rate",
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText("Columns"));
    await user.click(screen.getByLabelText("Authority rate"));
    await user.click(screen.getByLabelText("Tender %"));
    await user.click(screen.getByLabelText("Escalation"));
    await user.click(screen.getByLabelText("Rate today"));

    expect(
      screen.getByRole("columnheader", { name: "Authority rate" }),
    ).toBeInTheDocument();
    const leaf = screen.getByText("Embankment").closest("tr");
    expect(within(leaf).getByText("₹250.00")).toBeInTheDocument();
    expect(within(leaf).getByText("-5.5% *")).toBeInTheDocument();
    expect(within(leaf).getByText("10%")).toBeInTheDocument();
    expect(within(leaf).getByText("₹259.88")).toBeInTheDocument();
    // A plain item shows dashes for the authority columns.
    const plain = screen.getByText("Plain item").closest("tr");
    expect(within(plain).getAllByText("-").length).toBeGreaterThan(1);
  });

  it("remembers the chosen columns", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <DprGrid
        grid={GRID}
        canEnter
        isSaving={false}
        onSave={vi.fn()}
        onEditItem={vi.fn()}
        onDeleteItem={vi.fn()}
      />,
    );
    await user.click(screen.getByText("Columns"));
    await user.click(screen.getByLabelText("Rate today"));
    unmount();

    renderGrid();

    expect(
      screen.getByRole("columnheader", { name: "Rate today" }),
    ).toBeInTheDocument();
  });

  it("offers Add item under a group only to people who can enter", async () => {
    const user = userEvent.setup();
    const { onAddChild } = renderGrid();

    await user.click(
      screen.getByRole("button", {
        name: "Add an item under Earthwork",
      }),
    );
    expect(onAddChild).toHaveBeenCalledWith(
      expect.objectContaining({ id: "g" }),
    );
  });

  it("is read-only for a viewer, group rows included", () => {
    renderGrid({ canEnter: false });

    expect(
      screen.queryAllByRole("spinbutton"),
    ).toHaveLength(0);
    expect(
      screen.queryByRole("button", {
        name: /add an item under/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("still renders older rows that have no group fields", () => {
    const legacy = { ...LEAF_B };
    delete legacy.is_heading;
    delete legacy.level;
    delete legacy.parent_id;
    renderGrid({ grid: { ...GRID, items: [legacy] } });

    expect(screen.getByText("Plain item")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Plain item on 19-09-2026"),
    ).toBeInTheDocument();
  });
});
