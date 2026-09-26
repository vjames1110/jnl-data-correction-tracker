import { clusterParts } from "./rowBands";
import {
  activityProgressPercent,
  formatDate,
  formatProgress,
} from "./status";

/**
 * Lays a sheet's activity ``groups`` out as horizontal status
 * matrices - one column per activity, one row per element - instead of
 * one long vertical list. Each table is one *section* of the sheet
 * (Approvals, Abutments, Piers, Superstructure ...), which the
 * workspace offers as a button each.
 *
 * The layout follows the shape of the data, not the structure type:
 *
 * - a group whose rows repeat per span ("S1 - Bearings", "S2 - ...")
 *   becomes one table with a row per span and a column per task;
 * - consecutive groups with the very same tasks (Pier P1 ... P8, each
 *   floor of a building) stack as rows of one table;
 * - any other group is a table of one row.
 *
 * A table is ``{key, title, subcaption, columns: [{key, label}],
 * lines: [{key, label, sublabel, cells: [activity | null]}]}``.
 */

const groupKey = (group) =>
  `${group.group_order}-${group.group_title}`;

function pivotBlock(group) {
  const parts = group.rows.map((row) => clusterParts(row.name));
  if (!parts.length || parts.some((part) => !part)) {
    return null;
  }
  const labels = [...new Set(parts.map((part) => part.label))];
  if (labels.length < 2) {
    return null;
  }

  // Columns are the task names, in the order they first appear; a name
  // used twice inside one span gets its own column for the repeat.
  const columns = [];
  const columnIndex = new Map();
  const seen = new Map();
  const lines = new Map(labels.map((label) => [label, new Map()]));

  group.rows.forEach((row, index) => {
    const { label, rest } = parts[index];
    const count = (seen.get(`${label}|${rest}`) ?? 0) + 1;
    seen.set(`${label}|${rest}`, count);
    const key = `${rest}#${count}`;
    if (!columnIndex.has(key)) {
      columnIndex.set(key, columns.length);
      columns.push({ key, label: rest });
    }
    lines.get(label).set(key, row);
  });

  return {
    type: "pivot",
    group,
    columns,
    lines: labels.map((label) => ({
      key: `${groupKey(group)}:${label}`,
      label,
      sublabel: "",
      cells: columns.map(
        (column) => lines.get(label).get(column.key) ?? null,
      ),
    })),
  };
}

function lineBlock(group) {
  const columns = group.rows.map((row) => ({
    key: row.id,
    label: row.name,
  }));
  return {
    type: "line",
    group,
    columns,
    signature: columns.map((column) => column.label).join("\u0001"),
    lines: [
      {
        key: groupKey(group),
        label: group.group_title,
        sublabel: group.group_subtitle || "",
        cells: group.rows,
      },
    ],
  };
}

// "Pier P1", "Pier P2" ... -> "Piers". Empty when the titles are not a
// numbered series.
function commonCaption(lines) {
  const stems = lines.map((line) =>
    line.label.replace(/\s+\S*\d+\S*$/, "").trim(),
  );
  const [first] = stems;
  const isSeries =
    first &&
    stems.every((stem) => stem === first) &&
    lines.some((line) => line.label !== first);
  if (!isSeries) {
    return "";
  }
  return /s$/i.test(first) ? first : `${first}s`;
}

// "Piers" for a numbered series; otherwise the rows' own names, e.g.
// "Ground Floor - 1st Floor" or "Bearings . Expansion Joints".
function stackTitle(lines) {
  const series = commonCaption(lines);
  if (series) {
    return series;
  }
  return lines.length > 2
    ? `${lines[0].label} – ${lines[lines.length - 1].label}`
    : lines.map((line) => line.label).join(" · ");
}

function toTable(block) {
  if (block.type === "pivot") {
    return {
      key: groupKey(block.group),
      title: block.group.group_title,
      subcaption: block.group.group_subtitle || "",
      columns: block.columns,
      lines: block.lines,
    };
  }
  return {
    key: block.lines[0].key,
    title:
      block.lines.length > 1
        ? stackTitle(block.lines)
        : block.lines[0].label,
    subcaption: "",
    columns: block.columns,
    lines: block.lines,
  };
}

function mergeStacks(blocks) {
  const merged = [];
  blocks.forEach((block) => {
    const last = merged[merged.length - 1];
    if (
      block.type === "line" &&
      last?.type === "line" &&
      last.signature === block.signature
    ) {
      last.lines.push(...block.lines);
      return;
    }
    merged.push(
      block.type === "line"
        ? { ...block, lines: [...block.lines] }
        : block,
    );
  });
  return merged;
}

/** The matrices for one sheet (see the file comment). */
export function buildMatrix(groups) {
  return mergeStacks(
    (groups ?? [])
      .filter((group) => group.rows?.length)
      .map((group) => pivotBlock(group) ?? lineBlock(group)),
  ).map(toTable);
}

/**
 * How much of a table is done: ``{done, total}`` over its tasks that
 * apply (not applicable ones do not count).
 */
export function tableProgress(table) {
  const activities = table.lines
    .flatMap((line) => line.cells)
    .filter((cell) => cell && cell.status !== "NOT_APPLICABLE");
  return {
    done: activities.filter((cell) => cell.status === "COMPLETE")
      .length,
    total: activities.length,
  };
}

/**
 * The second line of a status cell: how far along, or when it is due
 * - whatever tells most about that status. Empty when the status
 * word says it all.
 */
export function cellDetail(activity) {
  const target = activity.current_target_date
    ? formatDate(activity.current_target_date)
    : "";

  switch (activity.status) {
    case "NOT_APPLICABLE":
      return "";
    case "COMPLETE":
      return activity.completed_on
        ? formatDate(activity.completed_on)
        : "";
    case "IN_PROGRESS":
      return activity.is_doc && target
        ? target
        : formatProgress(activity);
    default:
      return target ? `Due ${target}` : "";
  }
}

/** Width of the little progress bar under an in-progress cell. */
export function cellProgress(activity) {
  return activity.status === "IN_PROGRESS" && !activity.is_doc
    ? Math.round(activityProgressPercent(activity))
    : 0;
}
