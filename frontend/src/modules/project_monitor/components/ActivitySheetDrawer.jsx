import { X } from "lucide-react";
import { useRef } from "react";

import { useOutsideClick } from "../../../hooks/useOutsideClick";
import { ActivityGroupsTable } from "./ActivityGroupsTable";
import { ReviewAllControl } from "./ReviewAllControl";

/**
 * The generic "click a structure/building, see its full activity
 * sheet in a side drawer" panel - shared by Structures and
 * Buildings, since once an item has ``groups``/``overall_progress``
 * (see ``ActivityGroupedSerializerMixin`` on the backend) the
 * drawer's body is identical either way. The actual group/row
 * rendering lives in ``ActivityGroupsTable`` (shared with Girders,
 * which needs to render this same shape more than once per bridge).
 *
 * Editing is never gated by review state - a Director or Project
 * Manager can optionally sign off on any row via
 * ``ActivityDetailPanel``'s "Mark as reviewed" control, and
 * ``ReviewAllControl`` does the same for every row on this sheet at
 * once.
 */
export function ActivitySheetDrawer({
  item,
  eyebrow,
  metaLine,
  activeActivityId,
  onSelectActivity,
  canEdit,
  onClose,
  onSubmitUpdate,
  updateStatus,
  onReviewActivity,
  reviewActivityStatus,
  onReviewAll,
  reviewAllStatus,
}) {
  const drawerRef = useRef(null);
  useOutsideClick(
    drawerRef,
    Boolean(activeActivityId),
    () => onSelectActivity(null),
  );

  if (!item) {
    return null;
  }

  return (
    <aside
      className="details-drawer"
      ref={drawerRef}
    >
      <div className="details-drawer__header">
        <div>
          <span className="page-eyebrow">
            {eyebrow}
          </span>
          <h2>{item.name}</h2>
          <p>{metaLine}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={18} />
        </button>
      </div>

      <ReviewAllControl
        onReviewAll={onReviewAll}
        reviewAllStatus={reviewAllStatus}
      />

      {item.description ? (
        <p className="sub">{item.description}</p>
      ) : null}
      <ActivityGroupsTable
        groups={item.groups}
        activeActivityId={activeActivityId}
        onSelectActivity={onSelectActivity}
        canEdit={canEdit}
        onSubmitUpdate={onSubmitUpdate}
        updateStatus={updateStatus}
        onReviewActivity={onReviewActivity}
        reviewActivityStatus={
          reviewActivityStatus
        }
      />
    </aside>
  );
}
