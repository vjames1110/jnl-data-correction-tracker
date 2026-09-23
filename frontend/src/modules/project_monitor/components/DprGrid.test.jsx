import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DprGrid } from "./DprGrid";

const ITEM = {
  id: "item-1",
  item_no: "1.1",
  description: "Earthwork in embankment",
  unit: "cum",
  scope_qty: "1000.000",
  rate: "100.00",
  amount: "100000.00",
  percent_of_contract: 10,
  is_major: true,
  concrete_per_unit: "0.000",
  tmt_kg_per_unit: "0.000",
  is_active: true,
  executed_qty: "40.000",
  executed_value: "4000.00",
  billed_qty: "0.000",
  balance_qty: "960.000",
  days: { "2026-09-19": "40.000" },
};

const GRID = {
  edit_window_days: 3,
  dates: [
    {
      date: "2026-09-19",
      editable: true,
      unlocked_by_admin: false,
      value: "4000.00",
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
    {
      date: "2026-09-09",
      editable: false,
      unlocked_by_admin: true,
      value: "0",
    },
  ],
  items: [ITEM],
};

function renderGrid(props = {}) {
  const onSave = vi.fn().mockResolvedValue({
    saved: 1,
    skipped_locked: [],
    below_detailed: [],
  });
  render(
    <DprGrid
      grid={GRID}
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

describe("DprGrid", () => {
  it("makes only the editable days inputs", () => {
    renderGrid();

    expect(
      screen.getAllByRole("spinbutton"),
    ).toHaveLength(2);
    expect(
      screen.getByLabelText(
        "Earthwork in embankment on 19-09-2026",
      ),
    ).toHaveValue(40);
    expect(
      screen.queryByLabelText(
        "Earthwork in embankment on 2026-09-10",
      ),
    ).not.toBeInTheDocument();
  });

  it("is read-only for someone without entry rights", () => {
    renderGrid({ canEnter: false });

    expect(
      screen.queryAllByRole("spinbutton"),
    ).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /save dpr/i }),
    ).not.toBeInTheDocument();
  });

  it("sends only the changed cells on save", async () => {
    const user = userEvent.setup();
    const { onSave } = renderGrid();
    const save = screen.getByRole("button", {
      name: /save dpr/i,
    });
    expect(save).toBeDisabled();

    const cell = screen.getByLabelText(
      "Earthwork in embankment on 18-09-2026",
    );
    await user.type(cell, "25");
    expect(save).toBeEnabled();
    await user.click(save);

    expect(onSave).toHaveBeenCalledWith([
      { item: "item-1", date: "2026-09-18", qty: 25 },
    ]);
    expect(
      await screen.findByText(/Saved 1 cell/),
    ).toBeInTheDocument();
  });

  it("drops an edit that puts the value back", async () => {
    const user = userEvent.setup();
    renderGrid();
    const cell = screen.getByLabelText(
      "Earthwork in embankment on 19-09-2026",
    );

    await user.clear(cell);
    await user.type(cell, "50");
    await user.clear(cell);
    await user.type(cell, "40");

    expect(
      screen.getByRole("button", { name: /save dpr/i }),
    ).toBeDisabled();
  });

  it("shows a friendly empty state with no items", () => {
    renderGrid({ grid: { ...GRID, items: [] } });

    expect(
      screen.getByText(/No contract items yet/),
    ).toBeInTheDocument();
  });
});
