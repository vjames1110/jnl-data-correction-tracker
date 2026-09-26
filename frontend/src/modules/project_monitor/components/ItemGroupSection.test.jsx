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
  it("shows Edit and Delete, Edit right before Delete", () => {
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
    const DETAILS = /Br\. No\. 214/;

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
      expect(
        screen.getByRole("button", { name: DETAILS }),
      ).toHaveAttribute("aria-expanded", "true");
    });

    it("has no separate View or Hide button - the details themselves open it", () => {
      render(
        <ItemGroupSection
          label="Minor Bridge"
          items={ITEMS}
          onView={vi.fn()}
          onDelete={vi.fn()}
          canEdit
          expandedId={null}
          renderExpanded={() => <div>Workspace</div>}
        />,
      );

      expect(screen.queryByRole("button", { name: "View" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Hide" })).toBeNull();
      expect(
        screen.getByRole("button", { name: DETAILS }),
      ).toHaveAttribute("aria-expanded", "false");
    });

    it("opens on a click of the details and shows nothing while closed", () => {
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
      fireEvent.click(screen.getByText("1 span(s)", { exact: false }));
      expect(onView).toHaveBeenCalledWith("s1");
    });

    it("closes on a second click of the details", () => {
      const onView = vi.fn();
      render(
        <ItemGroupSection
          label="Minor Bridge"
          items={ITEMS}
          onView={onView}
          onDelete={vi.fn()}
          canEdit
          expandedId="s1"
          renderExpanded={() => <div>Workspace</div>}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: DETAILS }));

      expect(onView).toHaveBeenCalledWith("s1");
    });

    it("does not toggle when Edit or Delete is pressed", () => {
      const onView = vi.fn();
      render(
        <ItemGroupSection
          label="Minor Bridge"
          items={ITEMS}
          onView={onView}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          canEdit
          renderExpanded={() => <div>Workspace</div>}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      expect(onView).not.toHaveBeenCalled();
    });

    it("shows the chevron only when there is a workspace to open", () => {
      const { container, rerender } = render(
        <ItemGroupSection
          label="Minor Bridge"
          items={ITEMS}
          onView={vi.fn()}
          onDelete={vi.fn()}
          canEdit
          renderExpanded={() => <div>Workspace</div>}
        />,
      );
      expect(
        container.querySelector(".pm-structure-row__chevron"),
      ).not.toBeNull();

      rerender(
        <ItemGroupSection
          label="Minor Bridge"
          items={ITEMS}
          onView={vi.fn()}
          onDelete={vi.fn()}
          canEdit
        />,
      );
      expect(
        container.querySelector(".pm-structure-row__chevron"),
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: DETAILS }),
      ).not.toHaveAttribute("aria-expanded");
    });
  });
});
