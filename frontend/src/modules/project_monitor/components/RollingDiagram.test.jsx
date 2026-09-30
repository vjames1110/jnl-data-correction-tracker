import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RollingDiagram } from "./RollingDiagram";

const DIAGRAM_BOTH = {
  chainage_start_km: "0.000",
  chainage_end_km: "0.300",
  segment_length_km: "0.100",
  segments: [
    {
      from_chainage_km: "0.000",
      to_chainage_km: "0.100",
    },
    {
      from_chainage_km: "0.100",
      to_chainage_km: "0.200",
    },
    {
      from_chainage_km: "0.200",
      to_chainage_km: "0.300",
    },
  ],
  sides: {
    BOTH: {
      planned_length_km: "0.300",
      done_length_km: "0.100",
      progress_percent: 33.3,
      cells: [
        {
          planned: [[0, 1]],
          done: [[0, 1]],
          ongoing: [],
          hold: [],
        },
        {
          planned: [[0, 1]],
          done: [],
          ongoing: [[0, 1]],
          hold: [],
        },
        {
          planned: [[0, 1]],
          done: [],
          ongoing: [],
          hold: [],
        },
      ],
    },
  },
};

const SCOPE_PATCHES = [
  {
    id: "p1",
    from_chainage_km: "0.000",
    to_chainage_km: "0.300",
    side: "BOTH",
    remarks: "",
  },
];

const PROGRESS_ENTRIES = [
  {
    id: "e1",
    date: "2026-01-05",
    from_chainage_km: "0.000",
    to_chainage_km: "0.100",
    side: "BOTH",
    status: "COMPLETE",
    contractor: "ABC Contractors",
    remarks: "",
  },
  {
    id: "e2",
    date: "2026-01-06",
    from_chainage_km: "0.100",
    to_chainage_km: "0.200",
    side: "BOTH",
    status: "IN_PROGRESS",
    contractor: "",
    remarks: "",
  },
];

const DIAGRAM_SPLIT = {
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
    LHS: {
      planned_length_km: "0.100",
      done_length_km: "0.100",
      progress_percent: 100,
      cells: [
        {
          planned: [[0, 1]],
          done: [[0, 1]],
          ongoing: [],
          hold: [],
        },
      ],
    },
    RHS: {
      planned_length_km: 0,
      done_length_km: 0,
      progress_percent: null,
      cells: [
        { planned: [], done: [], ongoing: [], hold: [] },
      ],
    },
  },
};

