import { CheckCircle2, History } from "lucide-react";
import { useState } from "react";

import { formatDate } from "../utils/status";
import { ActivityProgressBar } from "./ActivityProgressBar";
import {
  ActivityStatusChip,
  MaterialStatusBadge,
} from "./ActivityStatusChip";
import {
  ActivityTimeline,
  TargetDateHistory,
} from "./ActivityTimeline";
import { ActivityUpdateForm } from "./ActivityUpdateForm";

/**
 * The content of one activity row's inline-expanded area (see
 * ActivitySheetDrawer) - status/progress header, the target-date
 * history with an "Action History" toggle beside it (collapsed by
 * default - shows the full meeting-wise comment log, including who
 * made each entry, only once clicked), the update form for anyone
 * who can edit, and an optional "Mark as reviewed" sign-off that
 * anyone with page access (Director included) can use - reviewing
 * never gates editing, it's purely a record of who looked at this
 * row and when.
 */
export function ActivityDetailPanel({
  activity,
  groupTitle,
  canEdit,
  onSubmitUpdate,
  isPending,
  error,
  onReview,
  reviewStatus,
  showProgress = true,
}) {
  const [isHistoryOpen, setIsHistoryOpen] =
    useState(false);
  const [isReviewFormOpen, setIsReviewFormOpen] =
    useState(false);
  const [reviewRemarks, setReviewRemarks] =
    useState("");

  const handleReview = (event) => {
    event.preventDefault();
    onReview(reviewRemarks);
    setIsReviewFormOpen(false);
    setReviewRemarks("");
  };

  return (
    <div>
      <div className="pm-activity-detail__header">
        <div>
          <span className="page-eyebrow">
            {groupTitle}
          </span>
          <h4>{activity.name}</h4>
        </div>
        <div style={{ textAlign: "right" }}>
          <ActivityStatusChip activity={activity} />
          <div>
            <MaterialStatusBadge
              activity={activity}
            />
          </div>
        </div>
      </div>

      {showProgress ? (
        <div style={{ margin: "10px 0" }}>
          <ActivityProgressBar
            activity={activity}
          />
        </div>
      ) : null}

      <dl className="details-list">
        <div>
          <dt>
            {activity.is_doc
              ? "Approval date"
              : "Target date"}
          </dt>
          <dd className="pm-date-with-history">
            <TargetDateHistory
              activity={activity}
            />
            <button
              type="button"
              className="pm-history-toggle"
              onClick={() =>
                setIsHistoryOpen(
                  (open) => !open,
                )
              }
            >
              <History size={12} /> Action
              history (
              {(activity.comments || [])
                .length}
              )
            </button>
          </dd>
        </div>
        {activity.status === "COMPLETE" &&
        activity.completed_on ? (
          <div>
            <dt>Completed on</dt>
            <dd>
              {formatDate(
                activity.completed_on,
              )}
            </dd>
          </div>
        ) : null}
      </dl>

      {isHistoryOpen ? (
        <ActivityTimeline activity={activity} />
      ) : null}

      {canEdit ? (
        <>
          <h5 style={{ marginTop: 14 }}>
            Update this meeting
          </h5>
          <ActivityUpdateForm
            activity={activity}
            onSubmit={onSubmitUpdate}
            isPending={isPending}
            error={error}
            showProgress={showProgress}
          />
        </>
      ) : (
        <p className="pm-timeline-empty">
          You have view-only access.
        </p>
      )}

      <div className="pm-review-block">
        {activity.reviewed_at ? (
          <p className="pm-review-block__status">
            <CheckCircle2 size={13} />
            Reviewed by{" "}
            {activity.reviewed_by_name ||
              "someone"}{" "}
            on{" "}
            {new Date(
              activity.reviewed_at,
            ).toLocaleString()}
            {activity.review_remarks
              ? ` - "${activity.review_remarks}"`
              : ""}
          </p>
        ) : (
          <p className="pm-review-block__status pm-review-block__status--none">
            Not yet reviewed.
          </p>
        )}
        {isReviewFormOpen ? (
          <form
            className="pm-inline-row"
            onSubmit={handleReview}
          >
            <input
              type="text"
              placeholder="Remark (optional)"
              value={reviewRemarks}
              onChange={(event) =>
                setReviewRemarks(
                  event.target.value,
                )
              }
            />
            <button
              type="submit"
              className="button button--primary"
              disabled={reviewStatus?.isPending}
            >
              Confirm
            </button>
            <button
              type="button"
              className="button button--tertiary"
              onClick={() =>
                setIsReviewFormOpen(false)
              }
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="button button--tertiary"
            onClick={() =>
              setIsReviewFormOpen(true)
            }
          >
            <CheckCircle2 size={14} /> Mark as
            reviewed
          </button>
        )}
        {reviewStatus?.isError ? (
          <div className="inline-alert inline-alert--error">
            {reviewStatus.error?.message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
