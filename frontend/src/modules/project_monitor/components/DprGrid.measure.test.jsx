import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DprGrid } from "./DprGrid";

const hooks = vi.hoisted(() => ({
  sheet: vi.fn(),
}));

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useDprMeasurements: () => hooks.sheet(),
  useSaveDprMeasurements: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

function item(id, overrides = {}) {
  return {
    id,
    item_no: id,
    description: `Item ${id}`,
    unit: "cum",
    scope_qty: "100.000",
    rate: "100.00",
    amount: "10000.00",
    percent_of_contract: 1,
    is_major: false,
    concrete_per_unit: "0.000",
    tmt_kg_per_unit: "0.000",
    is_active: true,
    is_heading: false,
    level: 1,
    parent_id: null,
    executed_qty: "0.000",
    executed_value: "0.00",
    billed_qty: "0.000",
    balance_qty: "100.000",
    days: {},
    measured: {},
    ...overrides,
  };
}

const GRID = {
  edit_window_days: 3,
  dates: [
    {
      date: "2026-09-19",
      editable: true,
      unlocked_by_admin: false,
      value: "0",
    },
    {
      date: "2026-09-18",
      editable: true,
      unlocked_by_admin: false,
      value: "0",
    },
    {
      date: "2026-09-10",
      editable: false,
      unlocked_by_admin: false,
      value: "0",
    },
  ],
  items: [
    item("A"),
    item("B", {
      days: { "2026-09-10": "12.000" },
      measured: { "2026-09-10": "12.000" },
    }),
    item("G", { is_heading: true, has_children: true }),
  ],
};

const SAVED_SHEET = [
  {
    item: "A",
    date: "2026-09-19",
    total: "12.500",
    lines: [
      {
        description: "Wall",
        nos: null,
        length: "12.500",
        breadth: null,
        depth: null,
        is_deduction: false,
      },
    ],
  },
];

function renderGrid(props = {}) {
  const onSave = vi.fn().mockResolvedValue({
    saved: 1,
    skipped_locked: [],
    below_detailed: [],
  });
  render(
    <DprGrid
      grid={GRID}
      siteId="site-1"
      canEnter
      isSaving={false}
      onSave={onSave}
      onEditItem={vi.fn()}
      onDeleteItem={vi.fn()}
      {...props}
    />,
  );
  return { onSave };
}

beforeEach(() => {
  hooks.sheet.mockReturnValue({ data: [], isLoading: false });
});

describe("DprGrid measurement sheet", () => {
  it("opens under the item's row when a quantity is typed", async () => {
    const user = userEvent.setup();
    renderGrid();

    expect(
      screen.queryByText(/Measurement - A Item A/),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Item A on 19-09-2026"),
      "15",
    );

    const sheet = screen.getByText(/Measurement - A Item A/);
    const itemRow = screen
      .getByLabelText("Item A on 19-09-2026")
      .closest("tr");
    expect(itemRow.nextElementSibling).toContainElement(sheet);
    // ... and says nothing has been measured against the 15 yet.
    expect(
      screen.getByText("Nothing measured yet"),
    ).toBeInTheDocument();
  });

  it("checks the measurement against the quantity as it is typed", async () => {
    const user = userEvent.setup();
    hooks.sheet.mockReturnValue({
      data: SAVED_SHEET,
      isLoading: false,
    });
    renderGrid();

    await user.type(
      screen.getByLabelText("Item A on 19-09-2026"),
      "15",
    );

    expect(
      screen.getByText("Measured 12.5 of 15 entered"),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Item A on 19-09-2026"));
    await user.type(
      screen.getByLabelText("Item A on 19-09-2026"),
      "12.5",
    );
    expect(
      screen.getByText("Matches the 12.5 entered"),
    ).toBeInTheDocument();
  });

  it("fills the cell with the measured total without saving the DPR", async () => {
    const user = userEvent.setup();
    hooks.sheet.mockReturnValue({
      data: SAVED_SHEET,
      isLoading: false,
    });
    const { onSave } = renderGrid();

    await user.type(
      screen.getByLabelText("Item A on 19-09-2026"),
      "15",
    );
    await user.click(
      screen.getByRole("button", { name: "Use measured total" }),
    );

    expect(screen.getByLabelText("Item A on 19-09-2026")).toHaveValue(
      12.5,
    );
    expect(onSave).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: /save dpr/i }),
    );
    expect(onSave).toHaveBeenCalledWith([
      { item: "A", date: "2026-09-19", qty: 12.5 },
    ]);
  });

  it("keeps a single sheet open, moving it to the newest cell", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.type(
      screen.getByLabelText("Item A on 19-09-2026"),
      "5",
    );
    await user.type(
      screen.getByLabelText("Item A on 18-09-2026"),
      "6",
    );

    expect(screen.getAllByText(/Measurement - A Item A/)).toHaveLength(1);
    expect(screen.getByText(/18-09-2026/, { selector: ".sub" })).toBeInTheDocument();
  });

  it("closes from its own button", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.type(
      screen.getByLabelText("Item A on 19-09-2026"),
      "5",
    );
    await user.click(
      screen.getByRole("button", { name: "Close measurement" }),
    );

    expect(
      screen.queryByText(/Measurement - A Item A/),
    ).not.toBeInTheDocument();
  });

  it("opens from the ruler button without typing", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.click(
      screen.getByRole("button", {
        name: "Measurement for Item A on 19-09-2026",
      }),
    );

    expect(
      screen.getByText(/Measurement - A Item A/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Measurement for Item A on 19-09-2026",
      }),
    );
    expect(
      screen.queryByText(/Measurement - A Item A/),
    ).not.toBeInTheDocument();
  });

  it("marks a day whose measurement matches or differs from the quantity", () => {
    renderGrid();

    const matched = screen.getByRole("button", {
      name: "Measurement for Item B on 10-09-2026",
    });
    expect(matched).toHaveClass("pm-dpr-grid__ruler--match");
    expect(matched).toHaveAttribute("title", "Measured 12");
  });

  it("flags a measurement that differs from the quantity", () => {
    renderGrid({
      grid: {
        ...GRID,
        items: [
          item("B", {
            days: { "2026-09-10": "20.000" },
            measured: { "2026-09-10": "12.000" },
          }),
        ],
      },
    });

    expect(
      screen.getByRole("button", {
        name: "Measurement for Item B on 10-09-2026",
      }),
    ).toHaveClass("pm-dpr-grid__ruler--gap");
  });

  it("opens a locked day's measurement read-only", async () => {
    const user = userEvent.setup();
    hooks.sheet.mockReturnValue({
      data: SAVED_SHEET,
      isLoading: false,
    });
    renderGrid();

    await user.click(
      screen.getByRole("button", {
        name: "Measurement for Item B on 10-09-2026",
      }),
    );

    const sheet = screen
      .getByText(/Measurement - B Item B/)
      .closest(".pm-measure");
    expect(within(sheet).getByText(/read-only/i)).toBeInTheDocument();
    expect(
      within(sheet).queryByRole("button", {
        name: "Save measurement",
      }),
    ).not.toBeInTheDocument();
  });

  it("gives group rows no ruler and no sheet", () => {
    renderGrid();

    expect(
      screen.queryByRole("button", {
        name: /Measurement for Item G/,
      }),
    ).not.toBeInTheDocument();
  });

  it("does not offer measurements to someone who cannot enter, until one exists", () => {
    renderGrid({ canEnter: false });

    expect(
      screen.queryByRole("button", {
        name: "Measurement for Item A on 19-09-2026",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Measurement for Item B on 10-09-2026",
      }),
    ).toBeInTheDocument();
  });
});
