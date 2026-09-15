import clsx from "clsx";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { Fragment, useState } from "react";

import { ActivityDetailPanel } from "./ActivityDetailPanel";
import { ActivityProgressBar } from "./ActivityProgressBar";
import {
  ActivityStatusChip,
  MaterialStatusBadge,
} from "./ActivityStatusChip";
import { TargetDateHistory } from "./ActivityTimeline";

/**
 * The generic "click a structure/building, see its full activity
 * sheet in a side drawer" panel - shared by Structures and
 * Buildings, since once an item has ``groups``/``overall_progress``
 * (see ``ActivityGroupedSerializerMixin`` on the backend) the
 * drawer's body is identical either way.
 *
 * Clicking a row expands its update form directly below it, inline,
 * within the same table (a chevron marks the open row) - it never
 * replaces the drawer's body with a separate view, so the structure/
 * building's groups and other rows stay visible and reachable the
 * whole time.
 *
 * Editing is never gated by review state - a Director or Project
 * Manager can optionally sign off on any row via
 * ``ActivityDetailPanel``'s "Mark as reviewed" control, and the
 * "Review all" control here does the same for every row on this
 * sheet at once.
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
  const [
    isReviewAllFormOpen,
    setIsReviewAllFormOpen,
  ] = useState(false);
  const [reviewAllRemarks, setReviewAllRemarks] =
    useState("");

  if (!item) {
    return null;
  }

  const handleReviewAll = (event) => {
    event.preventDefault();
    onReviewAll(reviewAllRemarks, {
      onSuccess: () => {
        setIsReviewAllFormOpen(false);
        setReviewAllRemarks("");
      },
    });
  };

  return (
    <aside className="details-drawer">
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

      {onReviewAll ? (
        <div className="pm-review-all">
          {isReviewAllFormOpen ? (
            <form
              className="pm-inline-row"
              onSubmit={handleReviewAll}
            >
              <input
                type="text"
                placeholder="Remark for this review (optional)"
                value={reviewAllRemarks}
                onChange={(event) =>
                  setReviewAllRemarks(
                    event.target.value,
                  )
                }
              />
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  reviewAllStatus?.isPending
                }
              >
                <CheckCircle2 size={14} />{" "}
                Confirm review all
              </button>
              <button
                type="button"
                className="button button--tertiary"
                onClick={() =>
                  setIsReviewAllFormOpen(false)
                }
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="button button--secondary"
              onClick={() =>
                setIsReviewAllFormOpen(true)
              }
            >
              <CheckCircle2 size={14} /> Review
              all tasks in this sheet
            </button>
          )}
          {reviewAllStatus?.isError ? (
            <div className="inline-alert inline-alert--error">
              {reviewAllStatus.error?.message}
            </div>
          ) : null}
        </div>
      ) : null}

      {item.description ? (
        <p className="sub">{item.description}</p>
      ) : null}
      {item.groups.map((group) => (
        <div
          className="pm-group"
          key={`${group.group_order}-${group.group_title}`}
        >
          <div className="pm-group__header">
            <strong>
              {group.group_title}
            </strong>
            {group.group_subtitle ? (
              <span>
                {group.group_subtitle}
              </span>
            ) : null}
          </div>
          <div className="pm-table-wrap">
            <table className="pm-activity-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>
                    {group.group_order === 0
                      ? "Date"
                      : "Target date"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => {
                  const isExpanded =
                    row.id === activeActivityId;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={clsx(
                          row.status ===
                            "COMPLETE" &&
                            "pm-row--done",
                          isExpanded &&
                            "pm-row--expanded",
                        )}
                        onClick={() =>
                          onSelectActivity(
                            isExpanded
                              ? null
                              : row.id,
                          )
                        }
                      >
                        <td className="pm-activity-name-cell">
                          {isExpanded ? (
                            <ChevronDown
                              size={14}
                            />
                          ) : (
                            <ChevronRight
                              size={14}
                            />
                          )}
                          {row.name}
                          {row.reviewed_at ? (
                            <CheckCircle2
                              size={13}
                              className="pm-reviewed-icon"
                              aria-label={`Reviewed by ${row.reviewed_by_name || "someone"}`}
                            />
                          ) : null}
                        </td>
                        <td>
                          <ActivityProgressBar
                            activity={row}
                          />
                        </td>
                        <td>
                          <ActivityStatusChip
                            activity={row}
                          />
                          <div>
                            <MaterialStatusBadge
                              activity={row}
                            />
                          </div>
                        </td>
                        <td>
                          <TargetDateHistory
                            activity={row}
                          />
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="pm-expand-row">
                          <td colSpan={4}>
                            <ActivityDetailPanel
                              activity={row}
                              groupTitle={
                                group.group_title
                              }
                              canEdit={canEdit}
                              onSubmitUpdate={(
                                payload,
                              ) =>
                                onSubmitUpdate(
                                  row.id,
                                  payload,
                                )
                              }
                              isPending={
                                updateStatus.isPending
                              }
                              error={
                                updateStatus.isError
                                  ? updateStatus.error
                                  : null
                              }
                              onReview={(
                                remarks,
                              ) =>
                                onReviewActivity(
                                  row.id,
                                  remarks,
                                )
                              }
                              reviewStatus={
                                reviewActivityStatus
                              }
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </aside>
  );
}
