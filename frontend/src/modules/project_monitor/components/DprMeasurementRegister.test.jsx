import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DprMeasurementRegister } from "./DprMeasurementRegister";

const hooks = vi.hoisted(() => ({
  sheets: vi.fn(),
}));

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useDprMeasurements: () => hooks.sheets(),
}));

const ITEMS = [
  { id: "i1", item_no: "4.1", description: "Retaining wall", unit: "cum" },
];
const ENTRIES = [
  { item: "i1", date: "2026-09-19", qty: "10.000" },
  { item: "i1", date: "2026-09-19", qty: "2.500" },
];
const SHEETS = [
  {
    item: "i1",
    date: "2026-09-19",
    total: "12.500",
    lines: [
      {
        id: "l1",
        description: "Wall A",
        nos: "2.000",
        length: "5.000",
        breadth: null,
        depth: null,
        is_deduction: false,
        quantity: "10.000",
      },
      {
        id: "l2",
        description: "Opening",
        nos: "1.000",
        length: "1.000",
        breadth: "2.000",
        depth: null,
        is_deduction: false,
        quantity: "2.500",
      },
    ],
  },
];

function renderRegister() {
  render(
    <DprMeasurementRegister
      params={{ site: "s" }}
      items={ITEMS}
      entries={ENTRIES}
    />,
  );
}

beforeEach(() => {
  hooks.sheets.mockReturnValue({ data: SHEETS });
});

describe("DprMeasurementRegister", () => {
  it("lists each sheet against the quantity entered that day", () => {
    renderRegister();

    expect(
      screen.getByText("4.1 - Retaining wall"),
    ).toBeInTheDocument();
    expect(screen.getByText("12.5 cum")).toBeInTheDocument();
    // 10 + 2.5 entered across the day's two entries.
    expect(
      screen.getByText("Matches the 12.5 entered"),
    ).toBeInTheDocument();
  });

  it("shows the lines only when a sheet is opened", async () => {
    const user = userEvent.setup();
    renderRegister();

    expect(screen.queryByText("Wall A")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Retaining wall/ }),
    );
    expect(screen.getByText("Wall A")).toBeInTheDocument();
    expect(screen.getByText("Measured total")).toBeInTheDocument();
  });

  it("expands and collapses every sheet", async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.click(
      screen.getByRole("button", { name: "Expand all" }),
    );
    expect(screen.getByText("Wall A")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Collapse all" }),
    );
    expect(screen.queryByText("Wall A")).not.toBeInTheDocument();
  });

  it("opens every sheet before printing", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderRegister();

    await user.click(
      screen.getByRole("button", { name: /print measurements/i }),
    );

    expect(print).toHaveBeenCalled();
    expect(screen.getByText("Wall A")).toBeInTheDocument();
  });

  it("renders nothing when there are no measurements", () => {
    hooks.sheets.mockReturnValue({ data: [] });
    const { container } = render(
      <DprMeasurementRegister
        params={{ site: "s" }}
        items={ITEMS}
        entries={[]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
