import { useState } from "react";

import { STATUS_LABELS, formatDate, formatQty } from "../utils/status";

const METRES_PER_KM = 1000;

const ROW_LABELS = {
  BOTH: [
    { key: "planned", label: "Planned" },
    { key: "done", label: "Executed" },
  ],
  LHS: [
    { key: "planned", label: "LHS – Planned" },
    { key: "done", label: "LHS – Executed" },
  ],
  RHS: [
    { key: "planned", label: "RHS – Planned" },
    { key: "done", label: "RHS – Executed" },
  ],
};

const SIDE_ORDER = ["LHS", "RHS", "BOTH"];

function toMetres(km) {
  return Number(km) * METRES_PER_KM;
}

/** "0+000" style railway chainage label from a km value. */
function formatChainage(km) {
  const totalMetres = Math.round(toMetres(km));
  const wholeKm = Math.trunc(
    totalMetres / METRES_PER_KM,
  );
  const metres = Math.abs(
    totalMetres - wholeKm * METRES_PER_KM,
  );
  return `${wholeKm}+${String(metres).padStart(3, "0")}`;
}

/** Reads "101+000" (or a plain metre number as a forgiving
 * fallback) back into a km value; ``null`` if it isn't a chainage
 * at all. */
function parseChainageInput(text) {
  const trimmed = String(text ?? "").trim();
  const chainageMatch = trimmed.match(
    /^(-?\d+)\s*\+\s*(\d{1,3})$/,
  );
  if (chainageMatch) {
    const km = Number(chainageMatch[1]);
    const metres = Number(chainageMatch[2]);
    return km + metres / METRES_PER_KM;
  }
  const plainMetres = Number(trimmed);
  return Number.isFinite(plainMetres) && trimmed !== ""
    ? plainMetres / METRES_PER_KM
    : null;
}

function overlapsSegment(fromKm, toKm, segment) {
  return (
    Number(toKm) > Number(segment.from_chainage_km) &&
    Number(fromKm) < Number(segment.to_chainage_km)
  );
}

function matchesSide(recordSide, side) {
  return recordSide === side || recordSide === "BOTH";
}

function recordsForSegment(records, segment, side) {
  return (records || []).filter(
    (record) =>
      matchesSide(record.side, side) &&
      overlapsSegment(
        record.from_chainage_km,
        record.to_chainage_km,
        segment,
      ),
  );
}

/** Builds one CSS gradient painting every colour's exact sub-ranges
 * within the cell - each range from the backend is already an exact
 * [start, end] fraction of the segment, so the line drawn here always
 * matches the real chainage position, not a same-sized block anchored
 * to the segment's own edge. */
