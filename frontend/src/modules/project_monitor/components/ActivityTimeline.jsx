import { Pencil } from "lucide-react";
import { useState } from "react";

import { formatDate, formatDateTime } from "../utils/status";
import { isEditWindowExpired } from "../utils/editAccess";
import { RequestEditAccessBlock } from "./RequestEditAccessBlock";

function initialsOf(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "?";
  }
  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}

/**
 * A meeting update's "Meeting: <date>" line, correctable in place -
 * entered by mistake, a past update's meeting date can be fixed
 * exactly as long as the activity itself is still inside (or has been
 * re-granted) its 48-hour edit window, same as every other change to
 * it (``onEditMeetingDate`` is the same mutation the update form's
 * "48 hours" refusal already triggers ``RequestEditAccessBlock``
 * for - standardized on the one mechanism rather than a second one).
 */
function EditableMeetingDate({
  comment,
  activityId,
  canEdit,
  onEditMeetingDate,
  editMeetingDateStatus,
  onRequestEditAccess,
  requestEditAccessStatus,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(comment.meeting_date);
  const [saveError, setSaveError] = useState(null);

  if (!isEditing) {
    return (
      <span className="pm-thread__meeting">
        <time dateTime={comment.meeting_date}>
          Meeting: {formatDate(comment.meeting_date)}
        </time>
        {canEdit && onEditMeetingDate ? (
          <button
            type="button"
            className="icon-button icon-button--sm"
            onClick={() => {
              setValue(comment.meeting_date);
              setSaveError(null);
              setIsEditing(true);
            }}
            aria-label="Correct this meeting date"
            title="Correct this meeting date"
          >
            <Pencil size={12} />
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <span className="pm-thread__meeting pm-thread__meeting--editing">
      <input
        type="date"
        aria-label="Meeting date"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        type="button"
        className="button button--tertiary button--sm"
        disabled={editMeetingDateStatus?.isPending}
        onClick={() =>
          onEditMeetingDate(comment.id, value, {
            onSuccess: () => setIsEditing(false),
            onError: (error) => setSaveError(error),
          })
        }
      >
        {editMeetingDateStatus?.isPending ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        className="button button--tertiary button--sm"
        onClick={() => setIsEditing(false)}
      >
        Cancel
      </button>
      {saveError ? (
        isEditWindowExpired(saveError) && onRequestEditAccess ? (
          <RequestEditAccessBlock
            activityId={activityId}
            onRequestEditAccess={onRequestEditAccess}
            requestEditAccessStatus={requestEditAccessStatus}
          />
        ) : (
          <div className="inline-alert inline-alert--error">
            {saveError.message}
          </div>
        )
      ) : null}
    </span>
  );
}

/**
 * An activity's Action History as a thread: newest update first, each
 * with who made it and when, hung on a vertical line so the order of
 * events reads at a glance. A mistaken meeting date can be corrected
 * in place (see ``EditableMeetingDate``) when ``onEditMeetingDate`` is
 * given and the viewer may edit the activity.
 */
export function ActivityTimeline({
  activity,
  canEdit,
  onEditMeetingDate,
  editMeetingDateStatus,
  onRequestEditAccess,
  requestEditAccessStatus,
}) {
  const comments = [...(activity.comments || [])].sort((a, b) => {
    if (a.meeting_date !== b.meeting_date) {
      return a.meeting_date < b.meeting_date ? 1 : -1;
    }
    // Same meeting - fall back to the real logging order so two
    // updates entered for one meeting don't shuffle arbitrarily.
    return a.created_at < b.created_at ? 1 : -1;
  });

  if (!comments.length) {
    return (
      <p className="pm-timeline-empty">
        No meeting updates recorded yet.
      </p>
    );
  }

  return (
    <ol className="pm-thread">
      {comments.map((comment) => (
        <li className="pm-thread__item" key={comment.id}>
          <span className="pm-thread__node" aria-hidden="true">
            {initialsOf(comment.created_by_name)}
          </span>
          <div className="pm-thread__body">
            <div className="pm-thread__meta">
              <strong>
                {comment.created_by_name || "Someone"}
              </strong>
              <EditableMeetingDate
                comment={comment}
                activityId={activity.id}
                canEdit={canEdit}
                onEditMeetingDate={onEditMeetingDate}
                editMeetingDateStatus={editMeetingDateStatus}
                onRequestEditAccess={onRequestEditAccess}
                requestEditAccessStatus={requestEditAccessStatus}
              />
              {comment.created_at ? (
                <time dateTime={comment.created_at}>
                  Logged {formatDateTime(comment.created_at)}
                </time>
              ) : null}
            </div>
            <p className="pm-thread__text">{comment.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TargetDateHistory({ activity }) {
  const entries = activity.date_history || [];

  if (!entries.length) {
    return (
      <span className="pm-timeline-empty">
        No date set
      </span>
    );
  }

  return (
    <span>
      {entries.map((entry, index) => (
        <span
          key={entry.id}
          style={
            index < entries.length - 1
              ? {
                  marginRight: 6,
                  color: "var(--color-neutral-500)",
                  textDecoration:
                    "line-through",
                }
              : { fontWeight: 700 }
          }
        >
          {formatDate(entry.target_date)}
        </span>
      ))}
    </span>
  );
}
