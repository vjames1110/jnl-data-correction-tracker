import { describe, expect, it } from "vitest";

import { row } from "../components/workspaceFixtures";
import {
  buildMatrix,
  cellDetail,
  cellProgress,
  tableProgress,
} from "./activityMatrix";

function group(order, title, rows, subtitle = "") {
  return {
    group_order: order,
    group_title: title,
    group_subtitle: subtitle,
    rows,
  };
}

const names = (table) => table.columns.map((column) => column.label);
const cellIds = (line) =>
  line.cells.map((cell) => cell?.id ?? null);

describe("buildMatrix: one row per group", () => {
  it("lays a group out as one row with a column per task", () => {
    const tables = buildMatrix([
      group(1, "Box structure", [
        row("r1", "Box raft"),
        row("r2", "Box wall"),
      ]),
    ]);

    expect(tables).toHaveLength(1);
    expect(names(tables[0])).toEqual(["Box raft", "Box wall"]);
    expect(tables[0].title).toBe("Box structure");
    expect(tables[0].lines).toHaveLength(1);
    expect(tables[0].lines[0].label).toBe("Box structure");
    expect(cellIds(tables[0].lines[0])).toEqual(["r1", "r2"]);
  });

  it("keeps the group subtitle beside the row heading", () => {
    const [table] = buildMatrix([
      group(1, "Abutment A1", [row("r1", "Pile")], "Height 6 m"),
    ]);

    expect(table.lines[0].sublabel).toBe("Height 6 m");
  });

  it("keeps groups with different tasks in separate tables", () => {
    const tables = buildMatrix([
      group(0, "Approvals", [row("a1", "GAD approval")]),
      group(1, "Box structure", [row("b1", "Box raft")]),
    ]);

    expect(tables).toHaveLength(2);
  });

  it("skips a group with no rows and copes with no groups at all", () => {
    expect(buildMatrix([])).toEqual([]);
    expect(buildMatrix(undefined)).toEqual([]);
    expect(
      buildMatrix([group(0, "Empty", [])]),
    ).toEqual([]);
  });
});

describe("buildMatrix: groups with the same tasks stack as rows", () => {
  const pier = (n) =>
    group(n, `Pier P${n}`, [
      row(`p${n}a`, "Pile"),
      row(`p${n}b`, "Stem"),
    ]);

  it("puts Pier P1, P2, P3 into one table, one row each", () => {
    const [table] = buildMatrix([pier(1), pier(2), pier(3)]);

    expect(table.lines.map((line) => line.label)).toEqual([
      "Pier P1",
      "Pier P2",
      "Pier P3",
    ]);
    expect(names(table)).toEqual(["Pile", "Stem"]);
  });

  it("titles a numbered series in the plural", () => {
    const [table] = buildMatrix([pier(1), pier(2)]);

    expect(table.title).toBe("Piers");
  });

  it("does not stack groups that only sit next to each other", () => {
    const tables = buildMatrix([
      pier(1),
      group(5, "Abutment A1", [row("x", "Pile"), row("y", "Cap")]),
      pier(2),
    ]);

    expect(tables).toHaveLength(3);
  });

  it("titles floors that are not a numbered series by their own names", () => {
    const floor = (order, title) =>
      group(order, title, [
        row(`${order}a`, "Slab"),
        row(`${order}b`, "Brickwork"),
      ]);
    const [table] = buildMatrix([
      floor(1, "Ground Floor"),
      floor(2, "1st Floor"),
    ]);

    expect(table.lines).toHaveLength(2);
    expect(table.title).toBe("Ground Floor · 1st Floor");
  });

  it("names a long run of unnumbered rows by its first and last", () => {
    const floor = (order, title) =>
      group(order, title, [row(`${order}a`, "Slab")]);
    const [table] = buildMatrix([
      floor(1, "Ground Floor"),
      floor(2, "First Floor"),
      floor(3, "Terrace"),
    ]);

    expect(table.title).toBe("Ground Floor – Terrace");
  });
});

