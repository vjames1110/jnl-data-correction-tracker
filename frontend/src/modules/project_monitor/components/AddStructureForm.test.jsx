import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddStructureForm } from "./AddStructureForm";

const MINOR = {
  id: "type-minor",
  name: "Minor Bridge",
  config_schema: [
    { key: "barrel", label: "Barrel length (m)", type: "number", default: 12 },
    {
      key: "returns",
      label: "Return walls",
      type: "choice",
      default: 4,
      options: [
        { value: 2, label: "2" },
        { value: 4, label: "4" },
      ],
    },
    { key: "apron", label: "Apron", type: "boolean", default: true },
  ],
  group_templates: [
    { kind: "static", title: "Box structure", rows: [] },
  ],
};

const MAJOR = {
  id: "type-major",
  name: "Major Bridge",
  config_schema: [],
  group_templates: [],
};

describe("AddStructureForm - create mode", () => {
  it("defaults to the first type and its default config", () => {
    render(
      <AddStructureForm
        structureTypes={[MINOR, MAJOR]}
        onCreate={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Type" })).toHaveValue(
      "type-minor",
    );
    expect(screen.getByLabelText("Barrel length (m)")).toHaveValue(12);
    expect(
      screen.getByRole("button", { name: "Generate sheet" }),
    ).toBeInTheDocument();
  });

  it("submits the entered name, chainage and config", () => {
    const onCreate = vi.fn();
    render(
      <AddStructureForm
        structureTypes={[MINOR]}
        onCreate={onCreate}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("e.g. Br. No. 214"),
      { target: { value: "Br. No. 900" } },
    );
    fireEvent.change(screen.getByPlaceholderText("12.345"), {
      target: { value: "5.5" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Generate sheet" }),
    );

    expect(onCreate).toHaveBeenCalledWith(
      {
        structure_type: "type-minor",
        name: "Br. No. 900",
        chainage_km: "5.5",
        config: { barrel: 12, returns: 4, apron: true },
      },
      expect.any(Object),
    );
  });

  it("lets the Type be changed", () => {
    render(
      <AddStructureForm
        structureTypes={[MINOR, MAJOR]}
        onCreate={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("combobox", { name: "Type" }),
    ).not.toBeDisabled();
  });
});

describe("AddStructureForm - edit mode", () => {
  const STRUCTURE = {
    id: "s1",
    structure_type: "type-minor",
    name: "Br. No. 214",
    chainage_km: "12.345",
    config: { barrel: 15, returns: 2, apron: false },
  };

  it("starts pre-filled from the structure and locks the Type", () => {
    render(
      <AddStructureForm
        structureTypes={[MINOR, MAJOR]}
        initialStructure={STRUCTURE}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByDisplayValue("Br. No. 214"),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("12.345"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Barrel length (m)")).toHaveValue(15);
    expect(
      screen.getByRole("combobox", { name: /^Type/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  it("saves the edited name, chainage and config, without a structure_type", () => {
    const onSave = vi.fn();
    render(
      <AddStructureForm
        structureTypes={[MINOR, MAJOR]}
        initialStructure={STRUCTURE}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByDisplayValue("Br. No. 214"),
      { target: { value: "Br. No. 214-A" } },
    );
    fireEvent.change(screen.getByLabelText("Return walls"), {
      target: { value: "4" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save changes" }),
    );

    expect(onSave).toHaveBeenCalledWith({
      name: "Br. No. 214-A",
      chainage_km: "12.345",
      config: { barrel: 15, returns: 4, apron: false },
    });
  });

  it("cancels without saving", () => {
    const onCancel = vi.fn();
    render(
      <AddStructureForm
        structureTypes={[MINOR]}
        initialStructure={STRUCTURE}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });
});

const FOB = {
  id: "type-fob",
  name: "FOB (Foot Over Bridge)",
  config_schema: [
    {
      key: "stationName",
      label: "Station Name",
      type: "text",
      default: "",
    },
    {
      key: "platforms",
      label: "Platforms",
      item_label: "Platform",
      type: "group_list",
      default: [],
      fields: [
        { key: "name", label: "Name of Platform", type: "text" },
        {
          key: "colHeight",
          label: "Col height (m)",
          type: "number",
          default: 6,
        },
        {
          key: "hasLift",
          label: "Has Lift",
          type: "boolean",
          default: false,
        },
        {
          key: "foundation",
          label: "Foundation",
          type: "choice",
          default: "open",
          options: [
            { value: "open", label: "Open" },
            { value: "pile", label: "Pile" },
          ],
        },
      ],
    },
  ],
  group_templates: [
    { kind: "static", title: "Footing", rows: [] },
  ],
};

describe("AddStructureForm - text and group_list fields", () => {
  it("renders a text field as a plain text input, defaulted from the schema", () => {
    render(
      <AddStructureForm
        structureTypes={[FOB]}
        onCreate={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Station Name");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("");
  });

  it("submits whatever is typed into a text field", () => {
    const onCreate = vi.fn();
    render(
      <AddStructureForm
        structureTypes={[FOB]}
        onCreate={onCreate}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Station Name"), {
      target: { value: "Chunar" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("e.g. Br. No. 214"),
      { target: { value: "FOB-1" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Generate sheet" }),
    );

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          stationName: "Chunar",
        }),
      }),
      expect.any(Object),
    );
  });

  it("starts with no platforms and an Add button", () => {
    render(
      <AddStructureForm
        structureTypes={[FOB]}
        onCreate={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Platform 1/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Add Platform" }),
    ).toBeInTheDocument();
  });

  it("adds a platform with its own sub-fields", () => {
    const onCreate = vi.fn();
    render(
      <AddStructureForm
        structureTypes={[FOB]}
        onCreate={onCreate}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add Platform" }),
    );
    fireEvent.change(
      screen.getByLabelText("Name of Platform"),
      { target: { value: "Platform A" } },
    );
    fireEvent.change(screen.getByLabelText("Col height (m)"), {
      target: { value: "7.5" },
    });
    fireEvent.change(screen.getByLabelText("Has Lift"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Foundation"), {
      target: { value: "pile" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save" }),
    );

    // The add form closed and the new platform shows in the list.
    expect(
      screen.queryByLabelText("Name of Platform"),
    ).toBeNull();
    expect(screen.getByText("Platform A")).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("e.g. Br. No. 214"),
      { target: { value: "FOB-1" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Generate sheet" }),
    );

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          platforms: [
            {
              name: "Platform A",
              colHeight: "7.5",
              hasLift: true,
              foundation: "pile",
            },
          ],
        }),
      }),
      expect.any(Object),
    );
  });

  it("edits an existing platform in place", () => {
    render(
      <AddStructureForm
        structureTypes={[FOB]}
        onCreate={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add Platform" }),
    );
    fireEvent.change(
      screen.getByLabelText("Name of Platform"),
      { target: { value: "Platform A" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Edit Platform 1" }),
    );
    fireEvent.change(
      screen.getByLabelText("Name of Platform"),
      { target: { value: "Platform B" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save" }),
    );

    expect(screen.getByText("Platform B")).toBeInTheDocument();
    expect(screen.queryByText("Platform A")).toBeNull();
  });

  it("removes a platform", () => {
    render(
      <AddStructureForm
        structureTypes={[FOB]}
        onCreate={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add Platform" }),
    );
    fireEvent.change(
      screen.getByLabelText("Name of Platform"),
      { target: { value: "Platform A" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save" }),
    );
    expect(screen.getByText("Platform A")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Platform 1",
      }),
    );

    expect(screen.queryByText("Platform A")).toBeNull();
  });

  it("cancelling the add-platform form keeps the list unchanged", () => {
    render(
      <AddStructureForm
        structureTypes={[FOB]}
        onCreate={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add Platform" }),
    );
    fireEvent.change(
      screen.getByLabelText("Name of Platform"),
      { target: { value: "Platform A" } },
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Cancel" })[0],
    );

    expect(screen.queryByText("Platform A")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Add Platform" }),
    ).toBeInTheDocument();
  });
});
