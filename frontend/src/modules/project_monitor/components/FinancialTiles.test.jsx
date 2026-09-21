import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinancialTiles } from "./FinancialTiles";

const SUMMARY = {
  contract_no: "LOA/17",
  original_value: "10000000.00",
  varied_value: null,
  valued: "10000000.00",
  last_bill_no: "RA-3",
  last_bill_date: "2026-09-01",
  work_done_to_last_bill: "2500000.00",
  dpr_value_after_last_bill: "500000.00",
  work_done_total: "3000000.00",
  balance_value: "7000000.00",
  percent_done: "30.0",
  days_remaining: 70,
  per_day_required: "100000.00",
  executed_yesterday: "150000.00",
  seven_day_average: "90000.00",
  pace: "ON_PACE",
  shortfall: null,
  lump_sum_billed: "0.00",
  received_total: "1800000.00",
  outstanding_total: "700000.00",
};

describe("FinancialTiles", () => {
  it("shows billed, received and outstanding payments", () => {
    render(<FinancialTiles summary={SUMMARY} />);

    expect(
      screen.getByText("Payments received"),
    ).toBeInTheDocument();
    expect(screen.getByText("₹18.00 L")).toBeInTheDocument();
    expect(screen.getByText("₹7.00 L")).toBeInTheDocument();
    expect(
      screen.getByText("Billed but not yet received"),
    ).toBeInTheDocument();
  });

  it("mentions a lump sum inside the billed figure", () => {
    render(
      <FinancialTiles
        summary={{ ...SUMMARY, lump_sum_billed: "1000000.00" }}
      />,
    );

    expect(
      screen.getByText("Includes lump sum ₹10.00 L"),
    ).toBeInTheDocument();
  });

  it("shows the contract position in compact rupees", () => {
    render(<FinancialTiles summary={SUMMARY} />);

    expect(screen.getByText("₹1.00 Cr")).toBeInTheDocument();
    // Shown on both the contract-status and the payments tiles.
    expect(screen.getAllByText("₹25.00 L").length).toBeGreaterThan(0);
    expect(screen.getByText("₹70.00 L")).toBeInTheDocument();
    expect(screen.getByText("RA-3 · 01-09-2026")).toBeInTheDocument();
    expect(
      screen.getByText("30% of the contract done"),
    ).toBeInTheDocument();
    expect(screen.getByText("70 day(s) left")).toBeInTheDocument();
  });

  it("says on pace when yesterday meets the requirement", () => {
    render(<FinancialTiles summary={SUMMARY} />);

    expect(screen.getByText("On pace")).toBeInTheDocument();
  });

  it("shows the shortfall when yesterday fell short", () => {
    render(
      <FinancialTiles
        summary={{
          ...SUMMARY,
          executed_yesterday: "40000.00",
          pace: "SHORT_BY",
          shortfall: "60000.00",
        }}
      />,
    );

    expect(
      screen.getByText("Short by ₹60,000"),
    ).toBeInTheDocument();
  });

  it("has no pace figures when the contract period is over", () => {
    render(
      <FinancialTiles
        summary={{
          ...SUMMARY,
          days_remaining: -3,
          per_day_required: null,
          pace: null,
        }}
      />,
    );

    expect(
      screen.getByText("Contract period has ended"),
    ).toBeInTheDocument();
    expect(screen.getByText(/7-day average/)).toBeInTheDocument();
  });

  it("explains an undated project and a missing bill", () => {
    render(
      <FinancialTiles
        summary={{
          ...SUMMARY,
          days_remaining: null,
          per_day_required: null,
          pace: null,
          last_bill_no: "",
          last_bill_date: null,
        }}
      />,
    );

    expect(screen.getByText("End date not set")).toBeInTheDocument();
    expect(
      screen.getByText("No bill recorded yet"),
    ).toBeInTheDocument();
  });
});
