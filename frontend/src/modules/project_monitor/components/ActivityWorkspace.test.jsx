import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActivityWorkspace } from "./ActivityWorkspace";
import { GROUPS, STRUCTURE, handlers } from "./workspaceFixtures";

function renderWorkspace(props = {}) {
  render(
    <ActivityWorkspace
      item={STRUCTURE}
      onReviewAll={vi.fn()}
      reviewAllStatus={{ isPending: false }}
      {...handlers()}
      {...props}
    />,
  );
}

describe("ActivityWorkspace", () => {
  it("offers to review all of the sheet", () => {
    renderWorkspace();

    expect(
      screen.getByRole("region", { name: "Br. No. 214 tasks" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /review all tasks/i }),
    ).toBeInTheDocument();
  });

  it("does not repeat the description or progress the row above already shows", () => {
    renderWorkspace();

    expect(screen.queryByText(/1 cell box/)).toBeNull();
    expect(screen.queryByText(/activities complete/)).toBeNull();
  });

  it("offers the sheet's sections as buttons, each with its progress", () => {
    renderWorkspace();

    expect(
      screen.getAllByRole("tab").map((tab) => tab.textContent),
    ).toEqual(["Approvals1/2", "Box Structure1/2", "Wing walls0/1"]);
  });

  it("shows the chosen section as a horizontal status matrix", () => {
    renderWorkspace();

    // Opens on the first section.
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(
      screen.getByRole("columnheader", { name: "GAD Approval" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Box Structure/ }));

    expect(
      screen
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(
      expect.arrayContaining(["Excavation", "Bottom slab", "Apron"]),
    );
    expect(
      screen.getByRole("rowheader"),
    ).toHaveTextContent("Box Structure");
  });

  it("opens a task from its cell", () => {
    const onSelectActivity = vi.fn();
    renderWorkspace({ onSelectActivity });

    fireEvent.click(
      screen.getByRole("button", { name: /^GAD Approval:/ }),
    );

    expect(onSelectActivity).toHaveBeenCalledWith("a1");
  });

  it("shows another structure's tasks when it is switched", () => {
    const { rerender } = render(
      <ActivityWorkspace item={STRUCTURE} {...handlers()} />,
    );
    expect(screen.getByText("GAD Approval")).toBeInTheDocument();

    rerender(
      <ActivityWorkspace
        item={{
          ...STRUCTURE,
          id: "s2",
          name: "Br. No. 300",
          groups: [GROUPS[2]],
        }}
        {...handlers()}
      />,
    );

    expect(screen.queryByText("GAD Approval")).toBeNull();
    expect(screen.getByText("Return wall 1")).toBeInTheDocument();
    expect(screen.getByRole("rowheader")).toHaveTextContent(
      "Wing walls",
    );
  });

  it("starts again on the first section for another structure", () => {
    const { rerender } = render(
      <ActivityWorkspace item={STRUCTURE} {...handlers()} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Wing walls/ }));
    expect(screen.getByText("Return wall 1")).toBeInTheDocument();

    rerender(
      <ActivityWorkspace
        item={{ ...STRUCTURE, id: "s2", name: "Br. No. 300" }}
        {...handlers()}
      />,
    );

    expect(screen.getByText("GAD Approval")).toBeInTheDocument();
  });
});
