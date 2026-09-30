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

import { LinearItemPanel } from "./LinearItemPanel";

const hooks = vi.hoisted(() => ({
  diagram: vi.fn(),
}));

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useLinearItemDiagram: (...args) =>
    hooks.diagram(...args),
}));

function buildDiagram(overrides = {}) {
  return {
    chainage_start_km: "0.000",
    chainage_end_km: "0.100",
    segment_length_km: "0.100",
    segments: [
      {
        from_chainage_km: "0.000",
        to_chainage_km: "0.100",
      },
    ],
    sides: {
      BOTH: {
        planned_length_km: "0.100",
        done_length_km: 0,
        progress_percent: null,
        cells: [
          {
            planned: [[0, 1]],
            done: [],
            ongoing: [],
            hold: [],
          },
        ],
      },
    },
    ...overrides,
  };
}

const NOS_ITEM = {
  id: "item-1",
  name: "Trolley refuges",
  unit: "NOS",
  scope_patches: [],
  progress_entries: [],
  stats: { scope: 5, done: 1, ongoing: 1, pending: 3 },
  diagram: buildDiagram(),
};

describe("LinearItemPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.diagram.mockReturnValue({
      data: undefined,
      isFetching: false,
    });
  });

  it("renders the rolling diagram for a non-M unit too", () => {
    render(
      <LinearItemPanel
        item={NOS_ITEM}
        isExpanded
        onToggle={vi.fn()}
        canEdit
        onAddScopePatch={vi.fn()}
        onAddProgressEntry={vi.fn()}
        onDeleteItem={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Start chainage"),
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("shows nothing under the header until expanded", () => {
    render(
      <LinearItemPanel
        item={NOS_ITEM}
        isExpanded={false}
        onToggle={vi.fn()}
        canEdit
        onAddScopePatch={vi.fn()}
        onAddProgressEntry={vi.fn()}
        onDeleteItem={vi.fn()}
      />,
    );

    expect(screen.queryByRole("table")).toBeNull();
  });

  it("switches to the override diagram once the user applies a new segment length", () => {
    const overrideDiagram = buildDiagram({
      segment_length_km: "0.050",
      segments: [
        {
          from_chainage_km: "0.000",
          to_chainage_km: "0.050",
        },
        {
          from_chainage_km: "0.050",
          to_chainage_km: "0.100",
        },
      ],
    });
    hooks.diagram.mockImplementation((itemId, range) => ({
      data: range
        ? {
            diagram: overrideDiagram,
            scope_patches: [],
            progress_entries: [],
          }
        : undefined,
      isFetching: false,
    }));

    render(
      <LinearItemPanel
        item={NOS_ITEM}
        isExpanded
        onToggle={vi.fn()}
        canEdit
        onAddScopePatch={vi.fn()}
        onAddProgressEntry={vi.fn()}
        onDeleteItem={vi.fn()}
      />,
    );

    // Starts on the base (single-segment) diagram.
    expect(
      screen.getAllByRole("columnheader"),
    ).toHaveLength(6); // Side/From/To/Extent/Progress + 1 segment

    fireEvent.change(
      screen.getByLabelText("Segment length (m)"),
      { target: { value: "50" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Apply" }),
    );

    expect(hooks.diagram).toHaveBeenLastCalledWith(
      "item-1",
      {
        chainageStartKm: 0,
        chainageEndKm: 0.1,
        segmentLengthKm: 0.05,
      },
    );
    // Now shows the override's two-segment diagram.
    expect(
      screen.getAllByRole("columnheader"),
    ).toHaveLength(7);
  });

  it("shows the item's own stats line in its own unit", () => {
    render(
      <LinearItemPanel
        item={NOS_ITEM}
        isExpanded
        onToggle={vi.fn()}
        canEdit
        onAddScopePatch={vi.fn()}
        onAddProgressEntry={vi.fn()}
        onDeleteItem={vi.fn()}
      />,
    );

    const header = screen
      .getByText("Trolley refuges")
      .closest(".pm-linear-item__header");
    expect(
      within(header).getByText(/Scope 5 nos/),
    ).toBeInTheDocument();
  });

  it("hides the add-forms and delete icon without edit access", () => {
    render(
      <LinearItemPanel
        item={NOS_ITEM}
        isExpanded
        onToggle={vi.fn()}
        canEdit={false}
        onAddScopePatch={vi.fn()}
        onAddProgressEntry={vi.fn()}
        onDeleteItem={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: /Add scope patch/,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /Log progress/,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Delete linear item",
      }),
    ).toBeNull();
  });

  it("deletes the item without toggling the accordion", () => {
    const onToggle = vi.fn();
    const onDeleteItem = vi.fn();
    render(
      <LinearItemPanel
        item={NOS_ITEM}
        isExpanded
        onToggle={onToggle}
        canEdit
        onAddScopePatch={vi.fn()}
        onAddProgressEntry={vi.fn()}
        onDeleteItem={onDeleteItem}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete linear item",
      }),
    );

    expect(onDeleteItem).toHaveBeenCalledWith("item-1");
    expect(onToggle).not.toHaveBeenCalled();
  });
});
