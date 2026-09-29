import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SlideDownForm } from "./SlideDownForm";

describe("SlideDownForm", () => {
  it("shows the eyebrow, title and children", () => {
    render(
      <SlideDownForm
        eyebrow="Structures"
        title="Add a structure"
        onClose={vi.fn()}
      >
        <p>Form fields go here</p>
      </SlideDownForm>,
    );

    expect(screen.getByText("Structures")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Add a structure" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Form fields go here"),
    ).toBeInTheDocument();
  });

  it("calls onClose from its own close button", () => {
    const onClose = vi.fn();
    render(
      <SlideDownForm
        eyebrow="Structures"
        title="Add a structure"
        onClose={onClose}
      >
        <p>Fields</p>
      </SlideDownForm>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Close form" }),
    );

    expect(onClose).toHaveBeenCalled();
  });

  it("renders inline, not as a portal", () => {
    const { container } = render(
      <div data-testid="wrapper">
        <SlideDownForm
          eyebrow="Structures"
          title="Add a structure"
          onClose={vi.fn()}
        >
          <p>Fields</p>
        </SlideDownForm>
      </div>,
    );

    expect(
      container.querySelector(
        '[data-testid="wrapper"] .pm-slide-panel',
      ),
    ).not.toBeNull();
  });
});
