import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DprItemForm } from "./DprItemForm";

const GROUP = {
  id: "g-4",
  item_no: "4",
  description: "Earthwork",
  is_heading: true,
  level: 1,
  parent_id: null,
  has_children: true,
};
const CHILD = {
  id: "i-41",
  item_no: "4.1",
  description: "Embankment",
  is_heading: false,
  level: 2,
  parent_id: "g-4",
};

function renderForm(props = {}) {
  const onSubmit = vi.fn();
  render(
    <DprItemForm
      items={[GROUP, CHILD]}
      contractPercent="5"
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      {...props}
    />,
  );
  return { onSubmit };
}

const field = (label) => screen.getByLabelText(label);

describe("DprItemForm", () => {
  it("works out the bid rate from the authority rate live", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(field(/authority rate/i), "1000");

    expect(screen.getByText("₹1,050.00")).toBeInTheDocument();
    expect(
      screen.getByText(/at 5% above/i),
    ).toBeInTheDocument();
  });

  it("uses a percentage of its own when asked", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(field(/authority rate/i), "1000");
    await user.click(
      screen.getByLabelText(/different % for this item/i),
    );
    await user.type(
      screen.getByLabelText(/tender percentage for this item/i),
      "-2",
    );

    expect(screen.getByText("₹980.00")).toBeInTheDocument();
  });

  it("saves an authority-rate item with the computed rate", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(field("Description"), "Blanketing");
    await user.type(field("Scope quantity"), "400");
    await user.type(field(/authority rate/i), "900");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Blanketing",
        is_heading: false,
        parent: null,
        scope_qty: "400",
        authority_rate: "900",
        rate: "945",
        tender_percent: null,
      }),
    );
  });

  it("sends the item's own percentage only when overridden", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(field("Description"), "Item");
    await user.type(field(/authority rate/i), "1000");
    await user.click(
      screen.getByLabelText(/different % for this item/i),
    );
    await user.type(
      screen.getByLabelText(/tender percentage for this item/i),
      "-2",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        authority_rate: "1000",
        tender_percent: "-2",
        rate: "980",
      }),
    );
  });

  it("keeps a typed rate when there is no authority rate", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(field("Description"), "PCC");
    await user.type(field(/contract rate/i), "123");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        rate: "123",
        authority_rate: null,
        tender_percent: null,
      }),
    );
  });

  it("puts a new item under the chosen group and suggests its number", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ presetParent: "g-4" });

    expect(field("Item no.")).toHaveValue("4.2");
    expect(field("Sits under")).toHaveValue("g-4");

    await user.type(field("Description"), "Blanketing");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ parent: "g-4", item_no: "4.2" }),
    );
  });

  it("does not overwrite a number the user typed", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(field("Item no."), "9.9");
    await user.selectOptions(field("Sits under"), "g-4");

    expect(field("Item no.")).toHaveValue("9.9");
  });

  it("builds a group with its sub-items in one go", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(field("Item no."), "5");
    await user.type(field("Description"), "Concrete");
    await user.click(
      screen.getByLabelText(/this is a group/i),
    );
    expect(
      screen.queryByLabelText(/authority rate/i),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /add sub-item/i }),
    );
    await user.type(
      screen.getByLabelText("Sub-item 1 description"),
      "PCC M15",
    );
    await user.type(
      screen.getByLabelText("Sub-item 1 quantity"),
      "50",
    );
    await user.type(
      screen.getByLabelText("Sub-item 1 authority rate"),
      "4000",
    );
    await user.click(
      screen.getByRole("button", { name: /add sub-item/i }),
    );
    await user.type(
      screen.getByLabelText("Sub-item 2 description"),
      "Plain rate item",
    );
    await user.type(
      screen.getByLabelText("Sub-item 2 rate"),
      "75",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({
      item_no: "5",
      description: "Concrete",
      is_heading: true,
      parent: null,
    });
    expect(payload.children).toEqual([
      {
        item_no: "",
        description: "PCC M15",
        unit: "",
        scope_qty: "50",
        authority_rate: "4000",
      },
      {
        item_no: "",
        description: "Plain rate item",
        unit: "",
        scope_qty: "0",
        authority_rate: null,
        rate: "75",
      },
    ]);
  });

  it("shows each sub-item's bid rate from the contract percentage", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(
      screen.getByLabelText(/this is a group/i),
    );
    await user.click(
      screen.getByRole("button", { name: /add sub-item/i }),
    );
    await user.type(
      screen.getByLabelText("Sub-item 1 authority rate"),
      "200",
    );

    expect(screen.getByText("₹210.00")).toBeInTheDocument();
  });

  it("only offers groups that leave room, and never itself", () => {
    const deep = {
      ...GROUP,
      id: "g-deep",
      item_no: "9",
      description: "Deep",
      level: 3,
    };
    renderForm({
      initial: {
        ...GROUP,
        id: "g-5",
        item_no: "5",
        description: "Concrete",
        has_children: false,
        executed_qty: "0",
        billed_qty: "0",
        scope_qty: "0",
        rate: "0",
        concrete_per_unit: "0",
        tmt_kg_per_unit: "0",
        is_active: true,
      },
      items: [
        GROUP,
        { ...GROUP, id: "g-5", item_no: "5", description: "Concrete" },
        deep,
      ],
    });

    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent.trim());
    expect(options).toEqual(["Top level", "4 Earthwork"]);
  });

  it("keeps a group with items under it a group", () => {
    renderForm({
      initial: {
        ...GROUP,
        executed_qty: "0",
        billed_qty: "0",
        scope_qty: "0",
        rate: "0",
        concrete_per_unit: "0",
        tmt_kg_per_unit: "0",
        is_active: true,
      },
    });

    expect(screen.getByLabelText(/this is a group/i)).toBeDisabled();
    expect(
      screen.getByText(/must stay a group/i),
    ).toBeInTheDocument();
  });

  it("does not let an item with recorded work become a group", () => {
    renderForm({
      initial: {
        ...CHILD,
        is_heading: false,
        has_children: false,
        executed_qty: "12",
        billed_qty: "0",
        scope_qty: "100",
        rate: "50",
        concrete_per_unit: "0",
        tmt_kg_per_unit: "0",
        is_active: true,
      },
    });

    expect(screen.getByLabelText(/this is a group/i)).toBeDisabled();
  });

  it("explains what escalation does to new entries", async () => {
    const user = userEvent.setup();
    renderForm({ escalationPercent: "10" });

    await user.type(field(/authority rate/i), "1000");

    expect(
      screen.getByText(/escalation of 10% in force today/i),
    ).toBeInTheDocument();
    expect(screen.getByText("₹1,155.00")).toBeInTheDocument();
  });
});
