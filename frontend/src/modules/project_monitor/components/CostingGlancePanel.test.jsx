import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CostingGlancePanel } from "./CostingGlancePanel";

function row(overrides = {}) {
  return {
    value: "10000.00",
    total_expense: "9500.00",
    margin: "500.00",
    expense_ratio: 0.95,
    flagged: true,
    concrete_cum: "5.000",
    concrete_source: "ESTIMATED",
    ...overrides,
  };
}

const GLANCE = {
  as_on: "2026-09-19",
  today: row(),
  yesterday: row({
    value: "8000.00",
    total_expense: "4000.00",
    margin: "4000.00",
    expense_ratio: 0.5,
    flagged: false,
  }),
  month_to_date: row({
    value: "150000.00",
    total_expense: "90000.00",
    margin: "60000.00",
    expense_ratio: 0.6,
    flagged: false,
  }),
  cumulative: row({
    value: "900000.00",
    total_expense: "500000.00",
    margin: "400000.00",
    expense_ratio: 0.55,
    flagged: false,
  }),
  labour_on_site_today: "42.00",
};

describe("CostingGlancePanel", () => {
  it("warns when today has passed the 90% expense flag", () => {
    render(<CostingGlancePanel glance={GLANCE} />);

    expect(
      screen.getByText(
        /today's expense has passed 90% of the value of work done/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows today, yesterday, month-to-date and cumulative side by side", () => {
    render(<CostingGlancePanel glance={GLANCE} />);

    ["Today", "Yesterday", "Month to date", "Cumulative (whole project)"].forEach(
      (title) => expect(screen.getByText(title)).toBeInTheDocument(),
    );
  });

  it("shows labour on site today", () => {
    render(<CostingGlancePanel glance={GLANCE} />);

    expect(screen.getByText("Labour on site today")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("says nothing before any DPR entry has been made", () => {
    render(
      <CostingGlancePanel
        glance={{ ...GLANCE, cumulative: null }}
      />,
    );

    expect(
      screen.getByText(
        /cumulative figures appear once a dpr entry/i,
      ),
    ).toBeInTheDocument();
  });

  it("does not warn when today is not flagged", () => {
    render(
      <CostingGlancePanel
        glance={{
          ...GLANCE,
          today: { ...GLANCE.today, flagged: false },
        }}
      />,
    );

    expect(
      screen.queryByText(/has passed 90%/i),
    ).toBeNull();
  });

  it("renders nothing without data", () => {
    const { container } = render(
      <CostingGlancePanel glance={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
