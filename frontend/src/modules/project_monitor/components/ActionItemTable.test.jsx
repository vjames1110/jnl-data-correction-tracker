import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActionItemTable } from "./ActionItemTable";
import { handlers, row } from "./workspaceFixtures";

function item(id, activity, extra = {}) {
  return {
    id,
    responsibility: "Site engineer",
    remarks: "Follow up weekly",
    is_overdue: false,
    activity,
    ...extra,
  };
}

const ITEMS = [
  item("i1", row("a1", "Get Railway block sanction", "IN_PROGRESS")),
  item("i2", row("a2", "Submit as-built drawings", "COMPLETE")),
];

function renderTable(props = {}) {
  const view = handlers();
  const extra = {
    onUpdateItem: vi.fn(),
    updateItemStatus: { isPending: false },
    onDeleteItem: vi.fn(),
    onReopen: vi.fn(),
  };
  render(
    <ActionItemTable
      items={ITEMS}
      emptyMessage="Nothing here."
      {...view}
      {...extra}
      {...props}
    />,
  );
  return extra;
}

const inTable = () => within(screen.getByRole("table"));

describe("ActionItemTable popup", () => {
  it("opens a popup, not an inline row, when an action is clicked", () => {
    const onSelectActivity = vi.fn();
    renderTable({ onSelectActivity });

    fireEvent.click(inTable().getByText("Get Railway block sanction"));

    expect(onSelectActivity).toHaveBeenCalledWith("a1");
  });

  it("shows the responsibility, remarks and the meeting update form in it", () => {
    renderTable({ activeActivityId: "a1" });

    const dialog = screen.getByRole("dialog", {
      name: "Get Railway block sanction - update",
    });
    expect(within(dialog).getByText("Site engineer")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Follow up weekly"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Save update" }),
    ).toBeInTheDocument();
    // History and review are icons on the row, not part of this box.
    expect(within(dialog).queryByText(/action history/i)).toBeNull();
    expect(within(dialog).queryByText(/mark as reviewed/i)).toBeNull();
    // Action items track no percentage.
    expect(within(dialog).queryByLabelText("% done")).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(1 + 2);
  });

  it("edits the responsibility and remarks inside the popup", async () => {
    const user = userEvent.setup();
    const { onUpdateItem } = renderTable({ activeActivityId: "a1" });

    await user.click(
      screen.getByRole("button", {
        name: /edit responsibility \/ remarks/i,
      }),
    );
    const responsibility = screen.getByLabelText("Responsibility");
    await user.clear(responsibility);
    await user.type(responsibility, "Project manager");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onUpdateItem).toHaveBeenCalledWith(
      "i1",
      { responsibility: "Project manager", remarks: "Follow up weekly" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("offers Re-open only for a completed action, inside the popup", async () => {
    const user = userEvent.setup();
    const { onReopen } = renderTable({
      activeActivityId: "a2",
      isCompletedTable: true,
    });

    await user.click(screen.getByRole("button", { name: /re-open/i }));

    expect(onReopen).toHaveBeenCalledWith("a2");
  });

  it("has no Re-open on the open table", () => {
    renderTable({ activeActivityId: "a1" });

    expect(screen.queryByRole("button", { name: /re-open/i })).toBeNull();
  });

  it("closes from its close button and clears an edit in progress", () => {
    const onSelectActivity = vi.fn();
    renderTable({ activeActivityId: "a1", onSelectActivity });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("deleting an action does not open its popup", () => {
    const onSelectActivity = vi.fn();
    const { onDeleteItem } = renderTable({ onSelectActivity });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete action item" })[0],
    );

    expect(onDeleteItem).toHaveBeenCalledWith("i1");
    expect(onSelectActivity).not.toHaveBeenCalled();
  });

  it("flags an overdue action", () => {
    renderTable({
      items: [item("i1", ITEMS[0].activity, { is_overdue: true })],
    });

    expect(screen.getByLabelText("Overdue")).toBeInTheDocument();
  });

  it("says so when there are no actions", () => {
    renderTable({ items: [] });

    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("saving an update closes the popup once the server accepts it", async () => {
    const user = userEvent.setup();
    const onSelectActivity = vi.fn();
    const onSubmitUpdate = vi.fn((_id, _payload, options) =>
      options.onSuccess(),
    );
    renderTable({
      activeActivityId: "a1",
      onSelectActivity,
      onSubmitUpdate,
    });

    await user.click(
      screen.getByRole("button", { name: "Save update" }),
    );

    expect(onSubmitUpdate).toHaveBeenCalledWith(
      "a1",
      expect.any(Object),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });

  it("has Action History and review icons on every row", () => {
    renderTable();

    expect(
      screen.getByRole("button", {
        name: "Action history for Get Railway block sanction",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Mark Submit as-built drawings as reviewed",
      }),
    ).toBeInTheDocument();
  });

  it("opens the review popup from the icon without opening the update popup", async () => {
    const user = userEvent.setup();
    const onSelectActivity = vi.fn();
    const onReviewActivity = vi.fn();
    renderTable({ onSelectActivity, onReviewActivity });

    await user.click(
      screen.getByRole("button", {
        name: "Mark Get Railway block sanction as reviewed",
      }),
    );
    await user.type(
      screen.getByLabelText("Review remark"),
      "Seen on site",
    );
    await user.click(
      screen.getByRole("button", { name: /mark as reviewed/i }),
    );

    expect(onSelectActivity).not.toHaveBeenCalledWith("a1");
    expect(onReviewActivity).toHaveBeenCalledWith(
      "a1",
      "Seen on site",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
