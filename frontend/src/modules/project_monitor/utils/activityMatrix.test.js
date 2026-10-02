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

describe("buildMatrix: a nested_repeat structure (ESP A/B/C, each with PC-01/02/03)", () => {
  // The backend's "nested_repeat" group kind generates one ordinary
  // group per outer unit (ESP A, ESP B, ESP C), each with its rows
  // prefixed by the inner unit's label (PC-01, PC-02, ...) - the same
  // row-prefixing "chain" already does for spans, just inside an
  // outer loop. No new frontend logic should be needed: each ESP
  // group independently qualifies as its own per-sub-unit pivot.
  const esp = (letter, pcCount) =>
    group(
      letter.charCodeAt(0),
      `ESP ${letter}`,
      Array.from({ length: pcCount }, (_, i) => i + 1).flatMap(
        (n) => [
          row(`${letter}${n}a`, `PC-0${n} – Foundation`),
          row(`${letter}${n}b`, `PC-0${n} – Casting`),
        ],
      ),
    );

  it("gives each ESP unit its own separate table, not one merged across units", () => {
    const tables = buildMatrix([esp("A", 2), esp("B", 2)]);

    expect(tables).toHaveLength(2);
    expect(tables[0].title).toBe("ESP A");
    expect(tables[1].title).toBe("ESP B");
  });

  it("pivots each ESP's rows into a PC-row x task-column table", () => {
    const [table] = buildMatrix([esp("A", 3)]);

    expect(table.lines.map((line) => line.label)).toEqual([
      "PC-01",
      "PC-02",
      "PC-03",
    ]);
    expect(names(table)).toEqual(["Foundation", "Casting"]);
    expect(cellIds(table.lines[1])).toEqual(["A2a", "A2b"]);
  });
});

describe("buildMatrix: a hand-added activity never disturbs its siblings (bug fix)", () => {
  const pier = (n, extraRows = []) =>
    group(n, `Pier P${n}`, [
      row(`p${n}a`, "Pile"),
      row(`p${n}b`, "Stem"),
      ...extraRows,
    ]);

  it("keeps Piers stacked as one table when one pier gets a custom row", () => {
    const tables = buildMatrix([
      pier(1),
      pier(2, [row("extra", "Extra check", "NOT_STARTED", { is_custom: true })]),
      pier(3),
    ]);

    expect(tables).toHaveLength(1);
    expect(tables[0].lines.map((line) => line.label)).toEqual([
      "Pier P1",
      "Pier P2",
      "Pier P3",
    ]);
  });

  it("gives the custom row its own column, blank for every other pier", () => {
    const [table] = buildMatrix([
      pier(1),
      pier(2, [row("extra", "Extra check", "NOT_STARTED", { is_custom: true })]),
      pier(3),
    ]);

    expect(names(table)).toEqual(["Pile", "Stem", "Extra check"]);
    expect(cellIds(table.lines[0])).toEqual(["p1a", "p1b", null]);
    expect(cellIds(table.lines[1])).toEqual(["p2a", "p2b", "extra"]);
    expect(cellIds(table.lines[2])).toEqual(["p3a", "p3b", null]);
  });

  it("never lets a custom row's own table key or title drift onto a sibling", () => {
    const withoutExtra = buildMatrix([pier(1), pier(2), pier(3)]);
    const withExtra = buildMatrix([
      pier(1),
      pier(2, [row("extra", "Extra check", "NOT_STARTED", { is_custom: true })]),
      pier(3),
    ]);

    expect(withExtra[0].key).toBe(withoutExtra[0].key);
    expect(withExtra[0].title).toBe(withoutExtra[0].title);
  });

  it("merges two differently-named custom rows on two different piers as two extra columns", () => {
    const [table] = buildMatrix([
      pier(1, [row("e1", "Rebar check", "NOT_STARTED", { is_custom: true })]),
      pier(2, [row("e2", "Survey", "NOT_STARTED", { is_custom: true })]),
    ]);

    expect(names(table)).toEqual(["Pile", "Stem", "Rebar check", "Survey"]);
    expect(cellIds(table.lines[0])).toEqual(["p1a", "p1b", "e1", null]);
    expect(cellIds(table.lines[1])).toEqual(["p2a", "p2b", null, "e2"]);
  });

  it("shares one column when two piers add a custom row with the exact same name", () => {
    const [table] = buildMatrix([
      pier(1, [row("e1", "Rebar check", "NOT_STARTED", { is_custom: true })]),
      pier(2, [row("e2", "Rebar check", "NOT_STARTED", { is_custom: true })]),
    ]);

    expect(names(table)).toEqual(["Pile", "Stem", "Rebar check"]);
    expect(cellIds(table.lines[0])).toEqual(["p1a", "p1b", "e1"]);
    expect(cellIds(table.lines[1])).toEqual(["p2a", "p2b", "e2"]);
  });

  it("keeps a single-span pivot intact when a span-named custom row is added", () => {
    const spans = group(1, "Spans", [
      row("s1a", "S1 - Bearings"),
      row("s2a", "S2 - Bearings"),
      row("extra", "S2 - Extra check", "NOT_STARTED", { is_custom: true }),
    ]);
    const [table] = buildMatrix([spans]);

    expect(table.lines.map((line) => line.label)).toEqual(["S1", "S2"]);
    expect(names(table)).toEqual(["Bearings", "Extra check"]);
    expect(cellIds(table.lines[0])).toEqual(["s1a", null]);
    expect(cellIds(table.lines[1])).toEqual(["s2a", "extra"]);
  });

  it("does not collapse the whole per-span pivot when a custom row's name doesn't fit the pattern", () => {
    const spans = group(1, "Spans", [
      row("s1a", "S1 - Bearings"),
      row("s2a", "S2 - Bearings"),
      row("extra", "General check", "NOT_STARTED", { is_custom: true }),
    ]);
    const tables = buildMatrix([spans]);

    const pivot = tables.find((table) => table.title === "Spans");
    expect(pivot.lines.map((line) => line.label)).toEqual(["S1", "S2"]);
    expect(names(pivot)).toEqual(["Bearings"]);
    // The row that doesn't fit the per-span grid gets its own small
    // table instead of being dropped or breaking the grid for S1/S2.
    expect(tables).toHaveLength(2);
    expect(cellIds(tables[1].lines[0])).toEqual(["extra"]);
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
