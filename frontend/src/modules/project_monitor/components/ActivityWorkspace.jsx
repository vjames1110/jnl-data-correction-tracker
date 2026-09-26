import { GroupSegments } from "./GroupSegments";
import { ReviewAllControl } from "./ReviewAllControl";

/**
 * A structure's or building's activity sheet, opened in place under
 * its own row (the workspace that replaced the side drawer): a
 * summary line, the "review everything" control, then its groups as
 * segments (see ``GroupSegments``). Editing is never gated by review
 * state - Director or Project Manager can optionally sign off any
 * row, or every row at once.
 */
export function ActivityWorkspace({
  item,
  metaLine,
  onReviewAll,
  reviewAllStatus,
  ...tableProps
}) {
  return (
    <section
      className="pm-workspace-panel"
      aria-label={`${item.name} tasks`}
    >
      <div className="pm-workspace-panel__head">
        <p className="pm-workspace-panel__meta">{metaLine}</p>
        <ReviewAllControl
          onReviewAll={onReviewAll}
          reviewAllStatus={reviewAllStatus}
        />
      </div>

      {item.description ? (
        <p className="sub">{item.description}</p>
      ) : null}

      <GroupSegments
        key={item.id}
        groups={item.groups}
        {...tableProps}
      />
    </section>
  );
}
