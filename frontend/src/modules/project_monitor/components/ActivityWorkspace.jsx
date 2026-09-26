import { ActivityMatrix } from "./ActivityMatrix";
import { ReviewAllControl } from "./ReviewAllControl";

/**
 * A structure's or building's activity sheet, opened in place under
 * its own row (the workspace that replaced the side drawer): the
 * "review everything" control, then its sections as buttons
 * (Approvals, Abutments, Piers ...) with the chosen section's tasks as
 * coloured cells in a horizontal status matrix (see
 * ``ActivityMatrix``). Its name, chainage, description and progress are
 * already on the row it opens under, so they are not repeated here.
 * Editing is never gated by review state - Director or Project Manager
 * can optionally sign off any task, or every task at once.
 */
export function ActivityWorkspace({
  item,
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
        <ReviewAllControl
          onReviewAll={onReviewAll}
          reviewAllStatus={reviewAllStatus}
        />
      </div>

      <ActivityMatrix
        key={item.id}
        groups={item.groups}
        {...tableProps}
      />
    </section>
  );
}
