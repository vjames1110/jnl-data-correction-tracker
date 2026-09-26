import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActivityWorkspace } from "./ActivityWorkspace";
import { STRUCTURE, handlers } from "./workspaceFixtures";

function renderWorkspace(props = {}) {
  render(
    <ActivityWorkspace
      item={STRUCTURE}
      metaLine="Ch. 12.345 km · 2/6 activities complete"
      onReviewAll={vi.fn()}
      reviewAllStatus={{ isPending: false }}
      {...handlers()}
      {...props}
    />,
  );
}

describe("ActivityWorkspace", () => {
  it("summarises the sheet and offers to review all of it", () => {
    renderWorkspace();

    expect(
      screen.getByRole("region", { name: "Br. No. 214 tasks" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ch. 12.345 km · 2/6 activities complete"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 cell box, 12 m barrel"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /review all tasks/i }),
    ).toBeInTheDocument();
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
        metaLine=""
        {...handlers()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Wing walls/ }));
    expect(screen.getByText("Return wall 1")).toBeInTheDocument();

    rerender(
      <ActivityWorkspace
        item={{ ...STRUCTURE, id: "s2", name: "Br. No. 300" }}
        metaLine=""
        {...handlers()}
      />,
    );

    expect(screen.getByText("GAD Approval")).toBeInTheDocument();
  });
});
