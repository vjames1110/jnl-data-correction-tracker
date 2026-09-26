import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActivityMatrix } from "./ActivityMatrix";
import { GROUPS, handlers, row } from "./workspaceFixtures";

function renderMatrix(props = {}) {
  return render(
    <ActivityMatrix
      groups={[GROUPS[1]]}
      {...handlers()}
      {...props}
    />,
  );
}

// The matrix cell of a task (its name starts the accessible name).
const cellOf = (name) =>
  screen.getByRole("button", {
    name: new RegExp(`^${name}:`),
  });

describe("ActivityMatrix layout", () => {
  it("lays a group out as a horizontal strip, one column per task", () => {
    renderMatrix();

    const table = screen.getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    expect(headers).toEqual(
      expect.arrayContaining(["Excavation", "Bottom slab", "Apron"]),
    );
    // One row of cells: the header row and a single task row.
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(
      within(table).getByRole("rowheader"),
    ).toHaveTextContent("Box Structure");
    expect(
      within(table).getByRole("rowheader"),
    ).toHaveTextContent("Barrel and slabs");
  });

  it("gives every task a cell that shows its status", () => {
    renderMatrix();

    expect(cellOf("Excavation")).toHaveTextContent("Complete");
    expect(cellOf("Bottom slab")).toHaveTextContent("In Progress");
    expect(cellOf("Apron")).toHaveTextContent("N/A");
  });

  it("colours each cell by its status", () => {
    renderMatrix({
      groups: [
        {
          ...GROUPS[1],
          rows: [
            row("n", "Not started", "NOT_STARTED"),
            row("i", "In progress", "IN_PROGRESS"),
            row("c", "Complete", "COMPLETE"),
            row("h", "On hold", "HOLD"),
            row("a", "Not applicable", "NOT_APPLICABLE"),
          ],
        },
      ],
    });

    expect(cellOf("Not started")).toHaveClass("pm-cell--not-started");
    expect(cellOf("In progress")).toHaveClass("pm-cell--in-progress");
    expect(cellOf("Complete")).toHaveClass("pm-cell--complete");
    expect(cellOf("On hold")).toHaveClass("pm-cell--hold");
    expect(cellOf("Not applicable")).toHaveClass(
      "pm-cell--not-applicable",
    );
  });

  it("shows how far an in-progress task is, with a bar", () => {
    renderMatrix({
      groups: [
        {
          ...GROUPS[1],
          rows: [
            row("i", "Slab", "IN_PROGRESS", { done_qty: "40" }),
          ],
        },
      ],
    });

    const cell = cellOf("Slab");
    expect(cell).toHaveTextContent("40%");
    expect(cell.querySelector(".pm-cell__bar span")).toHaveStyle({
      width: "40%",
    });
  });

  it("shows the due date of a task not yet taken up", () => {
    renderMatrix({
      groups: [
        {
          ...GROUPS[1],
          rows: [
            row("n", "Raft", "NOT_STARTED", {
              current_target_date: "2026-11-15",
            }),
          ],
        },
      ],
    });

    expect(cellOf("Raft")).toHaveTextContent("Due 15-11-2026");
  });

  it("says in the cell's name when a task is blocked or reviewed", () => {
    renderMatrix({
      groups: [
        {
          ...GROUPS[1],
          rows: [
            row("h", "Raft", "IN_PROGRESS", {
              is_hindrance: true,
              reviewed_at: "2026-09-26T10:00:00Z",
            }),
          ],
        },
      ],
    });

    expect(cellOf("Raft")).toHaveAccessibleName(
      /blocked by a hindrance, reviewed/,
    );
  });

  it("shows the colour key once", () => {
    renderMatrix();

    const key = screen.getByRole("list", { name: "Colour key" });
    expect(
      within(key)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Not Taken Up",
      "In Progress",
      "Complete",
      "Hold / Issue",
      "N/A",
    ]);
  });

  it("says so when a sheet has no tasks", () => {
    renderMatrix({ groups: [] });

    expect(
      screen.getByText("No tasks on this sheet."),
    ).toBeInTheDocument();
  });

  it("puts a span-wise group in one row per span", () => {
    renderMatrix({
      groups: [
        {
          group_order: 3,
          group_title: "Superstructure (span-wise)",
          group_subtitle: "2 span(s)",
          rows: [
            row("s1a", "S1 – Bearings"),
            row("s1b", "S1 – Girder fabrication"),
            row("s2a", "S2 – Bearings"),
            row("s2b", "S2 – Girder fabrication"),
          ],
        },
      ],
    });

    const table = screen.getByRole("table", {
      name: "Superstructure (span-wise)",
    });
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((header) => header.textContent),
    ).toEqual(["S1", "S2"]);
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(
      expect.arrayContaining(["Bearings", "Girder fabrication"]),
    );
  });

});

