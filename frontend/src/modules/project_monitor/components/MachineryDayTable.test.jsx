import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MachineryDayTable } from "./MachineryDayTable";

const SUMMARY = {
  month: "2026-09",
  days: [
    {
      date: "2026-09-01",
      market_hire: "0.00",
      ho_hire: "0.00",
      fuel: "0.00",
      maintenance: "0.00",
      other: "0.00",
      total: "0.00",
    },
    {
      date: "2026-09-02",
      market_hire: "9000.00",
      ho_hire: "4000.00",
      fuel: "5000.00",
      maintenance: "300.00",
      other: "100.00",
      total: "18400.00",
    },
  ],
  totals: {
    market_hire: "9000.00",
    ho_hire: "4000.00",
    fuel: "5000.00",
    maintenance: "300.00",
    other: "100.00",
    total: "18400.00",
  },
  by_machine: [
    {
      machine: "m1",
      name: "JCB 3DX",
      reg_no: "UP70 1",
      source: "MARKET",
      qty: "1.00",
      hire: "9000.00",
      fuel: "4000.00",
      maintenance: "300.00",
      other: "0.00",
      total: "13300.00",
    },
  ],
  site_fuel: "1000.00",
};

describe("MachineryDayTable", () => {
  it("shows market and in-house hire as separate columns", () => {
    render(<MachineryDayTable summary={SUMMARY} />);

    expect(
      screen.getByText("Market hire"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("In-house hire"),
    ).toBeInTheDocument();
    const footer = screen
      .getByText("Month to date")
      .closest("tr");
    expect(
      within(footer).getByText("₹9,000"),
    ).toBeInTheDocument();
    expect(
      within(footer).getByText("₹4,000"),
    ).toBeInTheDocument();
    expect(
      within(footer).getByText("₹18,400"),
    ).toBeInTheDocument();
  });

  it("lists the latest day first", () => {
    render(<MachineryDayTable summary={SUMMARY} />);

    const rows = screen
      .getAllByRole("row")
      .filter((row) => row.textContent.match(/^\d\d-09-/));
    expect(rows[0]).toHaveTextContent("02-09-2026");
    expect(rows[1]).toHaveTextContent("01-09-2026");
  });

  it("breaks the cost down by machine and shows site fuel", () => {
    render(<MachineryDayTable summary={SUMMARY} />);

    expect(screen.getByText("By machine")).toBeInTheDocument();
    expect(
      screen.getByText("JCB 3DX (UP70 1)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Site fuel (no machine)"),
    ).toBeInTheDocument();
  });

  it("says so when the month has not started", () => {
    render(
      <MachineryDayTable
        summary={{
          ...SUMMARY,
          days: [],
          by_machine: [],
          site_fuel: "0.00",
        }}
      />,
    );

    expect(
      screen.getByText("This month has not started yet."),
    ).toBeInTheDocument();
    expect(screen.queryByText("By machine")).toBeNull();
  });
});
