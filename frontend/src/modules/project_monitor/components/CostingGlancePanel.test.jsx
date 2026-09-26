import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CostingGlancePanel } from "./CostingGlancePanel";

function selected(overrides = {}) {
  return {
    period: "today",
    label: "Today",
    start: "2026-09-19",
    end: "2026-09-19",
    days: 1,
    single_day: true,
    value: "10000.00",
    total_expense: "9500.00",
    margin: "500.00",
    expense_ratio: 0.95,
    flagged: true,
    concrete_cum: "5.000",
    concrete_source: "ESTIMATED",
    tmt_mt: "0.000",
    labour: { kind: "on_site", value: "42.00" },
    missing_feeds: { dpr: 0, hr: 0, machinery: 0 },
    ...overrides,
  };
}

function renderPanel(overrides = {}, props = {}) {
  const handlers = {
    onPeriodChange: vi.fn(),
    onDateChange: vi.fn(),
  };
  render(
    <CostingGlancePanel
      glance={{ selected: selected(overrides) }}
      period="today"
      pickedDate="2026-09-12"
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("CostingGlancePanel", () => {
  it("has a filter for every period, opening on the chosen one", () => {
    renderPanel();

    expect(
      screen.getAllByRole("tab").map((tab) => tab.textContent),
    ).toEqual([
      "Today",
      "Yesterday",
      "Last 7 days",
      "Month to date",
      "Last month",
      "Whole project",
      "Pick a date",
    ]);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(
      "Today",
    );
  });

  it("asks for another period when one is picked", () => {
    const { onPeriodChange } = renderPanel();

    fireEvent.click(screen.getByRole("tab", { name: "Yesterday" }));

    expect(onPeriodChange).toHaveBeenCalledWith("yesterday");
  });

  it("shows the selected period's cards under its heading and date", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("19-09-2026")).toBeInTheDocument();
    [
      "Value of work done",
      "Total expense",
      "Margin before overheads",
      "Labour on site",
      "Concrete",
    ].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument(),
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Estimated from DPR")).toBeInTheDocument();
  });

  it("shows only the chosen period, not every block at once", () => {
    renderPanel({
      label: "Last 7 days",
      period: "last_7_days",
      single_day: false,
      start: "2026-09-13",
      end: "2026-09-19",
      days: 7,
    });

    expect(
      screen.getByRole("heading", { name: "Last 7 days" }),
    ).toBeInTheDocument();
    expect(screen.getByText("13-09-2026 to 19-09-2026")).toBeInTheDocument();
    expect(screen.queryByText("Yesterday", { selector: "h3" })).toBeNull();
    expect(screen.queryByText("Month to date", { selector: "h3" })).toBeNull();
  });

  it("counts man-days for a range and people on site for a day", () => {
    renderPanel({
      single_day: false,
      labour: { kind: "man_days", value: "310.00" },
    });

    expect(screen.getByText("Labour man-days")).toBeInTheDocument();
    expect(screen.getByText("310")).toBeInTheDocument();
  });

  it("warns when the period's expense has passed 90% of the value", () => {
    renderPanel();
    expect(
      screen.getByText(/this day's expense has passed 90%/i),
    ).toBeInTheDocument();
  });

  it("words the warning for a range", () => {
    renderPanel({ single_day: false, days: 7 });

    expect(
      screen.getByText(/expense over this period has passed 90%/i),
    ).toBeInTheDocument();
  });

  it("does not warn when it is not flagged", () => {
    renderPanel({ flagged: false });

    expect(screen.queryByText(/has passed 90%/i)).toBeNull();
  });

  it("names the feeds with nothing recorded", () => {
    renderPanel({
      single_day: false,
      days: 7,
      missing_feeds: { dpr: 4, hr: 6, machinery: 0 },
    });

    expect(
      screen.getByText(/DPR 4, HR 6/),
    ).toBeInTheDocument();
    expect(screen.getByText(/of 7/)).toBeInTheDocument();
  });

  it("offers a date box only for Pick a date", () => {
    const { onDateChange } = renderPanel(
      { label: "12-09-2026", period: "date" },
      { period: "date" },
    );

    const input = screen.getByLabelText("Date");
    expect(input).toHaveValue("2026-09-12");
    fireEvent.change(input, { target: { value: "2026-09-10" } });
    expect(onDateChange).toHaveBeenCalledWith("2026-09-10");
  });

  it("has no date box for the other periods", () => {
    renderPanel();

    expect(screen.queryByLabelText("Date")).toBeNull();
  });

  it("says nothing to show for a project with no DPR entry yet", () => {
    renderPanel({
      period: "whole_project",
      label: "Whole project",
      start: null,
      end: "2026-09-19",
      days: 0,
    });

    expect(
      screen.getByText(/nothing to show yet/i),
    ).toBeInTheDocument();
  });

  it("renders nothing without data", () => {
    const { container } = render(
      <CostingGlancePanel glance={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
