const STATUS_DRAW_ORDER = {
  IN_PROGRESS: 0,
  HOLD: 1,
  COMPLETE: 2,
};

const STATUS_BLOCK_CLASS = {
  IN_PROGRESS: "pm-blk--ip",
  HOLD: "pm-blk--hold",
  COMPLETE: "pm-blk--done",
};

function position(
  from,
  to,
  chainageStart,
  chainageEnd,
) {
  const span = Math.max(
    chainageEnd - chainageStart,
    0.001,
  );
  const left = Math.max(
    0,
    ((from - chainageStart) / span) * 100,
  );
  const width = Math.max(
    0.3,
    ((Math.min(to, chainageEnd) -
      Math.max(from, chainageStart)) /
      span) *
      100,
  );
  return { left: `${left}%`, width: `${width}%` };
}

/**
 * The horizontal chainage rolling-diagram for one ``M``-unit linear
 * item - grey scope patches under raw progress-entry blocks,
 * z-order painted Ongoing -> Hold -> Completed (last on top), so
 * "green overlays yellow" is a pure paint-order effect, not a
 * geometric computation - the actual Done/Ongoing/Pending numbers
 * always come from the backend's ``compute_item_stats``, never
 * recomputed here. Positioned against the project's own
 * ``chainage_start_km``/``chainage_end_km``, shared across every
 * linear item on the site.
 */
export function RollingDiagram({
  scopePatches,
  progressEntries,
  chainageStart,
  chainageEnd,
}) {
  const c0 = Number(chainageStart ?? 0);
  const c1 = Number(
    chainageEnd ?? c0 + 10,
  );

  const sortedEntries = [
    ...progressEntries,
  ].sort(
    (a, b) =>
      STATUS_DRAW_ORDER[a.status] -
      STATUS_DRAW_ORDER[b.status],
  );

  return (
    <div className="pm-rolling-diagram">
      <div className="pm-rolling-diagram__ruler">
        <span>{c0} km</span>
        <span>{c1} km</span>
      </div>
      <div className="pm-rolling-diagram__track">
        {scopePatches.map((patch) => (
          <div
            key={patch.id}
            className="pm-scp"
            style={position(
              Number(
                patch.from_chainage_km,
              ),
              Number(patch.to_chainage_km),
              c0,
              c1,
            )}
            title={`Scope ${patch.from_chainage_km}-${patch.to_chainage_km} km (${patch.side})`}
          />
        ))}
        {sortedEntries.map((entry) => (
          <div
            key={entry.id}
            className={`pm-blk ${STATUS_BLOCK_CLASS[entry.status] || ""}`}
            style={position(
              Number(
                entry.from_chainage_km,
              ),
              Number(entry.to_chainage_km),
              c0,
              c1,
            )}
            title={`${entry.date}: ${entry.from_chainage_km}-${entry.to_chainage_km} km (${entry.status})`}
          />
        ))}
      </div>
      <div className="pm-rolling-diagram__legend">
        <span>
          <i className="pm-legend-swatch pm-legend-swatch--scope" />{" "}
          Scope
        </span>
        <span>
          <i className="pm-legend-swatch pm-legend-swatch--ip" />{" "}
          Ongoing
        </span>
        <span>
          <i className="pm-legend-swatch pm-legend-swatch--done" />{" "}
          Completed
        </span>
        <span>
          <i className="pm-legend-swatch pm-legend-swatch--hold" />{" "}
          Hold
        </span>
      </div>
    </div>
  );
}
