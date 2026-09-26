import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActivityGroupsTable } from "./ActivityGroupsTable";
import { GROUPS, handlers, row } from "./workspaceFixtures";

const SPAN_GROUP = {
  group_order: 3,
  group_title: "Superstructure (span-wise)",
  group_subtitle: "9 span(s)",
  rows: [
    row("s1a", "S1 – Bearings"),
    row("s1b", "S1 – Girder fabrication"),
    row("s2a", "S2 – Bearings"),
    row("s2b", "S2 – Girder fabrication"),
    row("s3a", "S3 – Bearings"),
  ],
};

function renderTable(props = {}) {
  const view = render(
    <ActivityGroupsTable
      groups={[GROUPS[1]]}
      {...handlers()}
      {...props}
    />,
  );
  return view;
}

// Inside the table only: an open popup repeats the task's name.
const rowOf = (name) =>
  within(screen.getByRole("table")).getByText(name).closest("tr");

describe("ActivityGroupsTable popup", () => {
  it("opens nothing until a task is clicked", () => {
    renderTable();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks the page to open a task when its row is clicked anywhere", () => {
    const onSelectActivity = vi.fn();
    renderTable({ onSelectActivity });

    // Not on the name - on the status cell of the same row.
    fireEvent.click(
      within(rowOf("Bottom slab")).getByText("In Progress"),
    );

    expect(onSelectActivity).toHaveBeenCalledWith("b2");
  });

  it("shows only the active task's update form in a popup, not inline", () => {
    renderTable({ activeActivityId: "b2" });

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
    // The table itself gained no extra row for it.
    expect(screen.getAllByRole("row")).toHaveLength(1 + 3);
    expect(dialog.closest("table")).toBeNull();
  });

  it("keeps Action History and review out of the update popup", () => {
    renderTable({ activeActivityId: "b2" });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText(/action history/i)).toBeNull();
    expect(within(dialog).queryByText(/mark as reviewed/i)).toBeNull();
    expect(within(dialog).queryByText("Update this meeting")).toBeNull();
  });

  it("marks the open task's row and its name button", () => {
    renderTable({ activeActivityId: "b2" });

    expect(rowOf("Bottom slab")).toHaveClass("pm-row--expanded");
    expect(
      screen.getByRole("button", { name: "Bottom slab" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: "Excavation" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("clicking the open task again closes it", () => {
    const onSelectActivity = vi.fn();
    renderTable({ activeActivityId: "b2", onSelectActivity });

    fireEvent.click(rowOf("Bottom slab"));

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("clicking a different task moves the popup to it", () => {
    const onSelectActivity = vi.fn();
    renderTable({ activeActivityId: "b2", onSelectActivity });

    fireEvent.mouseDown(rowOf("Excavation"));
    fireEvent.click(rowOf("Excavation"));

    // The press did not close it first, so the click moves it once.
    expect(onSelectActivity).toHaveBeenCalledTimes(1);
    expect(onSelectActivity).toHaveBeenCalledWith("b1");
  });

  it("closes from its close button", () => {
    const onSelectActivity = vi.fn();
    renderTable({ activeActivityId: "b2", onSelectActivity });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("closes on Escape", () => {
    const onSelectActivity = vi.fn();
    renderTable({ activeActivityId: "b2", onSelectActivity });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("closes on a click outside it", () => {
    const onSelectActivity = vi.fn();
    render(
      <div>
        <p>Somewhere else</p>
        <ActivityGroupsTable
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
    renderTable({ activeActivityId: "b2", onSelectActivity });

    fireEvent.mouseDown(screen.getByLabelText("Remark for this meeting"));

    expect(onSelectActivity).not.toHaveBeenCalled();
  });

  it("can be opened from the keyboard", async () => {
    const user = userEvent.setup();
    const onSelectActivity = vi.fn();
    renderTable({ onSelectActivity });

    await user.tab();
    await user.keyboard("{Enter}");

    expect(onSelectActivity).toHaveBeenCalledWith("b1");
  });

  it("sends the update for the open task", async () => {
    const user = userEvent.setup();
    const onSubmitUpdate = vi.fn();
    renderTable({ activeActivityId: "b2", onSubmitUpdate });

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
    renderTable({
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
    renderTable({
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
    renderTable({ activeActivityId: "b2" });

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
    renderTable({ activeActivityId: "b2", canEdit: false });

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("You have view-only access."),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Save update" }),
    ).toBeNull();
  });

  it("opens no popup for a task in another group", () => {
    renderTable({ activeActivityId: "w1" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ActivityGroupsTable span banding", () => {
  it("alternates light grey and white from one span to the next", () => {
    renderTable({ groups: [SPAN_GROUP] });

    expect(rowOf("S1 – Bearings")).toHaveClass("pm-row--band-a");
    expect(rowOf("S1 – Girder fabrication")).toHaveClass(
      "pm-row--band-a",
    );
    expect(rowOf("S2 – Bearings")).toHaveClass("pm-row--band-b");
    expect(rowOf("S2 – Girder fabrication")).toHaveClass(
      "pm-row--band-b",
    );
    expect(rowOf("S3 – Bearings")).toHaveClass("pm-row--band-a");
  });

  it("marks the first row of each later span", () => {
    renderTable({ groups: [SPAN_GROUP] });

    expect(rowOf("S1 – Bearings")).not.toHaveClass(
      "pm-row--cluster-start",
    );
    expect(rowOf("S2 – Bearings")).toHaveClass(
      "pm-row--cluster-start",
    );
    expect(rowOf("S2 – Girder fabrication")).not.toHaveClass(
      "pm-row--cluster-start",
    );
    expect(rowOf("S3 – Bearings")).toHaveClass(
      "pm-row--cluster-start",
    );
  });

  it("leaves an ordinary group's rows plain", () => {
    renderTable();

    ["Excavation", "Bottom slab", "Apron"].forEach((name) => {
      expect(rowOf(name).className).not.toMatch(/band/);
    });
  });

  it("still opens a banded row's popup", () => {
    renderTable({
      groups: [SPAN_GROUP],
      activeActivityId: "s2a",
    });

    expect(
      screen.getByRole("dialog", { name: "S2 – Bearings - update" }),
    ).toBeInTheDocument();
  });
});

describe("ActivityGroupsTable row tools", () => {
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
  const historyIcon = () =>
    screen.getByRole("button", {
      name: "Action history for Excavation",
    });

  it("changes each icon once there is something behind it, with no counts", () => {
    renderTable({ groups: [WITH_HISTORY] });

    // Excavation has updates and a review; Bottom slab has neither.
    const withHistory = historyIcon();
    const withoutHistory = screen.getByRole("button", {
      name: "Action history for Bottom slab",
    });
    expect(withHistory).toHaveClass("pm-tool-button--has-history");
    expect(withoutHistory).not.toHaveClass("pm-tool-button--has-history");
    expect(withHistory).toHaveTextContent("");
    expect(withHistory.querySelector("svg")).not.toBe(
      withoutHistory.querySelector("svg"),
    );
    expect(
      withHistory.querySelector("svg").getAttribute("class"),
    ).not.toBe(withoutHistory.querySelector("svg").getAttribute("class"));

    expect(
      screen.getByRole("button", {
        name: /Reviewed by Dev Director on 26-09-2026/,
      }),
    ).toHaveClass("pm-tool-button--reviewed");
    expect(
      screen.getByRole("button", {
        name: "Mark Bottom slab as reviewed",
      }),
    ).not.toHaveClass("pm-tool-button--reviewed");
  });

  it("shows the Action History as a thread, newest first, with who and when", () => {
    renderTable({ groups: [WITH_HISTORY] });

    fireEvent.click(historyIcon());

    const dialog = screen.getByRole("dialog", {
      name: "Action history - Excavation",
    });
    expect(dialog.querySelector("ol.pm-thread")).not.toBeNull();
    const entries = within(dialog).getAllByRole("listitem");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("Ira Incharge");
    expect(entries[0]).toHaveTextContent("25-09-2026");
    expect(entries[0]).toHaveTextContent("Shuttering complete");
    // The author's initials sit on the thread's node.
    expect(entries[0]).toHaveTextContent("II");
    expect(entries[1]).toHaveTextContent("Asha Admin");
    expect(entries[1]).toHaveTextContent("Shuttering started");
  });

  it("says so when a task has no updates yet", () => {
    renderTable({ groups: [WITH_HISTORY] });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Action history for Bottom slab",
      }),
    );

    expect(
      screen.getByText("No meeting updates recorded yet."),
    ).toBeInTheDocument();
  });

  it("does not open the update popup when an icon is pressed", () => {
    const onSelectActivity = vi.fn();
    renderTable({ groups: [WITH_HISTORY], onSelectActivity });

    fireEvent.click(historyIcon());

    expect(onSelectActivity).not.toHaveBeenCalledWith("h1");
  });

  it("closes an open update popup when an icon is pressed", () => {
    const onSelectActivity = vi.fn();
    renderTable({
      groups: [WITH_HISTORY],
      activeActivityId: "h2",
      onSelectActivity,
    });

    fireEvent.click(historyIcon());

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("pressing the same icon again closes its popup", () => {
    renderTable({ groups: [WITH_HISTORY] });

    fireEvent.click(historyIcon());
    fireEvent.mouseDown(historyIcon());
    fireEvent.click(historyIcon());

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("pressing a task row closes an open icon popup", () => {
    renderTable({ groups: [WITH_HISTORY] });

    fireEvent.click(historyIcon());
    fireEvent.click(rowOf("Bottom slab"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes an icon popup on Escape", () => {
    renderTable({ groups: [WITH_HISTORY] });
    fireEvent.click(historyIcon());

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says who reviewed a task and lets it be reviewed again", () => {
    const onReviewActivity = vi.fn();
    renderTable({ groups: [WITH_HISTORY], onReviewActivity });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Reviewed by Dev Director/,
      }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Review - Excavation",
    });
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

  it("closes the review popup once the review is saved", () => {
    const onReviewActivity = vi.fn((_id, _remarks, options) =>
      options.onSuccess(),
    );
    renderTable({ groups: [WITH_HISTORY], onReviewActivity });

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

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets a view-only person review and read the history too", () => {
    renderTable({ groups: [WITH_HISTORY], canEdit: false });

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

  it("shows a refused review's error in its popup", () => {
    renderTable({
      groups: [WITH_HISTORY],
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
