import { useState } from "react";

/**
 * Offered right where a 48-hour-window refusal happened (the update
 * form, or a meeting-date correction in the Action History thread) -
 * lets the signed-in person ask an Admin/Director to reopen editing,
 * instead of a dead-end error. Lives in its own file (not inside
 * ``ActivityDetailPanel``) so ``ActivityTimeline`` can reuse it
 * without the two importing each other.
 */
export function RequestEditAccessBlock({
  activityId,
  onRequestEditAccess,
  requestEditAccessStatus,
}) {
  const [reason, setReason] = useState("");
  const [sentId, setSentId] = useState(null);

  if (sentId === activityId) {
    return (
      <p className="pm-timeline-empty">
        Request sent - an Admin or Director will review it.
      </p>
    );
  }

  return (
    <div className="pm-edit-access-request">
      <label className="form-field">
        <span>Why do you need edit access? (optional)</span>
        <textarea
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="button button--secondary button--sm"
        disabled={requestEditAccessStatus?.isPending}
        onClick={() =>
          onRequestEditAccess(
            activityId,
            { reason },
            { onSuccess: () => setSentId(activityId) },
          )
        }
      >
        {requestEditAccessStatus?.isPending
          ? "Sending..."
          : "Request edit access"}
      </button>
      {requestEditAccessStatus?.isError ? (
        <div className="inline-alert inline-alert--error">
          {requestEditAccessStatus.error.message}
        </div>
      ) : null}
    </div>
  );
}
