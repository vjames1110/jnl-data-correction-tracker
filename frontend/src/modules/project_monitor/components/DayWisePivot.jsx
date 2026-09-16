import { formatDate, formatQty } from "../utils/status";
import { ActivityStatusChip } from "./ActivityStatusChip";

function sumQty(entries, date, status) {
  return entries
    .filter(
      (entry) =>
        entry.date === date &&
        entry.status === status,
    )
    .reduce(
      (total, entry) =>
        total + Number(entry.qty || 0),
      0,
    );
}

/**
 * Activities x dates (latest first), each cell a flat sum of that
 * item's qty for that date/status - pure grouping, no interval math
 * (the prototype's own day-wise pivot has none either). The leading
 * Scope/Done/Pending/% columns show each item's current totals from
 * the backend's ``compute_item_stats``, not a point-in-time-as-of-
 * that-date figure - a deliberate simplification for this pass.
 */
export function DayWisePivot({ items }) {
  const allEntries = items.flatMap((item) =>
    item.progress_entries.map((entry) => ({
      ...entry,
      itemName: item.name,
      unit: item.unit,
    })),
  );

  const dates = [
    ...new Set(
      allEntries.map((entry) => entry.date),
    ),
  ].sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) {
    return (
      <p className="pm-timeline-empty">
        No progress entries logged yet.
      </p>
    );
  }

  const mUnitItems = items.filter(
    (item) => item.unit === "M",
  );

  return (
    <div className="pm-table-wrap">
      <table className="pm-report__table pm-pivot-table">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Unit</th>
            <th>Scope</th>
            <th>Done</th>
            <th>Pending</th>
            {dates.map((date) => (
              <th key={date}>
                {formatDate(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.unit}</td>
              <td>
                {formatQty(item.stats.scope)}
              </td>
              <td>
                {formatQty(item.stats.done)}
              </td>
              <td>
                {formatQty(
                  item.stats.pending,
                )}
              </td>
              {dates.map((date) => {
                const done = sumQty(
                  item.progress_entries,
                  date,
                  "COMPLETE",
                );
                const ongoing = sumQty(
                  item.progress_entries,
                  date,
                  "IN_PROGRESS",
                );
                return (
                  <td key={date}>
                    {done || ongoing
                      ? done
                      : "-"}
                    {ongoing ? (
                      <span className="pm-pivot-table__muted">
                        {" "}
                        ({ongoing})
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="pm-pivot-table__total">
            <td colSpan={2}>
              Total (running-metre items)
            </td>
            <td>
              {formatQty(
                mUnitItems.reduce(
                  (total, item) =>
                    total +
                    Number(
                      item.stats.scope,
                    ),
                  0,
                ),
              )}
            </td>
            <td>
              {formatQty(
                mUnitItems.reduce(
                  (total, item) =>
                    total +
                    Number(item.stats.done),
                  0,
                ),
              )}
            </td>
            <td>
              {formatQty(
                mUnitItems.reduce(
                  (total, item) =>
                    total +
                    Number(
                      item.stats.pending,
                    ),
                  0,
                ),
              )}
            </td>
            {dates.map((date) => (
              <td key={date}>
                {formatQty(
                  mUnitItems.reduce(
                    (total, item) =>
                      total +
                      sumQty(
                        item.progress_entries,
                        date,
                        "COMPLETE",
                      ),
                    0,
                  ),
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <h3 style={{ marginTop: 18 }}>
        Day-wise detail
      </h3>
      <table className="pm-report__table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Item</th>
            <th>From (km)</th>
            <th>To (km)</th>
            <th>Qty</th>
            <th>Status</th>
            <th>Contractor</th>
          </tr>
        </thead>
        <tbody>
          {[...allEntries]
            .sort((a, b) =>
              b.date.localeCompare(a.date),
            )
            .map((entry) => (
              <tr key={entry.id}>
                <td>
                  {formatDate(entry.date)}
                </td>
                <td>{entry.itemName}</td>
                <td>
                  {entry.from_chainage_km}
                </td>
                <td>
                  {entry.to_chainage_km}
                </td>
                <td>{entry.qty}</td>
                <td>
                  <ActivityStatusChip
                    activity={entry}
                  />
                </td>
                <td>
                  {entry.contractor || "-"}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
