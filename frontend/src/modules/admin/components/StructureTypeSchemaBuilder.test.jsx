import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ConfigSchemaBuilder,
  GroupTemplatesBuilder,
  GroupTemplatesOutline,
} from "./StructureTypeSchemaBuilder";

// Every card in this builder (input field, activity group, activity
// row) is collapsed by default - open the one with this title before
// interacting with anything inside it.
function expandCard(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(escaped, "i") }),
  );
}

describe("ConfigSchemaBuilder - text field type", () => {
  it("offers Text as a field type option", () => {
    render(
      <ConfigSchemaBuilder
        fields={[
          {
            key: "spans",
            label: "No. of spans",
            type: "number",
            default: 2,
          },
        ]}
        onChange={vi.fn()}
      />,
    );
    expandCard("No. of spans");

    expect(
      screen.getByRole("option", { name: "Text" }),
    ).toBeInTheDocument();
  });

  it("switches to a plain text default when Text is picked", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ConfigSchemaBuilder
        fields={[
          {
            key: "stationName",
            label: "Station Name",
            type: "number",
            default: 0,
          },
        ]}
        onChange={onChange}
      />,
    );
    expandCard("Station Name");

    fireEvent.change(
      screen.getByRole("combobox", { name: "Field type" }),
      { target: { value: "text" } },
    );

    expect(onChange).toHaveBeenCalledWith([
      {
        key: "stationName",
        label: "Station Name",
        type: "text",
        default: "",
      },
    ]);

    rerender(
      <ConfigSchemaBuilder
        fields={[
          {
            key: "stationName",
            label: "Station Name",
            type: "text",
            default: "",
          },
        ]}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("Default")).toHaveAttribute(
      "type",
      "text",
    );
  });
});

describe("ConfigSchemaBuilder - group_list field type", () => {
  const PLATFORMS_FIELD = {
    key: "platforms",
    label: "Platforms",
    type: "group_list",
    item_label: "Platform",
    default: [],
    fields: [
      { key: "name", label: "Name of Platform", type: "text" },
    ],
  };

  it("shows an Item label input for the group itself, not a Default", () => {
    render(
      <ConfigSchemaBuilder
        fields={[
          { ...PLATFORMS_FIELD, fields: [] },
        ]}
        onChange={vi.fn()}
      />,
    );
    expandCard("Platforms");

    expect(
      screen.getByLabelText("Item label (e.g. Platform)"),
    ).toHaveValue("Platform");
    expect(screen.queryByLabelText("Default")).toBeNull();
  });

  it("lists the group's own sub-fields for editing", () => {
    render(
      <ConfigSchemaBuilder
        fields={[PLATFORMS_FIELD]}
        onChange={vi.fn()}
      />,
    );
    expandCard("Platforms");
    expandCard("Name of Platform");

    expect(screen.getByDisplayValue("name")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Name of Platform"),
    ).toBeInTheDocument();
  });

  it("adds a new sub-field to the group_list", () => {
    const onChange = vi.fn();
    render(
      <ConfigSchemaBuilder
        fields={[PLATFORMS_FIELD]}
        onChange={onChange}
      />,
    );
    expandCard("Platforms");

    fireEvent.click(
      screen.getByRole("button", { name: /Add item field/i }),
    );

    expect(onChange).toHaveBeenCalledWith([
      {
        ...PLATFORMS_FIELD,
        fields: [
          ...PLATFORMS_FIELD.fields,
          { key: "", label: "", type: "text", default: "" },
        ],
      },
    ]);
  });

  it("removes a sub-field from the group_list", () => {
    const onChange = vi.fn();
    render(
      <ConfigSchemaBuilder
        fields={[PLATFORMS_FIELD]}
        onChange={onChange}
      />,
    );
    expandCard("Platforms");

    fireEvent.click(
      screen.getByRole("button", { name: "Remove item field" }),
    );

    expect(onChange).toHaveBeenCalledWith([
      { ...PLATFORMS_FIELD, fields: [] },
    ]);
  });

  it("switching a field to group_list gives it an empty fields list ready to grow", () => {
    const onChange = vi.fn();
    render(
      <ConfigSchemaBuilder
        fields={[
          {
            key: "platforms",
            label: "Platforms",
            type: "number",
            default: 0,
          },
        ]}
        onChange={onChange}
      />,
    );
    expandCard("Platforms");

    fireEvent.change(
      screen.getByRole("combobox", { name: "Field type" }),
      { target: { value: "group_list" } },
    );

    expect(onChange).toHaveBeenCalledWith([
      {
        key: "platforms",
        label: "Platforms",
        type: "group_list",
        default: [],
        fields: [],
      },
    ]);
  });
});