describe("buildMatrix: rows that repeat per span", () => {
  const SPANS = group(
    9,
    "Superstructure (span-wise)",
    [
      row("s1a", "S1 – Bearings"),
      row("s1b", "S1 – Girder fabrication"),
      row("s2a", "S2 – Bearings"),
      row("s2b", "S2 – Girder fabrication"),
      row("s3a", "S3 - Bearings"),
      row("s3b", "S3 - Girder fabrication"),
    ],
    "3 span(s)",
  );

  it("becomes a row per span and a column per task", () => {
    const [table] = buildMatrix([SPANS]);

    expect(table.lines.map((line) => line.label)).toEqual([
      "S1",
      "S2",
      "S3",
    ]);
    expect(names(table)).toEqual(["Bearings", "Girder fabrication"]);
    expect(cellIds(table.lines[1])).toEqual(["s2a", "s2b"]);
    expect(table.title).toBe("Superstructure (span-wise)");
    expect(table.subcaption).toBe("3 span(s)");
  });

  it("leaves a gap where a span has no such task", () => {
    const [table] = buildMatrix([
      group(1, "Spans", [
        row("a", "S1 - Bearings"),
        row("b", "S1 - Deck"),
        row("c", "S2 - Bearings"),
      ]),
    ]);

    expect(cellIds(table.lines[1])).toEqual(["c", null]);
  });

  it("gives a task named twice in one span a column of its own", () => {
    const [table] = buildMatrix([
      group(1, "Spans", [
        row("a", "S1 - Check"),
        row("b", "S1 - Check"),
        row("c", "S2 - Check"),
      ]),
    ]);

    expect(names(table)).toEqual(["Check", "Check"]);
    expect(cellIds(table.lines[0])).toEqual(["a", "b"]);
    expect(cellIds(table.lines[1])).toEqual(["c", null]);
  });

  it("leaves a group with a single span as an ordinary row", () => {
    const [table] = buildMatrix([
      group(1, "One span", [
        row("a", "S1 - Bearings"),
        row("b", "S1 - Deck"),
      ]),
    ]);

    expect(table.lines).toHaveLength(1);
    expect(names(table)).toEqual(["S1 - Bearings", "S1 - Deck"]);
  });

  it("does not pivot a group that mixes span rows with other rows", () => {
    const [table] = buildMatrix([
      group(1, "Mixed", [
        row("a", "S1 - Bearings"),
        row("b", "Approval"),
        row("c", "S2 - Bearings"),
      ]),
    ]);

    expect(table.lines).toHaveLength(1);
  });
});

describe("tableProgress", () => {
  it("counts the completed tasks of those that apply", () => {
    const [table] = buildMatrix([
      group(1, "Box", [
        row("a", "Raft", "COMPLETE"),
        row("b", "Wall", "IN_PROGRESS"),
        row("c", "Apron", "NOT_APPLICABLE"),
        row("d", "Slab", "NOT_STARTED"),
      ]),
    ]);

    expect(tableProgress(table)).toEqual({ done: 1, total: 3 });
  });

  it("counts across every row of a stacked table and skips gaps", () => {
    const [table] = buildMatrix([
      group(1, "Spans", [
        row("a", "S1 - Bearings", "COMPLETE"),
        row("b", "S1 - Deck", "COMPLETE"),
        row("c", "S2 - Bearings", "NOT_STARTED"),
      ]),
    ]);

    expect(tableProgress(table)).toEqual({ done: 2, total: 3 });
  });
});

describe("cellDetail", () => {
  it("says nothing extra for a task that is not applicable", () => {
    expect(
      cellDetail(row("x", "Apron", "NOT_APPLICABLE")),
    ).toBe("");
  });

  it("shows how far along an in-progress task is", () => {
    expect(
      cellDetail(
        row("x", "Slab", "IN_PROGRESS", { done_qty: "40" }),
      ),
    ).toBe("40%");
    expect(
      cellDetail(
        row("x", "Filling", "IN_PROGRESS", {
          kind: "LENGTH",
          done_qty: "30",
          total_qty: "120",
          unit: "m",
        }),
      ),
    ).toBe("30/120 m");
  });

  it("shows the date of a submitted document, not a percentage", () => {
    expect(
      cellDetail(
        row("x", "GAD", "IN_PROGRESS", {
          is_doc: true,
          current_target_date: "2026-10-05",
        }),
      ),
    ).toBe("05-10-2026");
  });

  it("shows when a completed task was finished", () => {
    expect(
      cellDetail(
        row("x", "Raft", "COMPLETE", { completed_on: "2026-09-01" }),
      ),
    ).toBe("01-09-2026");
    expect(cellDetail(row("x", "Raft", "COMPLETE"))).toBe("");
  });

  it("shows the due date of a task not yet taken up", () => {
    expect(
      cellDetail(
        row("x", "Raft", "NOT_STARTED", {
          current_target_date: "2026-11-15",
        }),
      ),
    ).toBe("Due 15-11-2026");
    expect(cellDetail(row("x", "Raft", "NOT_STARTED"))).toBe("");
  });
});

describe("cellProgress", () => {
  it("is the percentage of an in-progress task", () => {
    expect(
      cellProgress(
        row("x", "Slab", "IN_PROGRESS", { done_qty: "62.4" }),
      ),
    ).toBe(62);
  });

  it("is zero for anything else", () => {
    expect(cellProgress(row("x", "Slab", "COMPLETE"))).toBe(0);
    expect(cellProgress(row("x", "Slab", "NOT_STARTED"))).toBe(0);
    expect(
      cellProgress(
        row("x", "GAD", "IN_PROGRESS", { is_doc: true }),
      ),
    ).toBe(0);
  });
});
