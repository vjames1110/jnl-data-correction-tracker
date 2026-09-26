/**
 * Shared bits of the chart kit: the one status colour set, and the
 * small number helpers every chart uses. Colours themselves live in
 * charts.css as `--viz-*` tokens; the `token` names here only pick one.
 */

// A colour always means the same state: complete green, in progress
// blue, hold orange, "no state yet" grey. (Validated with the dataviz
// palette script; grey is context, not a warning.)
export const STATUS_SERIES = [
  { key: "done", label: "Complete", token: "complete" },
  {
    key: "in_progress",
    label: "In progress",
    token: "progress",
  },
  { key: "hold", label: "Hold / issue", token: "hold" },
  {
    key: "not_started",
    label: "Not taken up",
    token: "idle",
  },
];

export function shareOf(value, total) {
  return total ? Math.round((value * 100) / total) : 0;
}

export function statusSegments(counts) {
  return STATUS_SERIES.map((series) => ({
    key: series.key,
    label: series.label,
    token: series.token,
    value: counts[series.key] ?? 0,
  }));
}

export function formatCount(value) {
  return Number(value ?? 0).toLocaleString("en-IN");
}

/**
 * A tidy value axis for counts: steps of 1, 2 or 5 times a power of
 * ten (never 12.5), three to six of them, the smallest range that
 * still holds `rawMax`. Returns `{ max, ticks }` with ticks from 0.
 */
export function niceScale(rawMax) {
  const top = Math.max(1, Number(rawMax) || 0);
  let best = null;
  for (let power = 0; power <= 9; power += 1) {
    for (const factor of [1, 2, 5]) {
      const step = factor * 10 ** power;
      const count = Math.ceil(top / step);
      if (count > 6) {
        continue;
      }
      const max = step * Math.max(count, 1);
      // Prefer the tightest range; on a tie the one with more ticks.
      if (
        !best ||
        max < best.max ||
        (max === best.max && count > best.count)
      ) {
        best = { max, step, count: Math.max(count, 1) };
      }
    }
  }
  const ticks = [];
  for (let index = 0; index <= best.count; index += 1) {
    ticks.push(index * best.step);
  }
  return { max: best.max, ticks };
}