function buildGradient(layers) {
  const pieces = [];
  for (const [color, ranges] of layers) {
    for (const [start, end] of ranges || []) {
      if (end > start) {
        pieces.push({ start, end, color });
      }
    }
  }
  if (!pieces.length) {
    return undefined;
  }
  pieces.sort((a, b) => a.start - b.start);

  const stops = [];
  let cursor = 0;
  for (const piece of pieces) {
    if (piece.start > cursor) {
      stops.push(
        `transparent ${cursor * 100}%`,
        `transparent ${piece.start * 100}%`,
      );
    }
    stops.push(
      `${piece.color} ${piece.start * 100}%`,
      `${piece.color} ${piece.end * 100}%`,
    );
    cursor = Math.max(cursor, piece.end);
  }
  if (cursor < 1) {
    stops.push(
      `transparent ${cursor * 100}%`,
      `transparent 100%`,
    );
  }
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

function segmentTooltip({
  segment,
  side,
  rowKind,
  scopePatches,
  progressEntries,
}) {
  const range = `${formatChainage(segment.from_chainage_km)} - ${formatChainage(segment.to_chainage_km)}`;

  if (rowKind === "planned") {
    const patches = recordsForSegment(
      scopePatches,
      segment,
      side,
    );
    if (!patches.length) {
      return `${range}: not in scope`;
    }
    return [
      range,
      ...patches.map((patch) => {
        const parts = [
          `Scope ${formatChainage(patch.from_chainage_km)}-${formatChainage(patch.to_chainage_km)}`,
        ];
        if (patch.remarks) {
          parts.push(patch.remarks);
        }
        return parts.join(" - ");
      }),
    ].join("\n");
  }

  const entries = recordsForSegment(
    progressEntries,
    segment,
    side,
  );
  if (!entries.length) {
    return `${range}: nothing logged`;
  }
  return [
    range,
    ...entries.map((entry) => {
      const parts = [
        formatDate(entry.date),
        STATUS_LABELS[entry.status] || entry.status,
        `${formatChainage(entry.from_chainage_km)}-${formatChainage(entry.to_chainage_km)}`,
      ];
      if (entry.contractor) {
        parts.push(entry.contractor);
      }
      if (entry.remarks) {
        parts.push(entry.remarks);
      }
      return parts.join(" - ");
    }),
  ].join("\n");
}

function rangeKeyOf(diagram) {
  return `${diagram.chainage_start_km}|${diagram.chainage_end_km}|${diagram.segment_length_km}`;
}

function inputsFrom(diagram) {
  return {
    start: formatChainage(diagram.chainage_start_km),
    end: formatChainage(diagram.chainage_end_km),
    segmentM: String(
      Math.round(toMetres(diagram.segment_length_km)),
    ),
  };
}

/**
 * The chainage-segmented rolling diagram for a Linear Item - one
 * fixed-width column per chainage segment, one row-pair (Planned /
 * Executed) per side, coloured proportionally (and positioned
 * precisely) to how much of that segment each status covers, and
 * where within it. Works identically for every unit (M/CUM/NOS): the
 * whole diagram is chainage-only, never touching ``qty`` - the item's
 * own Scope/Done/Ongoing/Pending figures (in its own unit) are shown
 * separately, above this, unchanged.
 *
 * ``diagram`` is the server-computed breakdown
 * (``services.linear_diagram.compute_diagram``); ``scopePatches``/
 * ``progressEntries`` are the item's own raw records, used only to
 * build a detailed hover tooltip per segment (which entries actually
 * touch it, not just how much). The whole displayed chainage window
 * and segment size are a *display* choice - ``onApplyRange``
 * re-fetches this one item with a custom range/segment size, it never
 * mutates any data, and the server always widens whatever is
 * requested to still cover the item's own real data.
 */
export function RollingDiagram({
  diagram,
  scopePatches,
  progressEntries,
  onApplyRange,
  isApplyingRange,
}) {
  const [syncedKey, setSyncedKey] = useState(() =>
    rangeKeyOf(diagram),
  );
  const [inputs, setInputs] = useState(() =>
    inputsFrom(diagram),
  );

  // Whenever a fresh diagram arrives with a different range/segment
  // (a new auto-suggestion, or an applied override coming back), the
  // inputs follow it - adjusted during render, per React's own
  // guidance, rather than a useEffect + setState round trip.
  const currentKey = rangeKeyOf(diagram);
  if (currentKey !== syncedKey) {
    setSyncedKey(currentKey);
    setInputs(inputsFrom(diagram));
  }

  const sideKeys = SIDE_ORDER.filter(
    (side) => diagram.sides[side],
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    const startKm = parseChainageInput(inputs.start);
    const endKm = parseChainageInput(inputs.end);
    const segmentM = Number(inputs.segmentM);
    if (
      startKm === null ||
      endKm === null ||
      endKm <= startKm ||
      !segmentM ||
      segmentM <= 0
    ) {
      return;
    }
    onApplyRange({
      chainageStartKm: startKm,
      chainageEndKm: endKm,
      segmentLengthKm: segmentM / METRES_PER_KM,
    });
  };

  return (
    <div className="pm-rolling-diagram">
      <form
        className="pm-rolling-diagram__head"
        onSubmit={handleSubmit}
      >
        <div className="pm-rolling-diagram__info">
          <label>
            <span>Start chainage</span>
            <input
              type="text"
              value={inputs.start}
              onChange={(event) =>
                setInputs((current) => ({
                  ...current,
                  start: event.target.value,
                }))
              }
              placeholder="e.g. 101+000"
            />
          </label>
          <label>
            <span>End chainage</span>
            <input
              type="text"
              value={inputs.end}
              onChange={(event) =>
                setInputs((current) => ({
                  ...current,
                  end: event.target.value,
                }))
              }
              placeholder="e.g. 200+000"
            />
          </label>
          <label>
            <span>Segment length (m)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={inputs.segmentM}
              onChange={(event) =>
                setInputs((current) => ({
                  ...current,
                  segmentM: event.target.value,
                }))
              }
            />
          </label>
          <button
            type="submit"
            className="button button--secondary button--sm"
            disabled={isApplyingRange}
          >
            Apply
          </button>
        </div>
        <div className="pm-rolling-diagram__legend">
          <span>
            <i className="pm-legend-swatch pm-legend-swatch--scope" />{" "}
            Planned
          </span>
          <span>
            <i className="pm-legend-swatch pm-legend-swatch--done" />{" "}
            Executed
          </span>
          <span>
            <i className="pm-legend-swatch pm-legend-swatch--ip" />{" "}
            Ongoing
          </span>
          <span>
            <i className="pm-legend-swatch pm-legend-swatch--hold" />{" "}
            Hold
          </span>
        </div>
      </form>

      <div className="pm-rolling-diagram__table-wrap">
        <table className="pm-rolling-diagram__table">
          <thead>
            <tr>
              <th>Side</th>
              <th>From</th>
              <th>To</th>
              <th>Extent (m)</th>
              <th>Progress</th>
              {diagram.segments.map(
                (segment, index) => (
                  <th key={index}>
                    {formatChainage(
                      segment.from_chainage_km,
                    )}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sideKeys.map((side) => {
              const sideData = diagram.sides[side];
              return ROW_LABELS[side].map((row) => {
                const extentKm =
                  row.key === "planned"
                    ? sideData.planned_length_km
                    : sideData.done_length_km;

                return (
                  <tr key={`${side}-${row.key}`}>
                    <td>{row.label}</td>
                    <td>
                      {formatChainage(
                        diagram.chainage_start_km,
                      )}
                    </td>
                    <td>
                      {formatChainage(
                        Number(
                          diagram.chainage_start_km,
                        ) + Number(extentKm || 0),
                      )}
                    </td>
                    <td>
                      {formatQty(toMetres(extentKm))}
                    </td>
                    <td>
                      {row.key === "done" &&
                      sideData.progress_percent != null
                        ? `${sideData.progress_percent}%`
                        : ""}
                    </td>
                    {sideData.cells.map((cell, index) => (
                      <td
                        key={index}
                        className="pm-rolling-diagram__cell"
                        style={{
                          background:
                            row.key === "planned"
                              ? buildGradient([
                                  [
                                    "var(--pm-rd-planned)",
                                    cell.planned,
                                  ],
                                ])
                              : buildGradient([
                                  [
                                    "var(--pm-rd-done)",
                                    cell.done,
                                  ],
                                  [
                                    "var(--pm-rd-hold)",
                                    cell.hold,
                                  ],
                                  [
                                    "var(--pm-rd-ongoing)",
                                    cell.ongoing,
                                  ],
                                ]),
                        }}
                        title={segmentTooltip({
                          segment:
                            diagram.segments[index],
                          side,
                          rowKind: row.key,
                          scopePatches,
                          progressEntries,
                        })}
                      />
                    ))}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
