import {
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  MessageSquareText,
  X,
} from "lucide-react";
import { useState } from "react";

import { formatDate } from "../utils/status";
import { ActivityPopup } from "./ActivityPopup";
import { ActivityTimeline } from "./ActivityTimeline";

/**
 * The two small icon buttons at the end of a task's row: its Action
 * History and its review sign-off. Each icon changes once there is
 * something behind it - an empty speech bubble becomes one with text
 * lines when a meeting update has been logged, a grey checklist becomes
 * a green seal once someone has reviewed the task - so a glance down
 * the column shows what has been worked on. (No counts: the number of
 * updates is in the history itself.) Each opens its own small popup
 * beside the button - see ``ActivityToolPopup`` - so neither crowds the
 * update popup. A press here never opens the update popup.
 */
export function ActivityRowTools({
  activity,
  openTool,
  onOpenTool,
}) {
  const hasHistory = (activity.comments || []).length > 0;
  const isReviewed = Boolean(activity.reviewed_at);

  const toggle = (kind) => (event) => {
    event.stopPropagation();
    onOpenTool(openTool === kind ? null : kind);
  };

  return (
    <div className="pm-row-tools">
      <button
        type="button"
        className={
          hasHistory
            ? "pm-tool-button pm-tool-button--has-history"
            : "pm-tool-button"
        }
        data-popup-anchor={`history:${activity.id}`}
        aria-haspopup="dialog"
        aria-expanded={openTool === "history"}
        aria-label={`Action history for ${activity.name}`}
        title={
          hasHistory
            ? "Action history"
            : "Action history - nothing logged yet"
        }
        onClick={toggle("history")}
      >
        {hasHistory ? (
          <MessageSquareText size={17} />
        ) : (
          <MessageSquare size={17} />
        )}
      </button>
      <button
        type="button"
        className={
          isReviewed
            ? "pm-tool-button pm-tool-button--reviewed"
            : "pm-tool-button"
        }
        data-popup-anchor={`review:${activity.id}`}
        aria-haspopup="dialog"
        aria-expanded={openTool === "review"}
        aria-label={
          isReviewed
            ? `Reviewed by ${activity.reviewed_by_name || "someone"} on ${formatDate(activity.reviewed_at)}`
            : `Mark ${activity.name} as reviewed`
        }
        title={
          isReviewed
            ? `Reviewed by ${activity.reviewed_by_name || "someone"}`
            : "Not yet reviewed"
        }
        onClick={toggle("review")}
      >
        {isReviewed ? (
          <BadgeCheck size={17} />
        ) : (
          <ClipboardCheck size={17} />
        )}
      </button>
    </div>
  );
}

function ToolHeader({ eyebrow, title, onClose }) {
  return (
    <div className="pm-update-panel__head">
      <div className="pm-update-panel__title">
        <span className="page-eyebrow">{eyebrow}</span>
        <h4>{title}</h4>
      </div>
      <button
        type="button"
        className="icon-button pm-popup__close"
        aria-label="Close"
        onClick={onClose}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function ReviewBody({ activity, onReview, reviewStatus, onClose }) {
  const [remarks, setRemarks] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    onReview(remarks, { onSuccess: onClose });
  };

  return (
    <>
      {activity.reviewed_at ? (
        <p className="pm-review-block__status">
          <CheckCircle2 size={13} />
          Reviewed by {activity.reviewed_by_name || "someone"} on{" "}
          {formatDate(activity.reviewed_at)}
          {activity.review_remarks
            ? ` - "${activity.review_remarks}"`
            : ""}
        </p>
      ) : (
        <p className="pm-review-block__status pm-review-block__status--none">
          Not yet reviewed.
        </p>
      )}
      <form className="pm-review-form" onSubmit={handleSubmit}>
        <input
          type="text"
          aria-label="Review remark"
          placeholder="Remark (optional)"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
        />
        <button
          type="submit"
          className="button button--primary button--sm"
          disabled={reviewStatus?.isPending}
        >
          <CheckCircle2 size={14} />{" "}
          {activity.reviewed_at
            ? "Review again"
            : "Mark as reviewed"}
        </button>
      </form>
      {reviewStatus?.isError ? (
        <div className="inline-alert inline-alert--error">
          {reviewStatus.error?.message}
        </div>
      ) : null}
    </>
  );
}

/**
 * The small popup for one of a task's icon buttons: ``"history"`` lists
 * every meeting update with who made it and when; ``"review"`` shows who
 * reviewed the task and lets anyone with access sign it off (which also
 * closes the popup).
 */
export function ActivityToolPopup({
  tool,
  activity,
  onClose,
  onReview,
  reviewStatus,
}) {
  const isHistory = tool === "history";

  return (
    <ActivityPopup
      key={`${tool}:${activity.id}`}
      anchorId={`${tool}:${activity.id}`}
      label={`${isHistory ? "Action history" : "Review"} - ${activity.name}`}
      width={400}
      onClose={onClose}
    >
      <ToolHeader
        eyebrow={isHistory ? "Action history" : "Review"}
        title={activity.name}
        onClose={onClose}
      />
      {isHistory ? (
        <ActivityTimeline activity={activity} />
      ) : (
        <ReviewBody
          activity={activity}
          onReview={onReview}
          reviewStatus={reviewStatus}
          onClose={onClose}
        />
      )}
    </ActivityPopup>
  );
}