describe("GroupTemplatesBuilder - repeat group per-index inputs", () => {
  const ABUTMENTS_GROUP = {
    kind: "repeat",
    count_field: "abuts",
    title_template: "Abutment A{n}",
    item_fields: [
      {
        key: "abutName",
        label_template: "A{n} name",
        type: "text",
        default: "",
      },
      {
        key: "abutH",
        label_template: "A{n} height (m)",
        type: "number",
        default: 6,
      },
    ],
    rows: [],
  };

  it("offers Text as a per-index field type, defaulting to Number", () => {
    render(
      <GroupTemplatesBuilder
        groups={[ABUTMENTS_GROUP]}
        configSchema={[
          {
            key: "abuts",
            type: "number",
            default: 2,
          },
        ]}
        onChange={vi.fn()}
      />,
    );
    expandCard("Abutment A{n}");

    const fieldTypeSelects = screen.getAllByRole(
      "combobox",
      { name: "Field type" },
    );
    expect(fieldTypeSelects[0]).toHaveValue("text");
    expect(fieldTypeSelects[1]).toHaveValue(
      "number",
    );
  });

  it("switches a per-index field to text and resets its default to an empty string", () => {
    const onChange = vi.fn();
    render(
      <GroupTemplatesBuilder
        groups={[ABUTMENTS_GROUP]}
        configSchema={[
          {
            key: "abuts",
            type: "number",
            default: 2,
          },
        ]}
        onChange={onChange}
      />,
    );
    expandCard("Abutment A{n}");

    const fieldTypeSelects = screen.getAllByRole(
      "combobox",
      { name: "Field type" },
    );
    fireEvent.change(fieldTypeSelects[1], {
      target: { value: "text" },
    });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...ABUTMENTS_GROUP,
        item_fields: [
          ABUTMENTS_GROUP.item_fields[0],
          {
            ...ABUTMENTS_GROUP.item_fields[1],
            type: "text",
            default: "",
          },
        ],
      },
    ]);
  });

  it("a new per-index input defaults to a Number field", () => {
    const onChange = vi.fn();
    render(
      <GroupTemplatesBuilder
        groups={[
          { ...ABUTMENTS_GROUP, item_fields: [] },
        ]}
        configSchema={[
          {
            key: "abuts",
            type: "number",
            default: 2,
          },
        ]}
        onChange={onChange}
      />,
    );
    expandCard("Abutment A{n}");

    fireEvent.click(
      screen.getByRole("button", {
        name: /Add per-index input/,
      }),
    );

    expect(onChange).toHaveBeenCalledWith([
      {
        ...ABUTMENTS_GROUP,
        item_fields: [
          {
            key: "",
            label_template: "",
            type: "number",
            default: 0,
          },
        ],
      },
    ]);
  });
});

