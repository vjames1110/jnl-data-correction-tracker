import { X } from "lucide-react";

import { formatDate } from "../utils/status";
import {
  ActivityStatusChip,
  MaterialStatusBadge,
} from "./ActivityStatusChip";
import { ActivityUpdateForm } from "./ActivityUpdateForm";

/**
 * The content of the popup that opens beside a task when it is
 * clicked (see ActivityPopup): the task's name and status, and the
 * update form for anyone who can edit. It is deliberately small - the
 * task's Action History and review sign-off are icon buttons on its
 * table row (see ActivityRowTools), not part of this box.
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
}) {
  return (
    <div className="pm-update-panel">
      <div className="pm-update-panel__head">
        <div className="pm-update-panel__title">
          <span className="page-eyebrow">{groupTitle}</span>
          <h4>{activity.name}</h4>
        </div>
        <div className="pm-update-panel__chips">
          <ActivityStatusChip activity={activity} />
          <MaterialStatusBadge activity={activity} />
        </div>
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

      {activity.status === "COMPLETE" && activity.completed_on ? (
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
    </div>
  );
}
