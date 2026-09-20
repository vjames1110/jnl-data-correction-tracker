import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HrDayTable } from "./HrDayTable";

const SUMMARY = {
  month: "2026-09",
  days: [
    {
      date: "2026-09-01",
      labour_nos: "0.00",
      labour_cost: "0.00",
      staff_cost: "0.00",
      total: "0.00",
    },
    {
      date: "2026-09-02",
      labour_nos: "15.00",
      labour_cost: "10500.00",
      staff_cost: "1000.00",
      total: "11500.00",
    },
  ],
  totals: {
    labour_man_days: "15.00",
    labour_cost: "10500.00",
    staff_cost: "1000.00",
    total: "11500.00",
  },
  labour_by_category: [
    {
      category: "Mason",
      man_days: "10.00",
      cost: "8000.00",
      entries: 1,
    },
  ],
};

describe("HrDayTable", () => {
  it("shows the month's totals in tiles and a footer", () => {
    render(<HrDayTable summary={SUMMARY} />);

    expect(
      screen.getByText("HR cost this month"),
    ).toBeInTheDocument();
    const footer = screen
      .getByText("Month to date")
      .closest("tr");
    expect(
      within(footer).getByText("₹11,500"),
    ).toBeInTheDocument();
  });

  it("lists the latest day first", () => {
    render(<HrDayTable summary={SUMMARY} />);

    const rows = screen
      .getAllByRole("row")
      .filter((row) => row.textContent.match(/^\d\d-09-/));
    expect(rows[0]).toHaveTextContent("02-09-2026");
    expect(rows[1]).toHaveTextContent("01-09-2026");
  });

  it("breaks labour down by category", () => {
    render(<HrDayTable summary={SUMMARY} />);

    expect(
      screen.getByText("Labour by category"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mason")).toBeInTheDocument();
  });

  it("says so when the month has not started", () => {
    render(
      <HrDayTable
        summary={{
          ...SUMMARY,
          days: [],
          labour_by_category: [],
        }}
      />,
    );

    expect(
      screen.getByText("This month has not started yet."),
    ).toBeInTheDocument();
  });
});