describe("GroupTemplatesBuilder - repeat group naming mode (bug fix)", () => {
  const BY_POSITION_GROUP = {
    kind: "repeat",
    count_field: "abuts",
    title_by_position: {
      first: "Abutment A1",
      middle: "Pier P{m}",
      last: "Abutment A2",
    },
    item_fields: [],
    rows: [],
  };

  const FLOOR_ORDINAL_GROUP = {
    kind: "repeat",
    count_field: "floors",
    title_rule: "floor_ordinal",
    item_fields: [],
    rows: [],
  };

  const TEMPLATE_GROUP = {
    kind: "repeat",
    count_field: "abuts",
    title_template: "Abutment A{n}",
    item_fields: [],
    rows: [],
  };

  it("shows the by-position fields already filled in, not a blank {n} box", () => {
    render(
      <GroupTemplatesBuilder
        groups={[BY_POSITION_GROUP]}
        configSchema={[
          { key: "abuts", type: "number", default: 2 },
        ]}
        onChange={vi.fn()}
      />,
    );
    expandCard("Abutment A1");

    expect(
      screen.getByRole("combobox", { name: "How are these named?" }),
    ).toHaveValue("by_position");
    expect(screen.getByLabelText("First item")).toHaveValue(
      "Abutment A1",
    );
    expect(
      screen.getByLabelText("Middle items (use {n})"),
    ).toHaveValue("Pier P{m}");
    expect(screen.getByLabelText("Last item")).toHaveValue(
      "Abutment A2",
    );
    // The old single {n} template box must not appear at all here -
    // typing into it used to silently do nothing.
    expect(screen.queryByLabelText("Title pattern")).toBeNull();
  });

  it("shows the floor-ordinal mode with no free-text box", () => {
    render(
      <GroupTemplatesBuilder
        groups={[FLOOR_ORDINAL_GROUP]}
        configSchema={[
          { key: "floors", type: "number", default: 3 },
        ]}
        onChange={vi.fn()}
      />,
    );
    expandCard("Floor ordinal");

    expect(
      screen.getByRole("combobox", { name: "How are these named?" }),
    ).toHaveValue("floor_ordinal");
    expect(screen.queryByLabelText("Title pattern")).toBeNull();
    expect(screen.queryByLabelText("First item")).toBeNull();
  });

  it("edits one position without disturbing the others", () => {
    const onChange = vi.fn();
    render(
      <GroupTemplatesBuilder
        groups={[BY_POSITION_GROUP]}
        configSchema={[
          { key: "abuts", type: "number", default: 2 },
        ]}
        onChange={onChange}
      />,
    );
    expandCard("Abutment A1");

    fireEvent.change(
      screen.getByLabelText("Middle items (use {n})"),
      { target: { value: "Pier No. {m}" } },
    );

    expect(onChange).toHaveBeenCalledWith([
      {
        ...BY_POSITION_GROUP,
        title_by_position: {
          ...BY_POSITION_GROUP.title_by_position,
          middle: "Pier No. {m}",
        },
      },
    ]);
  });

  it("switching to the template mode clears title_by_position", () => {
    const onChange = vi.fn();
    render(
      <GroupTemplatesBuilder
        groups={[BY_POSITION_GROUP]}
        configSchema={[
          { key: "abuts", type: "number", default: 2 },
        ]}
        onChange={onChange}
      />,
    );
    expandCard("Abutment A1");

    fireEvent.change(
      screen.getByRole("combobox", { name: "How are these named?" }),
      { target: { value: "template" } },
    );

    const [updated] = onChange.mock.calls.at(-1)[0];
    expect(updated.title_by_position).toBeUndefined();
    expect(updated.title_rule).toBeUndefined();
    expect(updated.title_template).toBe("");
  });

  it("switching to floor-ordinal clears the template and by-position fields", () => {
    const onChange = vi.fn();
    render(
      <GroupTemplatesBuilder
        groups={[TEMPLATE_GROUP]}
        configSchema={[
          { key: "abuts", type: "number", default: 2 },
        ]}
        onChange={onChange}
      />,
    );
    expandCard("Abutment A{n}");

    fireEvent.change(
      screen.getByRole("combobox", { name: "How are these named?" }),
      { target: { value: "floor_ordinal" } },
    );

    const [updated] = onChange.mock.calls.at(-1)[0];
    expect(updated.title_template).toBeUndefined();
    expect(updated.title_rule).toBe("floor_ordinal");
  });
});

