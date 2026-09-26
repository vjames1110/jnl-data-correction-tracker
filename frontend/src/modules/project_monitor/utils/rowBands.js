/**
 * Visual banding for a group's rows that repeat per span / unit.
 *
 * A Major Bridge's "Superstructure (span-wise)" sheet lists every
 * span's tasks in one long table - "S1 - Bearings", "S1 - Girder
 * fabrication" ... "S2 - Bearings" ... - so it is hard to see where
 * one span stops and the next starts. Rows are clustered by that
 * leading label and clusters alternate light grey / white, with a
 * firmer line where a new cluster starts.
 *
 * Only groups that really repeat (two or more different labels) are
 * banded; an ordinary group keeps its plain rows.
 */

// "S1 - x", "S2 – x", "P3 — x": a short label ending in a
// number, then a dash, then the task. "R/W 1" (no dash) never matches.
const CLUSTER = /^\s*([A-Za-z]{1,6}\s?\d+)\s*[–—-]\s+\S/;

export function clusterKey(name) {
  const match = CLUSTER.exec(name || "");
  return match
    ? match[1].replace(/\s+/g, "").toUpperCase()
    : null;
}

/**
 * ``[{band: "a" | "b" | null, start: boolean}]`` per row, in order.
 * ``start`` marks the first row of every cluster after the first.
 */
export function rowBands(rows) {
  const keys = rows.map((row) => clusterKey(row.name));
  if (new Set(keys.filter(Boolean)).size < 2) {
    return rows.map(() => ({ band: null, start: false }));
  }

  let cluster = -1;
  let previous;
  return keys.map((key, index) => {
    const changed = index === 0 || key !== previous;
    if (changed) {
      cluster += 1;
    }
    previous = key;
    return {
      band: cluster % 2 === 0 ? "a" : "b",
      start: changed && index > 0,
    };
  });
}

/** The CSS classes for one row's band (empty for an unbanded row). */
export function bandClasses(band) {
  if (!band?.band) {
    return "";
  }
  return `pm-row--band-${band.band}${
    band.start ? " pm-row--cluster-start" : ""
  }`;
}
