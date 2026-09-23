import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CostingTable } from "./CostingTable";

const hooks = vi.hoisted(() => ({ useCostingTable: vi.fn() }));

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useCostingTable: (...args) => hooks.useCostingTable(...args),
}));

const TABLE = {
  start: "2026-09-01",
  end: "2026-09-02",
  days: [
    {
      date: "2026-09-01",
      value: "10000.00",
      labour_staff_cost: "3000.00",
      machinery_cost: "1000.00",
      concrete_cost: "0.00",
      concrete_source: "NONE",
      tmt_cost: "0.00",
      total_expense: "4000.00",
      margin: "6000.00",
      expense_ratio: 0.4,
      flagged: false,
      complete: {
        dpr: true,
        hr: true,
        machinery: true,
        stores: false,
      },
    },
    {
      date: "2026-09-02",
      value: "5000.00",
      labour_staff_cost: "4000.00",
      machinery_cost: "1000.00",
      concrete_cost: "0.00",
      concrete_source: "NONE",
      tmt_cost: "0.00",
      total_expense: "5200.00",
      margin: "-200.00",
      expense_ratio: 1.04,
      flagged: true,
      complete: {
        dpr: true,
        hr: true,
        machinery: false,
        stores: false,
      },
    },
  ],
  totals: {
    value: "15000.00",
    labour_staff_cost: "7000.00",
    machinery_cost: "2000.00",
    concrete_cost: "0.00",
    tmt_cost: "0.00",
    total_expense: "9200.00",
    margin: "5800.00",
    expense_ratio: 0.6133,
  },
};

describe("CostingTable", () => {
  it("shows a row per day and a totals row", () => {
    hooks.useCostingTable.mockReturnValue({
      isLoading: false,
      isError: false,
      data: TABLE,
    });

    render(<CostingTable siteId="site-1" />);

    expect(screen.getAllByRole("row")).toHaveLength(4); // header + 2 days + totals
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("flags the day that passed the expense threshold", () => {
    hooks.useCostingTable.mockReturnValue({
      isLoading: false,
      isError: false,
      data: TABLE,
    });

    render(<CostingTable siteId="site-1" />);

    const flaggedRow = screen
      .getByText("02-09-2026")
      .closest("tr");
    expect(flaggedRow.className).toContain(
      "pm-costing-row--flagged",
    );
  });

  it("says when there is nothing in the range", () => {
    hooks.useCostingTable.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { start: "2026-09-01", end: "2026-09-01", days: [], totals: {} },
    });

    render(<CostingTable siteId="site-1" />);

    expect(
      screen.getByText("Nothing recorded in this range."),
    ).toBeInTheDocument();
  });
});
