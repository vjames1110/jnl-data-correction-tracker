import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectMonitorReportSheet } from "./ProjectMonitorReportSheet";

const SITE = { site_code: "CHK", site_name: "Chunar" };
const NONE = {
  details: false,
  structures: false,
  buildings: false,
  girders: false,
  actionItems: false,
  linearWorks: false,
  financial: false,
  costing: false,
  hr: false,
  machinery: false,
};

const COSTING = {
  data: {
    rates: {
      CONCRETE: { rate: "5000.00", effective_from: "2026-08-26" },
      TMT: { rate: "60000.00", effective_from: "2026-08-26" },
    },
    summary: { total: 1, linked: 1, unlinked: 0, missing_rate: 0 },
    items: [
      {
        id: "i1",
        item_no: "2.1",
        description: "RCC wall",
        unit: "cum",
        authority_rate: "10000.00",
        tender_percent: "-10",
        bid_rate: "9000.00",
        contract_rate: "9000.00",
        executed_qty: "10.000",
        executed_value: "90000.00",
        material_cost_per_unit: "5000.00",
        material_cost_to_date: "50000.00",
        margin_per_unit: "4000.00",
        margin_to_date: "40000.00",
        linked: true,
      },
    ],
  },
  isLoading: false,
  isError: false,
};

function renderSheet(props) {
  render(
    <ProjectMonitorReportSheet
      site={SITE}
      structures={[]}
      buildings={[]}
      {...props}
    />,
  );
}

describe("ProjectMonitorReportSheet - Item costing", () => {
  it("prints the authority rate, bid rate and actual cost of each item", () => {
    renderSheet({ sections: { ...NONE, costing: true }, costing: COSTING });

    expect(
      screen.getByText(
        "Item costing: authority rate, bid rate & actual cost",
      ),
    ).toBeInTheDocument();
    const row = screen.getByText(/RCC wall/).closest("tr");
    expect(within(row).getByText("₹10,000.00")).toBeInTheDocument();
    expect(within(row).getByText("-10.00%")).toBeInTheDocument();
    expect(within(row).getAllByText("₹9,000.00")).toHaveLength(2);
    expect(within(row).getByText("₹90,000")).toBeInTheDocument();
    expect(within(row).getByText("₹50,000")).toBeInTheDocument();
    expect(within(row).getByText("₹40,000")).toBeInTheDocument();
  });

  it("is left out when its section is off", () => {
    renderSheet({ sections: NONE, costing: COSTING });

    expect(screen.queryByText(/item costing/i)).toBeNull();
  });

  it("says so while loading and when it cannot be loaded", () => {
    renderSheet({
      sections: { ...NONE, costing: true },
      costing: { data: null, isLoading: true, isError: false },
    });

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("says when the project has no DPR items yet", () => {
    renderSheet({
      sections: { ...NONE, costing: true },
      costing: {
        data: { rates: {}, summary: {}, items: [] },
        isLoading: false,
        isError: false,
      },
    });

    expect(
      screen.getByText("No DPR items for this project yet."),
    ).toBeInTheDocument();
  });

  it("shows a dash for an item with no material use set", () => {
    renderSheet({
      sections: { ...NONE, costing: true },
      costing: {
        data: {
          rates: {},
          summary: {},
          items: [
            {
              ...COSTING.data.items[0],
              linked: false,
              material_cost_per_unit: "0.00",
              material_cost_to_date: "0.00",
              margin_per_unit: "9000.00",
              margin_to_date: "90000.00",
            },
          ],
        },
        isLoading: false,
        isError: false,
      },
    });

    const row = screen.getByText(/RCC wall/).closest("tr");
    const cells = within(row).getAllByRole("cell");
    // Material cost/unit, Material cost to date, Margin/unit, Margin
    // to date.
    expect(cells[8]).toHaveTextContent("-");
    expect(cells[9]).toHaveTextContent("-");
    expect(cells[10]).toHaveTextContent("-");
    expect(cells[11]).toHaveTextContent("-");
  });
});
