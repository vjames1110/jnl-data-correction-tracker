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
  hr: false,
  machinery: false,
};

const HR = {
  summary: {
    month: "2026-09",
    days: [
      { date: "2026-09-01", labour_nos: "0.00", labour_cost: "0.00", staff_cost: "0.00", total: "0.00" },
      { date: "2026-09-02", labour_nos: "15.00", labour_cost: "10500.00", staff_cost: "1000.00", total: "11500.00" },
    ],
    totals: { labour_man_days: "15.00", labour_cost: "10500.00", staff_cost: "1000.00", total: "11500.00" },
    labour_by_category: [
      { category: "Mason", man_days: "10.00", cost: "8000.00", entries: 1 },
    ],
  },
  isLoading: false,
  isError: false,
};

const MACHINERY = {
  summary: {
    month: "2026-09",
    days: [
      { date: "2026-09-01", market_hire: "0.00", ho_hire: "0.00", fuel: "0.00", maintenance: "0.00", other: "0.00", total: "0.00" },
      { date: "2026-09-02", market_hire: "9000.00", ho_hire: "4000.00", fuel: "5000.00", maintenance: "300.00", other: "100.00", total: "18400.00" },
    ],
    totals: { market_hire: "9000.00", ho_hire: "4000.00", fuel: "5000.00", maintenance: "300.00", other: "100.00", total: "18400.00" },
    by_machine: [
      { machine: "m1", name: "JCB 3DX", reg_no: "", source: "MARKET", qty: "1.00", hire: "9000.00", fuel: "4000.00", maintenance: "300.00", other: "0.00", total: "13300.00" },
    ],
    site_fuel: "1000.00",
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
      reportMonth="2026-09"
      {...props}
    />,
  );
}

describe("ProjectMonitorReportSheet - HR and Machinery", () => {
  it("prints an HR section for the month with only the days that cost something", () => {
    renderSheet({ sections: { ...NONE, hr: true }, hr: HR });

    expect(
      screen.getByText("Human resource - September 2026"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("₹11,500").length).toBeGreaterThan(0);
    // 02-09 has cost; the empty 01-09 is left out.
    expect(screen.getByText("02-09-2026")).toBeInTheDocument();
    expect(screen.queryByText("01-09-2026")).toBeNull();
    expect(screen.getByText("Mason")).toBeInTheDocument();
  });

  it("prints a Machinery section with market and in-house hire, machines and site fuel", () => {
    renderSheet({
      sections: { ...NONE, machinery: true },
      machinery: MACHINERY,
    });

    expect(
      screen.getByText("Machinery - September 2026"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Market hire").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In-house hire").length).toBeGreaterThan(0);
    expect(screen.getByText("JCB 3DX")).toBeInTheDocument();
    expect(
      screen.getByText("Site fuel (no machine)"),
    ).toBeInTheDocument();
    const dayRow = screen.getByText("02-09-2026").closest("tr");
    expect(within(dayRow).getByText("₹18,400")).toBeInTheDocument();
  });

  it("leaves both out when their sections are off", () => {
    renderSheet({
      sections: NONE,
      hr: HR,
      machinery: MACHINERY,
    });

    expect(screen.queryByText(/human resource/i)).toBeNull();
    expect(screen.queryByText(/^machinery/i)).toBeNull();
  });

  it("says so while loading and when a section cannot be loaded", () => {
    renderSheet({
      sections: { ...NONE, hr: true, machinery: true },
      hr: { summary: null, isLoading: true, isError: false },
      machinery: { summary: null, isLoading: false, isError: true },
    });

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(
      screen.getByText("This section could not be loaded."),
    ).toBeInTheDocument();
  });

  it("says when the month has no cost recorded", () => {
    renderSheet({
      sections: { ...NONE, hr: true },
      hr: {
        ...HR,
        summary: {
          ...HR.summary,
          days: [HR.summary.days[0]],
          labour_by_category: [],
        },
      },
    });

    expect(
      screen.getByText("No labour or staff cost recorded this month."),
    ).toBeInTheDocument();
  });
});
