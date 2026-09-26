import { X } from "lucide-react";
import { useState } from "react";

import { formatDate } from "../utils/status";
import {
  ActivityStatusChip,
  MaterialStatusBadge,
} from "./ActivityStatusChip";
import { ActivityRowTools, ReviewBody } from "./ActivityRowTools";
import { ActivityTimeline } from "./ActivityTimeline";
import { ActivityUpdateForm } from "./ActivityUpdateForm";

const VIEW_LABELS = {
  history: "Action history",
  review: "Review",
};

/**
 * The content of the popup that opens beside a task when it is
 * clicked (see ActivityPopup): the task's name and status, and the
 * update form for anyone who can edit.
 *
 * When ``onReview`` is given, the task's Action History and review
 * sign-off are two icons in the popup's top corner (next to the close
 * button). Pressing one swaps the body for that view, pressing it again
 * (or saving a review) goes back - so the popup stays one box.
 */
export function ActivityDetailPanel({
  activity,
  groupTitle,
  canEdit,
  onSubmitUpdate,
  isPending,
  error,
  showProgress = true,
  onClose,
  onReview,
  reviewStatus,
}) {
  const [view, setView] = useState("update");

  return (
    <div className="pm-update-panel">
      <div className="pm-update-panel__head">
        <div className="pm-update-panel__title">
          <span className="page-eyebrow">
            {VIEW_LABELS[view] ?? groupTitle}
          </span>
          <h4>{activity.name}</h4>
        </div>
        <div className="pm-update-panel__chips">
          <ActivityStatusChip activity={activity} />
          <MaterialStatusBadge activity={activity} />
        </div>
        {onReview ? (
          <ActivityRowTools
            activity={activity}
            openTool={view === "update" ? null : view}
            onOpenTool={(kind) => setView(kind ?? "update")}
          />
        ) : null}
        {onClose ? (
          <button
            type="button"
            className="icon-button pm-popup__close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {view === "history" ? (
        <ActivityTimeline activity={activity} />
      ) : null}

      {view === "review" ? (
        <ReviewBody
          activity={activity}
          onReview={onReview}
          reviewStatus={reviewStatus}
          onClose={onClose}
        />
      ) : null}

      {view === "update" ? (
        <>
          {activity.status === "COMPLETE" &&
          activity.completed_on ? (
            <p className="pm-update-panel__note">
              Completed on {formatDate(activity.completed_on)}
            </p>
          ) : null}

          {canEdit ? (
            <ActivityUpdateForm
              activity={activity}
              onSubmit={onSubmitUpdate}
              isPending={isPending}
              error={error}
              showProgress={showProgress}
            />
          ) : (
            <p className="pm-timeline-empty">
              You have view-only access.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