describe("RollingDiagram", () => {
  it("shows the start and end chainage as editable fields in railway '0+000' style", () => {
    render(
      <RollingDiagram
        diagram={DIAGRAM_BOTH}
        scopePatches={[]}
        progressEntries={[]}
        onApplyRange={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText("Start chainage"),
    ).toHaveValue("0+000");
    expect(
      screen.getByLabelText("End chainage"),
    ).toHaveValue("0+300");
  });

  it("renders one Planned/Executed row-pair when the item never uses sides", () => {
    render(
      <RollingDiagram
        diagram={DIAGRAM_BOTH}
        scopePatches={[]}
        progressEntries={[]}
        onApplyRange={vi.fn()}
      />,
    );

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("cell", { name: "Planned" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "Executed" }),
    ).toBeInTheDocument();
    expect(within(table).queryByText(/LHS/)).toBeNull();
  });

  it("splits into LHS/RHS rows when the item uses sides", () => {
    render(
      <RollingDiagram
        diagram={DIAGRAM_SPLIT}
        scopePatches={[]}
        progressEntries={[]}
        onApplyRange={vi.fn()}
      />,
    );

    expect(
      screen.getByText("LHS – Planned"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("RHS – Executed"),
    ).toBeInTheDocument();
  });

  it("renders one column header per chainage segment", () => {
    render(
      <RollingDiagram
        diagram={DIAGRAM_BOTH}
        scopePatches={[]}
        progressEntries={[]}
        onApplyRange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("columnheader", { name: "0+000" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "0+200" }),
    ).toBeInTheDocument();
  });

  it("paints a partially-covered cell at its exact position, not flush to the edge", () => {
    const diagram = {
      ...DIAGRAM_BOTH,
      sides: {
        BOTH: {
          ...DIAGRAM_BOTH.sides.BOTH,
          cells: [
            {
              planned: [[0, 1]],
              done: [[0.4, 0.9]],
              ongoing: [],
              hold: [],
            },
            DIAGRAM_BOTH.sides.BOTH.cells[1],
            DIAGRAM_BOTH.sides.BOTH.cells[2],
          ],
        },
      },
    };
    render(
      <RollingDiagram
        diagram={diagram}
        scopePatches={[]}
        progressEntries={[]}
        onApplyRange={vi.fn()}
      />,
    );

    const executedRow = screen
      .getByRole("cell", { name: "Executed" })
      .closest("tr");
    const firstDataCell = within(executedRow)
      .getAllByRole("cell")[5];
    expect(firstDataCell.style.background).toContain(
      "transparent 0%, transparent 40%",
    );
    expect(firstDataCell.style.background).toContain(
      "var(--pm-rd-done) 40%, var(--pm-rd-done) 90%",
    );
  });

  it("leaves an untouched cell with no background at all", () => {
    render(
      <RollingDiagram
        diagram={DIAGRAM_BOTH}
        scopePatches={SCOPE_PATCHES}
        progressEntries={PROGRESS_ENTRIES}
        onApplyRange={vi.fn()}
      />,
    );

    const nothingCell = screen.getByTitle(
      "0+200 - 0+300: nothing logged",
    );
    expect(nothingCell.style.background).toBe("");
  });

  it("shows the real logged entries for a segment on hover, not just a percentage", () => {
    render(
      <RollingDiagram
        diagram={DIAGRAM_BOTH}
        scopePatches={SCOPE_PATCHES}
        progressEntries={PROGRESS_ENTRIES}
        onApplyRange={vi.fn()}
      />,
    );

    expect(
      screen.getByTitle(
        "0+000 - 0+100 05-01-2026 - Complete - 0+000-0+100 - ABC Contractors",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByTitle(
        "0+100 - 0+200 06-01-2026 - In Progress - 0+100-0+200",
      ),
    ).toBeInTheDocument();
  });

  it("shows the scope patch on hover for the Planned row", () => {
    render(
      <RollingDiagram
        diagram={DIAGRAM_BOTH}
        scopePatches={SCOPE_PATCHES}
        progressEntries={[]}
        onApplyRange={vi.fn()}
      />,
    );

    expect(
      screen.getByTitle("0+000 - 0+100 Scope 0+000-0+300"),
    ).toBeInTheDocument();
  });

  it("shows Progress % only on the Executed row", () => {
    render(
      <RollingDiagram
        diagram={DIAGRAM_BOTH}
        scopePatches={[]}
        progressEntries={[]}
        onApplyRange={vi.fn()}
      />,
    );

    expect(screen.getByText("33.3%")).toBeInTheDocument();
  });

  it("applies a custom chainage range and segment length together", () => {
    const onApplyRange = vi.fn();
    render(
      <RollingDiagram
        diagram={DIAGRAM_BOTH}
        scopePatches={[]}
        progressEntries={[]}
        onApplyRange={onApplyRange}
      />,
    );

    fireEvent.change(
      screen.getByLabelText("Start chainage"),
      { target: { value: "101+000" } },
    );
    fireEvent.change(
      screen.getByLabelText("End chainage"),
      { target: { value: "200+000" } },
    );
    fireEvent.change(
      screen.getByLabelText("Segment length (m)"),
      { target: { value: "10000" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Apply" }),
    );

    expect(onApplyRange).toHaveBeenCalledWith({
      chainageStartKm: 101,
      chainageEndKm: 200,
      segmentLengthKm: 10,
    });
  });

  it("also accepts a plain metre number for chainage, without the '+' notation", () => {
    const onApplyRange = vi.fn();
    render(
      <RollingDiagram
        diagram={DIAGRAM_BOTH}
        scopePatches={[]}
        progressEntries={[]}
        onApplyRange={onApplyRange}
      />,
    );

    fireEvent.change(
      screen.getByLabelText("Start chainage"),
      { target: { value: "0" } },
    );
    fireEvent.change(
      screen.getByLabelText("End chainage"),
      { target: { value: "50000" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Apply" }),
    );

    expect(onApplyRange).toHaveBeenCalledWith(
      expect.objectContaining({
        chainageStartKm: 0,
        chainageEndKm: 50,
      }),
    );
  });

  it("ignores a submit where end is not after start", () => {
    const onApplyRange = vi.fn();
    render(
      <RollingDiagram
        diagram={DIAGRAM_BOTH}
        scopePatches={[]}
        progressEntries={[]}
        onApplyRange={onApplyRange}
      />,
    );

    fireEvent.change(
      screen.getByLabelText("Start chainage"),
      { target: { value: "200+000" } },
    );
    fireEvent.change(
      screen.getByLabelText("End chainage"),
      { target: { value: "100+000" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Apply" }),
    );

    expect(onApplyRange).not.toHaveBeenCalled();
  });

  it("re-syncs the fields when a fresh (possibly widened) diagram arrives", () => {
    const { rerender } = render(
      <RollingDiagram
        diagram={DIAGRAM_BOTH}
        scopePatches={[]}
        progressEntries={[]}
        onApplyRange={vi.fn()}
      />,
    );

    const widened = {
      ...DIAGRAM_BOTH,
      chainage_end_km: "0.500",
    };
    rerender(
      <RollingDiagram
        diagram={widened}
        scopePatches={[]}
        progressEntries={[]}
        onApplyRange={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText("End chainage"),
    ).toHaveValue("0+500");
  });
});
