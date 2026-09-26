import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FinancialReportSheet } from "./FinancialReportView";

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useFinancialReport: vi.fn(),
}));

const SUMMARY = {
  valued: "1000000",
  work_done_to_last_bill: "0",
  dpr_value_after_last_bill: "0",
  balance_value: "1000000",
  percent_done: 0,
  unbilled_value: "0",
};

function line(id, item_no, group, value) {
  return {
    id,
    group,
    item_no,
    description: `Item ${item_no}`,
    unit: "cum",
    rate: "236.25",
    scope_qty: "10",
    executed_qty: "5",
    executed_value: String(value),
    percent_of_item: 50,
    today_qty: "1",
    today_value: "10",
    billed_qty: "0",
    unbilled_value: "20",
  };
}

function renderReport(rows) {
  render(
    <FinancialReportSheet
      report={{
        as_on: "2026-09-25",
        summary: SUMMARY,
        rows,
        totals: {
          executed_value: "0",
          today_value: "0",
          unbilled_value: "0",
        },
      }}
    />,
  );
}

describe("FinancialReportSheet grouping", () => {
  it("heads each BOQ group and subtotals the top-level one", () => {
    renderReport([
      line("a", "4.1.1", ["4 Earthwork", "4.1 Embankment"], 100),
      line("b", "4.1.2", ["4 Earthwork", "4.1 Embankment"], 200),
      line("c", "4.2", ["4 Earthwork"], 300),
      line("d", "5", [], 400),
    ]);

    expect(screen.getByText("4 Earthwork")).toBeInTheDocument();
    // Shown once even though two items sit in it.
    expect(screen.getAllByText("4.1 Embankment")).toHaveLength(1);
    const subtotal = screen
      .getByText("Subtotal - 4 Earthwork")
      .closest("tr");
    expect(within(subtotal).getByText("₹600")).toBeInTheDocument();
    // An ungrouped item follows without a subtotal of its own.
    expect(screen.queryByText(/Subtotal - 5/)).toBeNull();
  });

  it("leaves a flat item list exactly as it was", () => {
    renderReport([line("a", "1.1", [], 100)]);

    expect(screen.getByText("Item 1.1")).toBeInTheDocument();
    expect(screen.queryByText(/Subtotal/)).toBeNull();
  });

  it("shows rates to the paisa", () => {
    renderReport([line("a", "1.1", [], 100)]);

    expect(screen.getByText("₹236.25")).toBeInTheDocument();
  });

  it("copes with rows from an older server that carry no group", () => {
    const legacy = line("a", "1.1", [], 100);
    delete legacy.group;
    renderReport([legacy]);

    expect(screen.getByText("Item 1.1")).toBeInTheDocument();
  });
});