describe("ActivityMatrix sections", () => {
  it("has a button per section, each with how much of it is done", () => {
    renderMatrix({ groups: GROUPS });

    expect(
      screen.getAllByRole("tab").map((tab) => tab.textContent),
    ).toEqual(["Approvals1/2", "Box Structure1/2", "Wing walls0/1"]);
  });

  it("opens on the first section and shows only its matrix", () => {
    renderMatrix({ groups: GROUPS });

    expect(
      screen.getByRole("tab", { selected: true }),
    ).toHaveTextContent("Approvals");
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(cellOf("GAD Approval")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Excavation:/ }),
    ).toBeNull();
  });

  it("switches to another section", () => {
    renderMatrix({ groups: GROUPS });

    fireEvent.click(screen.getByRole("tab", { name: /Box Structure/ }));

    expect(cellOf("Excavation")).toBeInTheDocument();
    expect(cellOf("Bottom slab")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^GAD Approval:/ }),
    ).toBeNull();
  });

  it("closes an open task when the section changes", () => {
    const onSelectActivity = vi.fn();
    renderMatrix({ groups: GROUPS, onSelectActivity });

    fireEvent.click(screen.getByRole("tab", { name: /Wing walls/ }));

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("has a section button for a span-wise group and a numbered series", () => {
    renderMatrix({
      groups: [
        GROUPS[0],
        {
          group_order: 3,
          group_title: "Pier P1",
          group_subtitle: "Height 8 m",
          rows: [row("p1a", "Pile"), row("p1b", "Stem")],
        },
        {
          group_order: 4,
          group_title: "Pier P2",
          group_subtitle: "Height 8 m",
          rows: [row("p2a", "Pile"), row("p2b", "Stem")],
        },
      ],
    });

    expect(
      screen.getAllByRole("tab").map((tab) => tab.textContent),
    ).toEqual(["Approvals1/2", "Piers0/4"]);

    fireEvent.click(screen.getByRole("tab", { name: /Piers/ }));

    expect(
      within(screen.getByRole("table", { name: "Piers" }))
        .getAllByRole("rowheader")
        .map((header) => header.textContent),
    ).toEqual(["Pier P1Height 8 m", "Pier P2Height 8 m"]);
  });

  it("skips the buttons for a sheet with a single section", () => {
    renderMatrix({ groups: [GROUPS[1]] });

    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("copes with a section whose tasks are all not applicable", () => {
    renderMatrix({
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

describe("ActivityMatrix popup", () => {
  it("opens nothing until a task is clicked", () => {
    renderMatrix();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks the page to open a task when its cell is clicked", () => {
    const onSelectActivity = vi.fn();
    renderMatrix({ onSelectActivity });

    fireEvent.click(cellOf("Bottom slab"));

    expect(onSelectActivity).toHaveBeenCalledWith("b2");
  });

  it("shows the active task's update form in a popup", () => {
    renderMatrix({ activeActivityId: "b2" });

    const dialog = screen.getByRole("dialog", {
      name: "Bottom slab - update",
    });
    expect(
      within(dialog).getByRole("heading", { name: "Bottom slab" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Meeting date")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Target date")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Status")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("% done")).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText("Remark for this meeting"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Save update" }),
    ).toBeInTheDocument();
    // The popup sits on the page, not inside the matrix.
    expect(dialog.closest("table")).toBeNull();
  });

  it("marks the open task's cell", () => {
    renderMatrix({ activeActivityId: "b2" });

    expect(cellOf("Bottom slab")).toHaveAttribute("aria-expanded", "true");
    expect(cellOf("Bottom slab")).toHaveClass("pm-cell--active");
    expect(cellOf("Excavation")).toHaveAttribute("aria-expanded", "false");
  });

  it("clicking the open task again closes it", () => {
    const onSelectActivity = vi.fn();
    renderMatrix({ activeActivityId: "b2", onSelectActivity });

    fireEvent.click(cellOf("Bottom slab"));

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("clicking a different task moves the popup to it", () => {
    const onSelectActivity = vi.fn();
    renderMatrix({ activeActivityId: "b2", onSelectActivity });

    fireEvent.mouseDown(cellOf("Excavation"));
    fireEvent.click(cellOf("Excavation"));

    // The press did not close it first, so the click moves it once.
    expect(onSelectActivity).toHaveBeenCalledTimes(1);
    expect(onSelectActivity).toHaveBeenCalledWith("b1");
  });

  it("closes from its close button", () => {
    const onSelectActivity = vi.fn();
    renderMatrix({ activeActivityId: "b2", onSelectActivity });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("closes on Escape", () => {
    const onSelectActivity = vi.fn();
    renderMatrix({ activeActivityId: "b2", onSelectActivity });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("closes on a click outside it", () => {
    const onSelectActivity = vi.fn();
    render(
      <div>
        <p>Somewhere else</p>
        <ActivityMatrix
          groups={[GROUPS[1]]}
          {...handlers({ activeActivityId: "b2", onSelectActivity })}
        />
      </div>,
    );

    fireEvent.mouseDown(screen.getByText("Somewhere else"));

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("stays open while working inside it", () => {
    const onSelectActivity = vi.fn();
    renderMatrix({ activeActivityId: "b2", onSelectActivity });

    fireEvent.mouseDown(screen.getByLabelText("Remark for this meeting"));

    expect(onSelectActivity).not.toHaveBeenCalled();
  });

  it("can be opened from the keyboard", async () => {
    const user = userEvent.setup();
    const onSelectActivity = vi.fn();
    renderMatrix({ onSelectActivity });

    await user.tab();
    await user.keyboard("{Enter}");

    expect(onSelectActivity).toHaveBeenCalledWith("b1");
  });

  it("sends the update for the open task", async () => {
    const user = userEvent.setup();
    const onSubmitUpdate = vi.fn();
    renderMatrix({ activeActivityId: "b2", onSubmitUpdate });

    await user.type(
      screen.getByLabelText("Remark for this meeting"),
      "Shuttering done",
    );
    await user.click(
      screen.getByRole("button", { name: "Save update" }),
    );

    expect(onSubmitUpdate).toHaveBeenCalledWith(
      "b2",
      expect.objectContaining({ comment: "Shuttering done" }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("closes once the server has accepted the save", async () => {
    const user = userEvent.setup();
    const onSelectActivity = vi.fn();
    const onSubmitUpdate = vi.fn((_id, _payload, options) =>
      options.onSuccess(),
    );
    renderMatrix({
      activeActivityId: "b2",
      onSelectActivity,
      onSubmitUpdate,
    });

    await user.click(
      screen.getByRole("button", { name: "Save update" }),
    );

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("stays open, showing the error, when the save is refused", async () => {
    const user = userEvent.setup();
    const onSelectActivity = vi.fn();
    renderMatrix({
      activeActivityId: "b2",
      onSelectActivity,
      onSubmitUpdate: vi.fn(),
      updateStatus: {
        isPending: false,
        isError: true,
        error: { message: "Could not save" },
      },
    });

    await user.click(
      screen.getByRole("button", { name: "Save update" }),
    );

    expect(onSelectActivity).not.toHaveBeenCalled();
    expect(screen.getByText("Could not save")).toBeInTheDocument();
  });

  it("puts the hindrance tick box on its own line and reveals its fields", async () => {
    const user = userEvent.setup();
    renderMatrix({ activeActivityId: "b2" });

    const tick = screen.getByRole("checkbox", {
      name: "Blocked by Railways/Authority (hindrance)",
    });
    expect(tick).not.toBeChecked();
    expect(screen.queryByLabelText("Expected removal date")).toBeNull();

    await user.click(tick);

    expect(screen.getByLabelText("Expected removal date")).toBeInTheDocument();
    expect(screen.getByLabelText("Actual/final removal date")).toBeInTheDocument();
    expect(screen.getByLabelText("Hindrance remarks")).toBeInTheDocument();
  });

  it("is view-only for someone who cannot edit", () => {
    renderMatrix({ activeActivityId: "b2", canEdit: false });

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("You have view-only access."),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Save update" }),
    ).toBeNull();
  });

  it("opens no popup for a task that is not on this sheet", () => {
    renderMatrix({ activeActivityId: "w1" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ActivityMatrix popup corner: Action History and review", () => {
  const COMMENTS = [
    {
      id: "c1",
      meeting_date: "2026-09-20",
      text: "Shuttering started",
      created_by_name: "Asha Admin",
    },
    {
      id: "c2",
      meeting_date: "2026-09-25",
      text: "Shuttering complete",
      created_by_name: "Ira Incharge",
    },
  ];
  const WITH_HISTORY = {
    ...GROUPS[1],
    rows: [
      row("h1", "Excavation", "IN_PROGRESS", {
        comments: COMMENTS,
        reviewed_at: "2026-09-26T10:00:00Z",
        reviewed_by_name: "Dev Director",
        review_remarks: "Checked",
      }),
      row("h2", "Bottom slab"),
    ],
  };
  const historyIcon = (name = "Excavation") =>
    screen.getByRole("button", {
      name: `Action history for ${name}`,
    });

  it("keeps the two icons out of the strip: they live in the popup", () => {
    renderMatrix({ groups: [WITH_HISTORY] });

    expect(
      screen.queryByRole("button", { name: /Action history for/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /^(Mark .* as reviewed|Reviewed by)/,
      }),
    ).toBeNull();
  });

  it("puts both icons in the popup's corner, beside the close button", () => {
    renderMatrix({ groups: [WITH_HISTORY], activeActivityId: "h1" });

    const dialog = screen.getByRole("dialog");
    const head = dialog.querySelector(".pm-update-panel__head");
    expect(
      within(head).getByRole("button", {
        name: "Action history for Excavation",
      }),
    ).toBeInTheDocument();
    expect(
      within(head).getByRole("button", { name: /Reviewed by Dev Director/ }),
    ).toBeInTheDocument();
    expect(
      within(head).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
  });

  it("changes each icon once there is something behind it, with no counts", () => {
    const { unmount } = renderMatrix({
      groups: [WITH_HISTORY],
      activeActivityId: "h1",
    });

    const withHistory = historyIcon("Excavation");
    expect(withHistory).toHaveClass("pm-tool-button--has-history");
    expect(withHistory).toHaveTextContent("");
    expect(
      screen.getByRole("button", { name: /Reviewed by Dev Director/ }),
    ).toHaveClass("pm-tool-button--reviewed");
    unmount();

    renderMatrix({ groups: [WITH_HISTORY], activeActivityId: "h2" });
    expect(historyIcon("Bottom slab")).not.toHaveClass(
      "pm-tool-button--has-history",
    );
    expect(
      screen.getByRole("button", {
        name: "Mark Bottom slab as reviewed",
      }),
    ).not.toHaveClass("pm-tool-button--reviewed");
  });

  it("swaps the form for the Action History thread, newest first", () => {
    renderMatrix({ groups: [WITH_HISTORY], activeActivityId: "h1" });

    fireEvent.click(historyIcon());

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Action history");
    expect(within(dialog).queryByRole("button", { name: "Save update" })).toBeNull();
    expect(dialog.querySelector("ol.pm-thread")).not.toBeNull();
    const entries = within(dialog).getAllByRole("listitem");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("Ira Incharge");
    expect(entries[0]).toHaveTextContent("25-09-2026");
    expect(entries[0]).toHaveTextContent("Shuttering complete");
    expect(entries[1]).toHaveTextContent("Asha Admin");
  });

  it("says so when a task has no updates yet", () => {
    renderMatrix({ groups: [WITH_HISTORY], activeActivityId: "h2" });

    fireEvent.click(historyIcon("Bottom slab"));

    expect(
      screen.getByText("No meeting updates recorded yet."),
    ).toBeInTheDocument();
  });

  it("stays one popup: the icon does not close it or ask for another", () => {
    const onSelectActivity = vi.fn();
    renderMatrix({
      groups: [WITH_HISTORY],
      activeActivityId: "h1",
      onSelectActivity,
    });

    fireEvent.mouseDown(historyIcon());
    fireEvent.click(historyIcon());

    expect(onSelectActivity).not.toHaveBeenCalled();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("pressing the same icon again goes back to the update form", () => {
    renderMatrix({ groups: [WITH_HISTORY], activeActivityId: "h1" });

    fireEvent.click(historyIcon());
    fireEvent.click(historyIcon());

    expect(
      screen.getByRole("button", { name: "Save update" }),
    ).toBeInTheDocument();
    expect(historyIcon()).toHaveAttribute("aria-expanded", "false");
  });

  it("starts on the update form for the next task", () => {
    const { rerender } = renderMatrix({
      groups: [WITH_HISTORY],
      activeActivityId: "h1",
    });
    fireEvent.click(historyIcon());

    rerender(
      <ActivityMatrix
        groups={[WITH_HISTORY]}
        {...handlers({ activeActivityId: "h2" })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Save update" }),
    ).toBeInTheDocument();
  });

  it("says who reviewed a task and lets it be reviewed again", () => {
    const onReviewActivity = vi.fn();
    renderMatrix({
      groups: [WITH_HISTORY],
      activeActivityId: "h1",
      onReviewActivity,
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Reviewed by Dev Director/ }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      'Reviewed by Dev Director on 26-09-2026 - "Checked"',
    );
    fireEvent.change(within(dialog).getByLabelText("Review remark"), {
      target: { value: "Rechecked" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /review again/i }),
    );

    expect(onReviewActivity).toHaveBeenCalledWith(
      "h1",
      "Rechecked",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("closes the popup once the review is saved", () => {
    const onSelectActivity = vi.fn();
    const onReviewActivity = vi.fn((_id, _remarks, options) =>
      options.onSuccess(),
    );
    renderMatrix({
      groups: [WITH_HISTORY],
      activeActivityId: "h2",
      onSelectActivity,
      onReviewActivity,
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mark Bottom slab as reviewed",
      }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Not yet reviewed.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /mark as reviewed/i }),
    );

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("lets a view-only person review and read the history too", () => {
    renderMatrix({
      groups: [WITH_HISTORY],
      activeActivityId: "h2",
      canEdit: false,
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mark Bottom slab as reviewed",
      }),
    );

    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /mark as reviewed/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows a refused review's error in the popup", () => {
    renderMatrix({
      groups: [WITH_HISTORY],
      activeActivityId: "h2",
      reviewActivityStatus: {
        isPending: false,
        isError: true,
        error: { message: "Not allowed" },
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mark Bottom slab as reviewed",
      }),
    );

    expect(screen.getByText("Not allowed")).toBeInTheDocument();
  });
});
