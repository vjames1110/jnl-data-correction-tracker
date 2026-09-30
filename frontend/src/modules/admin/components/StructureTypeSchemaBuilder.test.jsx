import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ConfigSchemaBuilder,
  GroupTemplatesBuilder,
} from "./StructureTypeSchemaBuilder";

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
