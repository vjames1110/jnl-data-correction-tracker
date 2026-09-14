import { formatDate } from "../utils/status";

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
    <ul className="pm-timeline">
      {comments.map((comment) => (
        <li key={comment.id}>
          <span />
          <div>
            <p>{comment.text}</p>
            <small>
              {formatDate(comment.meeting_date)}
              {comment.created_by_name
                ? ` · ${comment.created_by_name}`
                : ""}
            </small>
          </div>
        </li>
      ))}
    </ul>
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
