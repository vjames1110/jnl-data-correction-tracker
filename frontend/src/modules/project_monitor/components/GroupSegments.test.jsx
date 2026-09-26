import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GroupSegments } from "./GroupSegments";
import { GROUPS, handlers, row } from "./workspaceFixtures";

function renderSegments(props = {}) {
  render(
    <GroupSegments groups={GROUPS} {...handlers()} {...props} />,
  );
}

describe("GroupSegments", () => {
  it("has one segment per group, each with how much is done", () => {
    renderSegments();

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Approvals1/2",
      // The N/A row does not count.
      "Box Structure1/2",
      "Wing walls0/1",
    ]);
  });

  it("opens on the first group and shows only its activities", () => {
    renderSegments();

    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(
      "Approvals",
    );
    expect(screen.getByText("GAD Approval")).toBeInTheDocument();
    expect(screen.getByText("Structural drawing approval")).toBeInTheDocument();
    expect(screen.queryByText("Excavation")).toBeNull();
  });

  it("switches to another group", () => {
    renderSegments();

    fireEvent.click(screen.getByRole("tab", { name: /Box Structure/ }));

    expect(screen.getByText("Excavation")).toBeInTheDocument();
    expect(screen.getByText("Bottom slab")).toBeInTheDocument();
    expect(screen.queryByText("GAD Approval")).toBeNull();
    expect(screen.getByText("Barrel and slabs")).toBeInTheDocument();
  });

  it("closes an open row when the group changes", () => {
    const onSelectActivity = vi.fn();
    renderSegments({ onSelectActivity });

    fireEvent.click(screen.getByRole("tab", { name: /Wing walls/ }));

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("opens a row into the existing detail panel with its Action History", () => {
    renderSegments({ activeActivityId: "a1" });

    expect(
      screen.getByRole("button", { name: /action history/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Update this meeting")).toBeInTheDocument();
  });

  it("skips the switch for a sheet with a single group", () => {
    renderSegments({ groups: [GROUPS[1]] });

    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("Excavation")).toBeInTheDocument();
  });

  it("says so when a sheet has no tasks", () => {
    renderSegments({ groups: [] });

    expect(screen.getByText("No tasks on this sheet.")).toBeInTheDocument();
  });

  it("clicking a row asks the page to expand it", () => {
    const onSelectActivity = vi.fn();
    renderSegments({ onSelectActivity });

    fireEvent.click(
      within(screen.getByRole("table")).getByText("GAD Approval"),
    );

    expect(onSelectActivity).toHaveBeenCalledWith("a1");
  });

  it("copes with a group whose rows are all not applicable", () => {
    renderSegments({
      groups: [
        GROUPS[0],
        {
          group_order: 5,
          group_title: "Optional",
          group_subtitle: "",
          rows: [row("x1", "Nothing here", "NOT_APPLICABLE")],
        },
      ],
    });

    expect(
      screen.getByRole("tab", { name: /Optional/ }),
    ).toHaveTextContent("Optional0/0");
  });
});
