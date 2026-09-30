import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AddStructureForm } from "./AddStructureForm";

const hooks = vi.hoisted(() => ({
  createLocation: vi.fn(),
  deleteLocation: vi.fn(),
}));

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useCreateStructureLocation: (...args) =>
    hooks.createLocation(...args),
  useDeleteStructureLocation: (...args) =>
    hooks.deleteLocation(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  hooks.createLocation.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  });
  hooks.deleteLocation.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  });
});

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

const NAMED_ABUTMENTS = {
  id: "type-named-abutments",
  name: "Major Bridge",
  config_schema: [
    { key: "abuts", label: "No. of abutments", type: "number", default: 2 },
  ],
  group_templates: [
    {
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
          default: 6,
        },
      ],
      rows: [],
    },
  ],
};

describe("AddStructureForm - named repeat-group item fields", () => {
  it("renders a text item field as text inputs, one per index", () => {
    render(
      <AddStructureForm
        structureTypes={[NAMED_ABUTMENTS]}
        onCreate={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const nameRow = screen
      .getByText("A name")
      .closest("label");
    const nameInputs = within(nameRow).getAllByRole(
      "textbox",
    );
    expect(nameInputs).toHaveLength(2);
    expect(nameInputs[0]).toHaveValue("");
  });

  it("keeps a numeric item field as number inputs, unaffected", () => {
    render(
      <AddStructureForm
        structureTypes={[NAMED_ABUTMENTS]}
        onCreate={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const heightInputs = screen.getAllByRole(
      "spinbutton",
    );
    // barrel/chainage aren't on this fixture - only the 2 abutment
    // heights and the "No. of abutments" field itself.
    expect(heightInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("submits the typed names as a plain array", () => {
    const onCreate = vi.fn();
    render(
      <AddStructureForm
        structureTypes={[NAMED_ABUTMENTS]}
        onCreate={onCreate}
        onCancel={vi.fn()}
      />,
    );

    const nameRow = screen
      .getByText("A name")
      .closest("label");
    const nameInputs = within(nameRow).getAllByRole(
      "textbox",
    );
    fireEvent.change(nameInputs[0], {
      target: { value: "North abutment" },
    });
    fireEvent.change(nameInputs[1], {
      target: { value: "South abutment" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("e.g. Br. No. 214"),
      { target: { value: "Br. No. 900" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Generate sheet" }),
    );

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          abutName: [
            "North abutment",
            "South abutment",
          ],
        }),
      }),
      expect.any(Object),
    );
  });

  it("pre-fills existing names when editing", () => {
    render(
      <AddStructureForm
        structureTypes={[NAMED_ABUTMENTS]}
        initialStructure={{
          id: "s1",
          structure_type: "type-named-abutments",
          name: "Br. No. 900",
          chainage_km: "5.000",
          config: {
            abuts: 2,
            abutName: [
              "North abutment",
              "South abutment",
            ],
            abutH: [6, 7],
          },
        }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByDisplayValue("North abutment"),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("South abutment"),
    ).toBeInTheDocument();
  });
});

describe("AddStructureForm - Chainage/Ramp locations", () => {
  const STRUCTURE_NO_LOCATIONS = {
    id: "s1",
    site: "site-1",
    structure_type: "type-minor",
    name: "Br. No. 214",
    chainage_km: "12.345",
    config: { barrel: 12, returns: 4, apron: true },
    locations: [],
  };

  const STRUCTURE_WITH_LOCATIONS = {
    ...STRUCTURE_NO_LOCATIONS,
    chainage_km: "8.000",
    locations: [
      {
        id: "loc-1",
        location_type: "CHAINAGE",
        name: "Down line",
        chainage_km: "8.000",
        remarks: "",
      },
      {
        id: "loc-2",
        location_type: "RAMP",
        name: "R2",
        chainage_km: null,
        remarks: "",
      },
    ],
  };

  it("shows a hint instead of the manager while creating a new structure", () => {
    render(
      <AddStructureForm
        structureTypes={[MINOR]}
        onCreate={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        /can be added once this structure is created/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Chainage / Ramp locations"),
    ).toBeNull();
  });

  it("shows the manager, with no locations yet, while editing", () => {
    render(
      <AddStructureForm
        structureTypes={[MINOR]}
        initialStructure={STRUCTURE_NO_LOCATIONS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Chainage / Ramp locations"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Add chainage/ramp",
      }),
    ).toBeInTheDocument();
  });

  it("lists existing locations by type, name and value", () => {
    render(
      <AddStructureForm
        structureTypes={[MINOR]}
        initialStructure={STRUCTURE_WITH_LOCATIONS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Chainage · Down line · 8.000 km"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ramp · R2"),
    ).toBeInTheDocument();
  });

  it("disables the plain Chainage field once a location exists", () => {
    render(
      <AddStructureForm
        structureTypes={[MINOR]}
        initialStructure={STRUCTURE_WITH_LOCATIONS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText(/Chainage \(km\)/),
    ).toBeDisabled();
  });

  it("keeps the plain Chainage field editable with no locations yet", () => {
    render(
      <AddStructureForm
        structureTypes={[MINOR]}
        initialStructure={STRUCTURE_NO_LOCATIONS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText(/Chainage \(km\)/),
    ).toBeEnabled();
  });

  it("adds a new location with the site/structure id and typed fields", () => {
    const mutate = vi.fn();
    hooks.createLocation.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
    });

    render(
      <AddStructureForm
        structureTypes={[MINOR]}
        initialStructure={STRUCTURE_NO_LOCATIONS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add chainage/ramp",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("Type"),
      { target: { value: "RAMP" } },
    );
    fireEvent.change(
      screen.getByLabelText("Name (optional)"),
      { target: { value: "R2" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save" }),
    );

    expect(hooks.createLocation).toHaveBeenCalledWith(
      "site-1",
    );
    expect(mutate).toHaveBeenCalledWith(
      {
        structureId: "s1",
        payload: {
          location_type: "RAMP",
          name: "R2",
          chainage_km: null,
          remarks: "",
        },
      },
      { onSuccess: expect.any(Function) },
    );
  });

  it("deletes a location by its id", () => {
    const mutate = vi.fn();
    hooks.deleteLocation.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
    });

    render(
      <AddStructureForm
        structureTypes={[MINOR]}
        initialStructure={STRUCTURE_WITH_LOCATIONS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Down line",
      }),
    );

    expect(mutate).toHaveBeenCalledWith("loc-1");
  });
});
