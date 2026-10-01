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
 * The backend refuses an edit/hide/unhide past the 48-hour window
 * with this exact wording (``services.edit_access.EDIT_WINDOW_MESSAGE``)
 * - matched here so the popup can offer "Request edit access" right
 * where the refusal happened, instead of a dead-end error.
 *
 * Every ``PermissionDenied`` (DRF's base class or a subclass like
 * ``EditWindowExpired``) is shown a single generic top-level message
 * by the shared API error handler (``apps.core.api.exceptions``), by
 * design - it never leaks a specific denial reason through
 * ``error.message``. The original detail survives underneath, in
 * ``error.errors.detail`` (``normalizeApiError`` always preserves the
 * server's raw ``errors`` object alongside the sanitised message), so
 * that is what needs matching here, not ``error.message``.
 */
function isEditWindowExpired(error) {
  return Boolean(
    error?.errors?.detail?.includes("48 hours"),
  );
}

function RequestEditAccessBlock({
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
  onDelete,
  deleteStatus,
  onRequestEditAccess,
  requestEditAccessStatus,
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

          {canEdit &&
          onRequestEditAccess &&
          isEditWindowExpired(error) ? (
            <RequestEditAccessBlock
              activityId={activity.id}
              onRequestEditAccess={onRequestEditAccess}
              requestEditAccessStatus={
                requestEditAccessStatus
              }
            />
          ) : null}

          {canEdit && onDelete ? (
            <div className="pm-update-panel__danger">
              <button
                type="button"
                className="button button--danger-ghost"
                disabled={deleteStatus?.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Hide "${activity.name}" from this sheet? Its history is kept, and it can be shown again from "+ Add activity".`,
                    )
                  ) {
                    onDelete();
                  }
                }}
              >
                {deleteStatus?.isPending
                  ? "Hiding..."
                  : "Hide this activity"}
              </button>
              {deleteStatus?.isError ? (
                <div className="inline-alert inline-alert--error">
                  {deleteStatus.error.message}
                </div>
              ) : null}
              {canEdit &&
              onRequestEditAccess &&
              isEditWindowExpired(deleteStatus?.error) ? (
                <RequestEditAccessBlock
                  activityId={activity.id}
                  onRequestEditAccess={onRequestEditAccess}
                  requestEditAccessStatus={
                    requestEditAccessStatus
                  }
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
