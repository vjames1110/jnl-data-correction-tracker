import { formatDate } from "../utils/status";

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
 * An activity's Action History as a thread: newest update first, each
 * with who made it and when, hung on a vertical line so the order of
 * events reads at a glance.
 */
export function ActivityTimeline({ activity }) {
  const comments = [...(activity.comments || [])].sort(
    (a, b) =>
      a.meeting_date < b.meeting_date ? 1 : -1,
  );

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
              <time dateTime={comment.meeting_date}>
                {formatDate(comment.meeting_date)}
              </time>
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
