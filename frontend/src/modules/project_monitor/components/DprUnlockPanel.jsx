import { useState } from "react";

import {
  useDprUnlocks,
  useUnlockDprDay,
} from "../../../hooks/useProjectMonitor";
import {
  apiErrorMessage,
  todayIso,
} from "../utils/finance";
import { formatDate } from "../utils/status";

/**
 * Admin-only: reopen one past DPR day for this site (with a reason
 * that is kept on record). Everyone who can view the site can see
 * which days were unlocked and why.
 */
export function DprUnlockPanel({ siteId, canUnlock }) {
  const unlocksQuery = useDprUnlocks(siteId, true);
  const unlockDay = useUnlockDprDay();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const unlocks = unlocksQuery.data ?? [];

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await unlockDay.mutateAsync({
        site: siteId,
        date,
        reason,
      });
      setDate("");
      setReason("");
    } catch {
      // Shown by the inline alert.
    }
  };

  if (!canUnlock && unlocks.length === 0) {
    return null;
  }

  return (
    <details className="pm-unlock print-hidden">
      <summary>
        Unlocked days{unlocks.length ? ` (${unlocks.length})` : ""}
      </summary>
      {canUnlock ? (
        <form
          className="pm-inline-row"
          onSubmit={handleSubmit}
        >
          <label className="form-field">
            <span>Day to unlock</span>
            <input
              type="date"
              value={date}
              max={todayIso()}
              onChange={(event) =>
                setDate(event.target.value)
              }
              required
            />
          </label>
          <label
            className="form-field"
            style={{ minWidth: 260 }}
          >
            <span>Reason</span>
            <input
              type="text"
              value={reason}
              onChange={(event) =>
                setReason(event.target.value)
              }
              required
            />
          </label>
          <button
            type="submit"
            className="button button--primary"
            disabled={unlockDay.isPending}
          >
            Unlock day
          </button>
        </form>
      ) : null}
      {unlockDay.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(unlockDay.error)}
        </div>
      ) : null}
      {unlocks.length ? (
        <ul className="pm-unlock__list">
          {unlocks.map((unlock) => (
            <li key={unlock.id}>
              <strong>{formatDate(unlock.date)}</strong> -{" "}
              {unlock.reason}
              {unlock.unlocked_by
                ? ` (${unlock.unlocked_by})`
                : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
