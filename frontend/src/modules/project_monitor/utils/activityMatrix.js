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

/**
 * A hand-added activity (``is_custom``) exists on exactly one element
 * (one pier, one span) - never on every element of a repeated group
 * the way a template row does. Both layouts below (the per-element
 * stack, the per-span pivot) decide their *shape* - which columns
 * exist, whether several groups merge into one table - from the
 * template rows alone, then slot any custom rows in afterwards as
 * extra columns scoped to the one line they belong to. Deciding shape
 * from the full row list (the previous behaviour) meant adding one
 * custom row to a single pier changed that pier's row-name
 * "signature" just enough to stop it matching its sibling piers -
 * splitting one "Piers" table into several different ones mid-session,
 * and for a per-span sheet, a custom row with an unexpected name could
 * abort the pivot for the whole span-wise table. Neither can happen
 * once the shape depends only on the template.
 */
const isTemplateRow = (row) => !row.is_custom;

function pivotBlock(group) {
  const templateRows = group.rows.filter(isTemplateRow);
  const customRows = group.rows.filter((row) => row.is_custom);

  const parts = templateRows.map((row) => clusterParts(row.name));
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

  const place = (row, label, rest) => {
    const count = (seen.get(`${label}|${rest}`) ?? 0) + 1;
    seen.set(`${label}|${rest}`, count);
    const key = `${rest}#${count}`;
    if (!columnIndex.has(key)) {
      columnIndex.set(key, columns.length);
      columns.push({ key, label: rest });
    }
    lines.get(label).set(key, row);
  };

  templateRows.forEach((row, index) => {
    const { label, rest } = parts[index];
    place(row, label, rest);
  });

  // A custom row named like its span's own rows ("S2 - Extra check")
  // slots in as one more column, present only on that span; one that
  // doesn't name a span already in this pivot can't be placed in the
  // grid at all, so it is kept aside instead of being dropped or
  // breaking the table (see ``overflowRows``).
  const overflowRows = [];
  customRows.forEach((row) => {
    const part = clusterParts(row.name);
    if (!part || !lines.has(part.label)) {
      overflowRows.push(row);
      return;
    }
    place(row, part.label, part.rest);
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
    overflowRows,
  };
}

function lineBlock(group) {
  const templateRows = group.rows.filter(isTemplateRow);
  const customRows = group.rows.filter((row) => row.is_custom);
  const templateColumns = templateRows.map((row) => ({
    key: row.id,
    label: row.name,
  }));
  const customColumns = customRows.map((row) => ({
    key: row.id,
    label: row.name,
    custom: true,
  }));
  return {
    type: "line",
    group,
    // Only a group with at least one template row can ever stack with
    // another - an all-custom group (see ``overflowRows`` above) has
    // nothing to match a sibling's signature against and must stand
    // alone, so its signature is never reused.
    signature: templateColumns.length
      ? templateColumns.map((column) => column.label).join("\u0001")
      : null,
    templateColumns,
    customColumns,
    lines: [
      {
        key: groupKey(group),
        label: group.group_title,
        sublabel: group.group_subtitle || "",
        templateCells: templateRows,
        customCells: customRows,
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
  // Every merged line shares the template columns, in the same order,
  // by construction (only lines with an identical template signature
  // are ever merged - see ``mergeStacks``); a custom column, though,
  // belongs to whichever one line added it, so every other line gets
  // ``null`` there rather than a cell that was never generated for it.
  const columns = [
    ...block.templateColumns,
    ...block.customColumns,
  ];
  const lines = block.lines.map((line) => ({
    key: line.key,
    label: line.label,
    sublabel: line.sublabel,
    cells: [
      ...line.templateCells,
      ...block.customColumns.map(
        (column) =>
          line.customCells.find(
            (row) => row.name === column.label,
          ) ?? null,
      ),
    ],
  }));
  return {
    key: lines[0].key,
    title:
      lines.length > 1 ? stackTitle(lines) : lines[0].label,
    subcaption: "",
    columns,
    lines,
  };
}

function mergeStacks(blocks) {
  const merged = [];
  blocks.forEach((block) => {
    const last = merged[merged.length - 1];
    if (
      block.type === "line" &&
      last?.type === "line" &&
      last.signature !== null &&
      last.signature === block.signature
    ) {
      last.lines.push(...block.lines);
      block.customColumns.forEach((column) => {
        if (
          !last.customColumns.some(
            (existing) => existing.label === column.label,
          )
        ) {
          last.customColumns.push(column);
        }
      });
      return;
    }
    merged.push(
      block.type === "line"
        ? {
            ...block,
            lines: [...block.lines],
            customColumns: [...block.customColumns],
          }
        : block,
    );
  });
  return merged;
}

/** The matrices for one sheet (see the file comment). */
export function buildMatrix(groups) {
  const blocks = [];
  (groups ?? [])
    .filter((group) => group.rows?.length)
    .forEach((group) => {
      const pivot = pivotBlock(group);
      if (!pivot) {
        blocks.push(lineBlock(group));
        return;
      }
      blocks.push(pivot);
      // A custom row that couldn't be placed in the per-span grid (see
      // ``pivotBlock``) still needs to show up somewhere - as its own
      // small table right after the one it was added to, rather than
      // being silently dropped or forced into the grid where it
      // doesn't belong.
      if (pivot.overflowRows.length) {
        blocks.push(
          lineBlock({
            ...group,
            group_title: `${group.group_title} - other activities`,
            rows: pivot.overflowRows,
          }),
        );
      }
    });
  return mergeStacks(blocks).map(toTable);
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
