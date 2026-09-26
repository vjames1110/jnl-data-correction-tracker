import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ItemGroupSection } from "./ItemGroupSection";

const ITEMS = [
  {
    id: "s1",
    name: "Br. No. 214",
    chainage_km: "12.345",
    description: "1 span(s)",
    overall_progress: { done: 2, total: 10 },
  },
];

describe("ItemGroupSection", () => {
  it("shows View, Edit and Delete, Edit right before Delete", () => {
    render(
      <ItemGroupSection
        label="Minor Bridge"
        items={ITEMS}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        canEdit
      />,
    );

    const buttons = screen.getAllByRole("button");
    const names = buttons.map((button) =>
      (button.getAttribute("aria-label") || button.textContent).trim(),
    );
    expect(names.indexOf("Edit")).toBe(names.indexOf("Delete") - 1);
  });

  it("omits Edit when no onEdit handler is given", () => {
    render(
      <ItemGroupSection
        label="Minor Bridge"
        items={ITEMS}
        onView={vi.fn()}
        onDelete={vi.fn()}
        canEdit
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Delete" }),
    ).toBeInTheDocument();
  });

  it("omits both Edit and Delete without edit access", () => {
    render(
      <ItemGroupSection
        label="Minor Bridge"
        items={ITEMS}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        canEdit={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("passes the whole item to onEdit", () => {
    const onEdit = vi.fn();
    render(
      <ItemGroupSection
        label="Minor Bridge"
        items={ITEMS}
        onView={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
        canEdit
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledWith(ITEMS[0]);
  });

  describe("workspace under the row", () => {
    it("opens the item workspace right under its own row", () => {
      render(
        <ItemGroupSection
          label="Minor Bridge"
          items={ITEMS}
          onView={vi.fn()}
          onDelete={vi.fn()}
          canEdit
          expandedId="s1"
          renderExpanded={(item) => <div>Workspace of {item.name}</div>}
        />,
      );

      expect(
        screen.getByText("Workspace of Br. No. 214"),
      ).toBeInTheDocument();
      const view = screen.getByRole("button", { name: "Hide" });
      expect(view).toHaveAttribute("aria-expanded", "true");
    });

    it("shows nothing extra while the item is closed, and View opens it", () => {
      const onView = vi.fn();
      render(
        <ItemGroupSection
          label="Minor Bridge"
          items={ITEMS}
          onView={onView}
          onDelete={vi.fn()}
          canEdit
          expandedId={null}
          renderExpanded={() => <div>Workspace</div>}
        />,
      );

      expect(screen.queryByText("Workspace")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "View" }));
      expect(onView).toHaveBeenCalledWith("s1");
    });

    it("keeps its plain View button when no workspace is given", () => {
      render(
        <ItemGroupSection
          label="Minor Bridge"
          items={ITEMS}
          onView={vi.fn()}
          onDelete={vi.fn()}
          canEdit
        />,
      );

      expect(
        screen.getByRole("button", { name: "View" }),
      ).not.toHaveAttribute("aria-expanded");
    });
  });
});
