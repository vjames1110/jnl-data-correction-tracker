import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DprMeasurementSheet } from "./DprMeasurementSheet";

const hooks = vi.hoisted(() => ({
  sheet: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useDprMeasurements: () => hooks.sheet(),
  useSaveDprMeasurements: () => ({
    mutateAsync: hooks.save,
    isPending: false,
  }),
}));

const ITEM = {
  id: "item-1",
  item_no: "4.1",
  description: "Retaining wall",
};

const SAVED = [
  {
    item: "item-1",
    date: "2026-09-19",
    total: "8.000",
    lines: [
      {
        description: "Wall A",
        nos: "2.000",
        length: "5.000",
        breadth: null,
        depth: null,
        is_deduction: false,
      },
      {
        description: "Door",
        nos: "1.000",
        length: "1.000",
        breadth: "2.000",
        depth: null,
        is_deduction: true,
      },
    ],
  },
];

function renderSheet(props = {}) {
  const handlers = {
    onUseTotal: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <DprMeasurementSheet
      siteId="site-1"
      item={ITEM}
      date="2026-09-19"
      entered="8"
      editable
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

beforeEach(() => {
  hooks.sheet.mockReturnValue({ data: SAVED, isLoading: false });
  hooks.save.mockReset().mockResolvedValue({ lines: [] });
});

describe("DprMeasurementSheet", () => {
  it("shows the saved lines, their total and the comparison", () => {
    renderSheet();

    expect(
      screen.getByText(/Measurement - 4.1 Retaining wall/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Line 1 description")).toHaveValue(
      "Wall A",
    );
    expect(screen.getByLabelText("Line 2 deduct")).toBeChecked();
    // 2 x 5 = 10, less a 1 x 1 x 2 opening = 8
    expect(screen.getByText("Measured total").nextSibling).toHaveTextContent(
      "8",
    );
    expect(
      screen.getByText("Matches the 8 entered"),
    ).toBeInTheDocument();
  });

  it("says how far the measurement is from the quantity entered", () => {
    renderSheet({ entered: "10" });
    expect(
      screen.getByText("Measured 8 of 10 entered"),
    ).toBeInTheDocument();
  });

  it("flags a measurement over the quantity entered", () => {
    renderSheet({ entered: "6" });
    expect(
      screen.getByText("Measured 8 - 2 more than the 6 entered"),
    ).toBeInTheDocument();
  });

  it("flags a measurement with no quantity entered yet", () => {
    renderSheet({ entered: "" });
    expect(
      screen.getByText("Measured 8 - no quantity entered yet"),
    ).toBeInTheDocument();
  });

  it("updates the total as lines change", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(
      screen.getByRole("button", { name: /add line/i }),
    );
    await user.type(screen.getByLabelText("Line 3 L"), "4.5");

    expect(screen.getByText("Measured total").nextSibling).toHaveTextContent(
      "12.5",
    );
    expect(
      screen.getByText("Measured 12.5 - 4.5 more than the 8 entered"),
    ).toBeInTheDocument();
  });

  it("offers the measured total for the cell", async () => {
    const user = userEvent.setup();
    const { onUseTotal } = renderSheet({ entered: "" });

    await user.click(
      screen.getByRole("button", { name: "Use measured total" }),
    );

    expect(onUseTotal).toHaveBeenCalledWith(8);
  });

  it("saves the lines for the item and day, blanks as null", async () => {
    const user = userEvent.setup();
    hooks.sheet.mockReturnValue({ data: [], isLoading: false });
    renderSheet();

    expect(
      screen.getByRole("button", { name: "Save measurement" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: /add line/i }),
    );
    await user.type(
      screen.getByLabelText("Line 1 description"),
      "Pier P1",
    );
    await user.type(screen.getByLabelText("Line 1 Nos"), "2");
    await user.type(screen.getByLabelText("Line 1 L"), "3.5");
    // A second line left completely blank is not sent.
    await user.click(
      screen.getByRole("button", { name: /add line/i }),
    );
    await user.click(
      screen.getByRole("button", { name: "Save measurement" }),
    );

    expect(hooks.save).toHaveBeenCalledWith({
      site: "site-1",
      item: "item-1",
      date: "2026-09-19",
      lines: [
        {
          description: "Pier P1",
          nos: "2",
          length: "3.5",
          breadth: null,
          depth: null,
          is_deduction: false,
        },
      ],
    });
    expect(
      await screen.findByText("Measurement saved."),
    ).toBeInTheDocument();
  });

  it("will not save a line with nothing measured", async () => {
    const user = userEvent.setup();
    hooks.sheet.mockReturnValue({ data: [], isLoading: false });
    renderSheet();

    await user.click(
      screen.getByRole("button", { name: /add line/i }),
    );
    await user.type(
      screen.getByLabelText("Line 1 description"),
      "Somewhere",
    );
    await user.click(
      screen.getByRole("button", { name: "Save measurement" }),
    );

    expect(hooks.save).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Line 1: give the Nos or at least one/),
    ).toBeInTheDocument();
  });

  it("shows the server's message when saving fails", async () => {
    const user = userEvent.setup();
    hooks.save.mockRejectedValue({
      response: {
        data: { errors: { date: "17-09-2026 is locked." } },
      },
    });
    renderSheet();

    await user.type(screen.getByLabelText("Line 1 L"), "9");
    await user.click(
      screen.getByRole("button", { name: "Save measurement" }),
    );

    expect(
      await screen.findByText(/17-09-2026 is locked/),
    ).toBeInTheDocument();
  });

  it("is read-only on a locked day", () => {
    renderSheet({ editable: false });

    expect(screen.getByLabelText("Line 1 description")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Save measurement" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add line/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Use measured total" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it("closes", async () => {
    const user = userEvent.setup();
    const { onClose } = renderSheet();

    await user.click(
      screen.getByRole("button", { name: "Close measurement" }),
    );

    expect(onClose).toHaveBeenCalled();
  });

  it("says when it is loading or fails to load", () => {
    hooks.sheet.mockReturnValue({ isLoading: true });
    const { unmount } = render(
      <DprMeasurementSheet
        siteId="s"
        item={ITEM}
        date="2026-09-19"
        entered=""
        editable
        onUseTotal={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/loading measurement/i),
    ).toBeInTheDocument();
    unmount();

    hooks.sheet.mockReturnValue({
      isLoading: false,
      isError: true,
      error: { message: "Boom" },
    });
    render(
      <DprMeasurementSheet
        siteId="s"
        item={ITEM}
        date="2026-09-19"
        entered=""
        editable
        onUseTotal={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});