describe("ConfigSchemaBuilder - choice options text box", () => {
  const CHOICE_FIELD = {
    key: "foundation",
    label: "Foundation",
    type: "choice",
    default: "open",
    options: [],
  };

  it("lets the user type the whole string without it snapping mid-way", async () => {
    const user = userEvent.setup();
    render(
      <ConfigSchemaBuilder
        fields={[CHOICE_FIELD]}
        onChange={vi.fn()}
      />,
    );
    expandCard("Foundation");

    const input = screen.getByPlaceholderText(
      "open:Open, pile:Pile",
    );
    await user.type(input, "open:Open, pile:Pile");

    // The old bug: typing "p" right after a comma (no ":" yet) got
    // instantly round-tripped to "p:p", corrupting the string under
    // the user's own cursor well before they finished typing.
    expect(input).toHaveValue(
      "open:Open, pile:Pile",
    );
  });

  it("only commits the parsed options on blur, not on every keystroke", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ConfigSchemaBuilder
        fields={[CHOICE_FIELD]}
        onChange={onChange}
      />,
    );
    expandCard("Foundation");

    const input = screen.getByPlaceholderText(
      "open:Open, pile:Pile",
    );
    await user.type(input, "open:Open");

    expect(onChange).not.toHaveBeenCalled();

    await user.tab();

    expect(onChange).toHaveBeenCalledWith([
      {
        ...CHOICE_FIELD,
        options: [
          { value: "open", label: "Open" },
        ],
      },
    ]);
  });

  it("does not mangle typed characters with a real stateful parent, re-rendering on every keystroke", async () => {
    function StatefulWrapper() {
      const [fields, setFields] = useState([
        CHOICE_FIELD,
      ]);
      return (
        <ConfigSchemaBuilder
          fields={fields}
          onChange={setFields}
        />
      );
    }

    const user = userEvent.setup();
    render(<StatefulWrapper />);
    expandCard("Foundation");

    const input = screen.getByPlaceholderText(
      "open:Open, pile:Pile",
    );
    await user.type(input, "open:Open, pile:Pile");

    expect(input).toHaveValue(
      "open:Open, pile:Pile",
    );
  });

  it("commits on Enter too", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ConfigSchemaBuilder
        fields={[CHOICE_FIELD]}
        onChange={onChange}
      />,
    );
    expandCard("Foundation");

    const input = screen.getByPlaceholderText(
      "open:Open, pile:Pile",
    );
    await user.type(
      input,
      "open:Open, pile:Pile{Enter}",
    );

    expect(onChange).toHaveBeenCalledWith([
      {
        ...CHOICE_FIELD,
        options: [
          { value: "open", label: "Open" },
          { value: "pile", label: "Pile" },
        ],
      },
    ]);
  });
});

