import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AddActivityForm } from "./AddActivityForm";
import { GROUPS } from "./workspaceFixtures";

describe("AddActivityForm", () => {
  it("defaults the section to the one it was opened from", () => {
    render(
      <AddActivityForm
        groups={GROUPS}
        defaultGroupTitle="Box Structure"
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Section")).toHaveValue("Box Structure");
    expect(
      screen.getByRole("option", { name: "Approvals" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Wing walls" }),
    ).toBeInTheDocument();
  });

  it("falls back to the sheet's first section when the default isn't a real one", () => {
    render(
      <AddActivityForm
        groups={GROUPS}
        defaultGroupTitle="Piers"
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Section")).toHaveValue("Approvals");
  });

  it("keeps Add activity disabled until a name is entered", async () => {
    const user = userEvent.setup();
    render(
      <AddActivityForm
        groups={GROUPS}
        defaultGroupTitle="Approvals"
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const submit = screen.getByRole("button", { name: "Add activity" });
    expect(submit).toBeDisabled();

    await user.type(
      screen.getByLabelText("Activity name"),
      "Anti-carbonation coating",
    );

    expect(submit).toBeEnabled();
  });

  it("only asks for a unit when the kind is Quantity", async () => {
    const user = userEvent.setup();
    render(
      <AddActivityForm
        groups={GROUPS}
        defaultGroupTitle="Approvals"
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Unit")).toBeNull();

    await user.selectOptions(
      screen.getByLabelText("Kind"),
      "Quantity",
    );

    expect(screen.getByLabelText("Unit")).toBeInTheDocument();
  });

  it("submits a Quantity task with its unit, trimmed", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <AddActivityForm
        groups={GROUPS}
        defaultGroupTitle="Approvals"
        onAdd={onAdd}
        onClose={vi.fn()}
      />,
    );

    await user.type(
      screen.getByLabelText("Activity name"),
      "Return wall extension",
    );
    await user.selectOptions(
      screen.getByLabelText("Kind"),
      "Quantity",
    );
    await user.type(screen.getByLabelText("Unit"), "  m  ");
    await user.click(
      screen.getByRole("button", { name: "Add activity" }),
    );

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        group_title: "Approvals",
        name: "Return wall extension",
        kind: "LENGTH",
        unit: "m",
        position: "end",
      }),
      { onSuccess: expect.any(Function) },
    );
  });

  it("only shows the Which-task picker once a before/after position is chosen", async () => {
    const user = userEvent.setup();
    render(
      <AddActivityForm
        groups={GROUPS}
        defaultGroupTitle="Approvals"
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Which task")).toBeNull();

    await user.selectOptions(
      screen.getByLabelText("Position"),
      "After…",
    );

    const picker = screen.getByLabelText("Which task");
    expect(picker).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "GAD Approval" }),
    ).toBeInTheDocument();
  });

  it("resets the chosen task when the section or position changes", async () => {
    const user = userEvent.setup();
    render(
      <AddActivityForm
        groups={GROUPS}
        defaultGroupTitle="Approvals"
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Position"),
      "Before…",
    );
    await user.selectOptions(
      screen.getByLabelText("Which task"),
      "a2",
    );
    expect(screen.getByLabelText("Which task")).toHaveValue("a2");

    await user.selectOptions(
      screen.getByLabelText("Section"),
      "Box Structure",
    );

    expect(screen.getByLabelText("Which task")).toHaveValue("");
  });

  it("does not submit without a name", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <AddActivityForm
        groups={GROUPS}
        defaultGroupTitle="Approvals"
        onAdd={onAdd}
        onClose={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Add activity" }),
    );

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("closes from its own close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AddActivityForm
        groups={GROUPS}
        defaultGroupTitle="Approvals"
        onAdd={vi.fn()}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("shows the server's error", () => {
    render(
      <AddActivityForm
        groups={GROUPS}
        defaultGroupTitle="Approvals"
        onAdd={vi.fn()}
        onClose={vi.fn()}
        error={{ message: "That section doesn't exist" }}
      />,
    );

    expect(
      screen.getByText("That section doesn't exist"),
    ).toBeInTheDocument();
  });

  it("shows Adding... while the request is pending", () => {
    render(
      <AddActivityForm
        groups={GROUPS}
        defaultGroupTitle="Approvals"
        onAdd={vi.fn()}
        onClose={vi.fn()}
        isPending
      />,
    );

    expect(
      screen.getByRole("button", { name: "Adding..." }),
    ).toBeDisabled();
  });
});
