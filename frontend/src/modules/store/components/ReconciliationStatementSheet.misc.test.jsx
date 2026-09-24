import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildStatementCsvRows } from "./statementCsv";
import { ReconciliationStatementSheet } from "./ReconciliationStatementSheet";

const PERIOD = {
  site_code: "BKN",
  site_name: "Bikaner Site",
  period_month: "2026-04-01",
  status_display: "Draft",
};

function entry(overrides = {}) {
  return {
    id: "e1",
    item_name: "OPC Cement",
    uom: "MT",
    reconciliation_type: "NORM_BASED",
    opening_stock: "100.000",
    receipts: "50.000",
    closing_stock: "40.000",
    miscellaneous_quantity: "0.000",
    actual_quantity: "110.000",
    theoretical_or_book_quantity: "100.000",
    variance_quantity: "-10.000",
    variance_value: "-65000.00",
    resolved_rate: "6500.00",
    mix_ratio_by_grade: {},
    ...overrides,
  };
}

function renderSheet(entries) {
  return render(
    <ReconciliationStatementSheet
      period={PERIOD}
      entries={entries}
      outputEntries={[]}
    />,
  );
}

describe("Statement sheet - miscellaneous use", () => {
  it("shows a Less: Miscellaneous Use row that explains the net consumption", () => {
    renderSheet([
      entry({
        miscellaneous_quantity: "10.000",
        actual_quantity: "100.000",
      }),
    ]);

    const misc = screen
      .getByText(/Less: Miscellaneous Use/)
      .closest("tr");
    expect(within(misc).getByText("10.00")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Net Consumption for Production (Actual)",
      ),
    ).toBeInTheDocument();
  });

  it("prints exactly as before when nothing was used outside production", () => {
    renderSheet([entry()]);

    expect(
      screen.queryByText(/Less: Miscellaneous Use/),
    ).toBeNull();
    expect(
      screen.getByText("Net Consumption (Actual)"),
    ).toBeInTheDocument();
  });

  it("dashes the row for a material with no misc use while another has some", () => {
    renderSheet([
      entry({
        id: "e1",
        miscellaneous_quantity: "10.000",
      }),
      entry({
        id: "e2",
        item_name: "River Sand",
        miscellaneous_quantity: "0.000",
      }),
    ]);

    const misc = screen
      .getByText(/Less: Miscellaneous Use/)
      .closest("tr");
    expect(within(misc).getByText("-")).toBeInTheDocument();
  });
});

describe("Statement CSV - miscellaneous use", () => {
  it("has a Misc. Use column that is blank unless something was used", () => {
    const rows = buildStatementCsvRows({
      period: PERIOD,
      entries: [
        entry({
          id: "e1",
          miscellaneous_quantity: "10.000",
          actual_quantity: "100.000",
        }),
        entry({
          id: "e2",
          item_name: "River Sand",
          miscellaneous_quantity: "0.000",
        }),
      ],
      outputEntries: [],
    });

    const header = rows.find((row) => row[0] === "Item" && row.includes("Misc. Use"));
    const miscIndex = header.indexOf("Misc. Use");
    const cement = rows.find((row) => row[0] === "OPC Cement" && row.length === header.length);
    const sand = rows.find((row) => row[0] === "River Sand" && row.length === header.length);

    expect(header.slice(miscIndex - 1, miscIndex + 2)).toEqual([
      "Closing",
      "Misc. Use",
      "Actual",
    ]);
    expect(cement[miscIndex]).toBe("10.000");
    expect(sand[miscIndex]).toBe("");
  });
});
