import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReportCustomizationPanel } from "./ReportCustomizationPanel";

const ALL_ON = {
  details: true,
  structures: true,
  buildings: true,
  girders: true,
  actionItems: true,
  linearWorks: true,
  financial: true,
  hr: true,
  machinery: true,
};

function renderPanel(props = {}) {
  const handlers = {
    onToggle: vi.fn(),
    onSelectAll: vi.fn(),
    onClearAll: vi.fn(),
  };
  render(
    <ReportCustomizationPanel
      sections={ALL_ON}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("ReportCustomizationPanel", () => {
  it("offers every section as a small named chip, HR and Machinery included", () => {
    renderPanel();

    [
      "Project details",
      "Structures",
      "Buildings",
      "Girders & bearings",
      "Action items",
      "Linear works",
      "DPR & bills",
      "HR",
      "Machinery",
    ].forEach((name) => {
      expect(
        screen.getByRole("button", { name }),
      ).toBeInTheDocument();
    });
  });

  it("carries no descriptive text beyond the names", () => {
    renderPanel();

    expect(
      screen.queryByText(/bridges, rub, rob/i),
    ).toBeNull();
    expect(
      screen.queryByText(/choose which sections/i),
    ).toBeNull();
  });

  it("counts how many sections are included", () => {
    renderPanel({ sections: { ...ALL_ON, hr: false, machinery: false } });

    expect(screen.getByText("7 of 9 included")).toBeInTheDocument();
  });

  it("shows the state of each chip and toggles on click", () => {
    const { onToggle } = renderPanel({
      sections: { ...ALL_ON, hr: false },
    });

    expect(
      screen.getByRole("button", { name: "HR" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Structures" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "HR" }));
    expect(onToggle).toHaveBeenCalledWith("hr");
  });

  it("leaves out sections the person may not see", () => {
    renderPanel({ hiddenKeys: ["financial", "hr", "machinery"] });

    expect(
      screen.queryByRole("button", { name: "HR" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Machinery" }),
    ).toBeNull();
    expect(screen.getByText("6 of 6 included")).toBeInTheDocument();
  });

  it("shows a count badge where one is given", () => {
    renderPanel({ counts: { structures: 4 } });

    expect(
      screen.getByRole("button", { name: /structures/i }),
    ).toHaveTextContent("4");
  });

  it("selects and clears everything", () => {
    const { onSelectAll, onClearAll } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
