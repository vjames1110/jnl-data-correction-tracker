import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActivityWorkspace } from "./ActivityWorkspace";
import { STRUCTURE, handlers } from "./workspaceFixtures";

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

  it("does not repeat the chainage, description or progress the row above already shows", () => {
    renderWorkspace();

    expect(screen.queryByText(/12\.345/)).toBeNull();
    expect(screen.queryByText(/1 cell box/)).toBeNull();
    expect(screen.queryByText(/activities complete/)).toBeNull();
  });

  it("shows the sheet groups as segments", () => {
    renderWorkspace();

    expect(
      screen.getAllByRole("tab").map((tab) => tab.textContent),
    ).toEqual(["Approvals1/2", "Box Structure1/2", "Wing walls0/1"]);
  });

  it("starts again on the first group for another structure", () => {
    const { rerender } = render(
      <ActivityWorkspace
        item={STRUCTURE}
        {...handlers()}
      />,
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
