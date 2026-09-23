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