describe("Move up / Move down (reordering)", () => {
  const FIELD_A = {
    key: "a",
    label: "Field A",
    type: "number",
    default: 0,
  };
  const FIELD_B = {
    key: "b",
    label: "Field B",
    type: "number",
    default: 0,
  };

  it("moving a field down swaps it with its neighbour", () => {
    const onChange = vi.fn();
    render(
      <ConfigSchemaBuilder
        fields={[FIELD_A, FIELD_B]}
        onChange={onChange}
      />,
    );

    const [firstMoveDown] = screen.getAllByRole("button", {
      name: "Move down",
    });
    fireEvent.click(firstMoveDown);

    expect(onChange).toHaveBeenCalledWith([FIELD_B, FIELD_A]);
  });

  it("moving the second field up swaps it back", () => {
    const onChange = vi.fn();
    render(
      <ConfigSchemaBuilder
        fields={[FIELD_A, FIELD_B]}
        onChange={onChange}
      />,
    );

    const moveUps = screen.getAllByRole("button", { name: "Move up" });
    fireEvent.click(moveUps[1]);

    expect(onChange).toHaveBeenCalledWith([FIELD_B, FIELD_A]);
  });

  it("disables Move up on the first field and Move down on the last", () => {
    render(
      <ConfigSchemaBuilder
        fields={[FIELD_A, FIELD_B]}
        onChange={vi.fn()}
      />,
    );

    const moveUps = screen.getAllByRole("button", { name: "Move up" });
    const moveDowns = screen.getAllByRole("button", {
      name: "Move down",
    });
    expect(moveUps[0]).toBeDisabled();
    expect(moveUps[1]).toBeEnabled();
    expect(moveDowns[0]).toBeEnabled();
    expect(moveDowns[1]).toBeDisabled();
  });

  it("keeps a field's expand state attached to it, not to its position, when it moves", () => {
    function StatefulWrapper() {
      const [fields, setFields] = useState([FIELD_A, FIELD_B]);
      return (
        <ConfigSchemaBuilder fields={fields} onChange={setFields} />
      );
    }
    render(<StatefulWrapper />);
    expandCard("Field A");
    expect(
      screen.getByLabelText(
        "Label shown on the Add-structure form",
      ),
    ).toHaveValue("Field A");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Move down" })[0],
    );

    // Field A is now the second card, but must still be the one
    // that's open - not Field B inheriting an expand state that
    // belongs to a position, not a field.
    expect(
      screen.getByLabelText(
        "Label shown on the Add-structure form",
      ),
    ).toHaveValue("Field A");
  });

  it("moving an activity group down swaps it with its neighbour", () => {
    const onChange = vi.fn();
    const GROUP_A = { kind: "static", title: "Group A", rows: [] };
    const GROUP_B = { kind: "static", title: "Group B", rows: [] };
    render(
      <GroupTemplatesBuilder
        groups={[GROUP_A, GROUP_B]}
        configSchema={[]}
        onChange={onChange}
      />,
    );

    const [firstMoveDown] = screen.getAllByRole("button", {
      name: "Move down",
    });
    fireEvent.click(firstMoveDown);

    expect(onChange).toHaveBeenCalledWith([GROUP_B, GROUP_A]);
  });

  it("moving an activity row down swaps it with its neighbour inside the same group", () => {
    const onChange = vi.fn();
    const GROUP = {
      kind: "static",
      title: "Box structure",
      rows: [
        { name: "Row A", kind: "TASK" },
        { name: "Row B", kind: "TASK" },
      ],
    };
    render(
      <GroupTemplatesBuilder
        groups={[GROUP]}
        configSchema={[]}
        onChange={onChange}
      />,
    );
    expandCard("Box structure");

    const [firstMoveDown] = screen.getAllByRole("button", {
      name: "Move down",
    });
    fireEvent.click(firstMoveDown);

    expect(onChange).toHaveBeenCalledWith([
      {
        ...GROUP,
        rows: [
          { name: "Row B", kind: "TASK" },
          { name: "Row A", kind: "TASK" },
        ],
      },
    ]);
  });
});

describe("GroupTemplatesOutline", () => {
  it("shows a hint instead of a table of contents when there are no groups", () => {
    render(<GroupTemplatesOutline groups={[]} />);

    expect(
      screen.getByText(/No activity groups yet/),
    ).toBeInTheDocument();
  });

  it("lists every group's title and its row names, in order", () => {
    render(
      <GroupTemplatesOutline
        groups={[
          {
            kind: "static",
            title: "Box structure",
            rows: [
              { name: "Box raft" },
              { name: "Box wall" },
            ],
          },
          {
            kind: "repeat",
            count_field: "abuts",
            title_template: "Abutment A{n}",
            rows: [],
          },
        ]}
      />,
    );

    expect(screen.getByText("Box structure")).toBeInTheDocument();
    expect(screen.getByText("Box raft")).toBeInTheDocument();
    expect(screen.getByText("Box wall")).toBeInTheDocument();
    expect(screen.getByText("Abutment A{n}")).toBeInTheDocument();
    expect(
      screen.getByText(/repeats per "abuts"/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No activity rows yet."),
    ).toBeInTheDocument();
  });
});
