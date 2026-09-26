import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityPopup } from "./ActivityPopup";

function renderPopup(props = {}) {
  const onClose = vi.fn();
  render(
    <div>
      <table>
        <tbody>
          <tr data-activity-row="t1">
            <td>
              <button type="button">Task one</button>
            </td>
          </tr>
          <tr data-activity-row="t2">
            <td>
              <button type="button">Task two</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p>Elsewhere</p>
      <ActivityPopup
        anchorId="t1"
        anchorX={300}
        label="Task one - update"
        onClose={onClose}
        {...props}
      >
        <button type="button">Inside</button>
      </ActivityPopup>
    </div>,
  );
  return { onClose };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete window.matchMedia;
});

describe("ActivityPopup", () => {
  it("is a dialog on the page body, so a table cannot clip it", () => {
    renderPopup();

    const dialog = screen.getByRole("dialog", {
      name: "Task one - update",
    });
    expect(dialog.parentElement).toBe(document.body);
    expect(screen.getByText("Inside")).toBeInTheDocument();
  });

  it("takes focus when it opens", () => {
    renderPopup();

    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("is placed beside its row using the row's position", () => {
    vi.spyOn(
      HTMLElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({
      top: 100,
      bottom: 140,
      left: 50,
      right: 900,
      width: 850,
      height: 40,
    });
    renderPopup();

    const { top, left } = screen.getByRole("dialog").style;
    expect(top).toBe("146px");
    expect(left).toBe("260px");
  });

  it("becomes a bottom sheet on a narrow screen", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    renderPopup();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("pm-popup--sheet");
    expect(dialog.style.top).toBe("");
  });

  it("closes on Escape", () => {
    const { onClose } = renderPopup();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a press outside it", () => {
    const { onClose } = renderPopup();

    fireEvent.mouseDown(screen.getByText("Elsewhere"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on a press inside it", () => {
    const { onClose } = renderPopup();

    fireEvent.mouseDown(screen.getByText("Inside"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("leaves a press on a task row to that row", () => {
    const { onClose } = renderPopup();

    fireEvent.mouseDown(screen.getByText("Task two"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("stops listening once it is gone", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <ActivityPopup
        anchorId="t1"
        label="x"
        onClose={onClose}
      >
        <span>Body</span>
      </ActivityPopup>,
    );

    unmount();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(document.body);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses the width it is given", () => {
    vi.spyOn(
      HTMLElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({
      top: 100,
      bottom: 140,
      left: 50,
      right: 900,
      width: 850,
      height: 40,
    });
    renderPopup({ width: 680 });

    expect(screen.getByRole("dialog").style.width).toBe("680px");
  });

  it("can be attached to an icon button instead of a row", () => {
    vi.spyOn(
      HTMLElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({
      top: 200,
      bottom: 230,
      left: 700,
      right: 730,
      width: 30,
      height: 30,
    });
    render(
      <div>
        <button type="button" data-popup-anchor="history:t1">
          History
        </button>
        <ActivityPopup
          anchorId="history:t1"
          label="History"
          onClose={vi.fn()}
        >
          <span>Body</span>
        </ActivityPopup>
      </div>,
    );

    expect(screen.getByRole("dialog").style.top).toBe("236px");
  });

  it("leaves a press on an icon button to that button", () => {
    const onClose = vi.fn();
    render(
      <div>
        <button type="button" data-popup-anchor="review:t1">
          Review
        </button>
        <ActivityPopup
          anchorId="history:t1"
          label="History"
          onClose={onClose}
        >
          <span>Body</span>
        </ActivityPopup>
      </div>,
    );

    fireEvent.mouseDown(screen.getByText("Review"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("returns focus to its icon button when closed with Escape", () => {
    render(
      <div>
        <button type="button" data-popup-anchor="history:t1">
          History
        </button>
        <ActivityPopup
          anchorId="history:t1"
          label="History"
          onClose={vi.fn()}
        >
          <span>Body</span>
        </ActivityPopup>
      </div>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByText("History")).toHaveFocus();
  });
});
