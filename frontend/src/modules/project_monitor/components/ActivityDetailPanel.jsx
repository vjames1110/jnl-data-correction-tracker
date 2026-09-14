import { ChevronLeft } from "lucide-react";

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

export function ActivityDetailPanel({
  activity,
  groupTitle,
  canEdit,
  backLabel = "structure",
  onBack,
  onSubmitUpdate,
  isPending,
  error,
}) {
  return (
    <div>
      <button
        type="button"
        className="pm-back-link"
        onClick={onBack}
      >
        <ChevronLeft size={14} /> Back to{" "}
        {backLabel}
      </button>

      <div className="pm-activity-detail__header">
        <div>
          <span className="page-eyebrow">
            {groupTitle}
          </span>
          <h2>{activity.name}</h2>
        </div>
        <div style={{ textAlign: "right" }}>
          <ActivityStatusChip
            activity={activity}
          />
          <div>
            <MaterialStatusBadge
              activity={activity}
            />
          </div>
        </div>
      </div>

      <div style={{ margin: "10px 0" }}>
        <ActivityProgressBar activity={activity} />
      </div>

      <dl className="details-list">
        <div>
          <dt>
            {activity.is_doc
              ? "Approval date"
              : "Target date"}
          </dt>
          <dd>
            <TargetDateHistory
              activity={activity}
            />
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

      {canEdit ? (
        <>
          <h3 style={{ marginTop: 16 }}>
            Update this meeting
          </h3>
          <ActivityUpdateForm
            activity={activity}
            onSubmit={onSubmitUpdate}
            isPending={isPending}
            error={error}
          />
        </>
      ) : null}

      <h3 style={{ marginTop: 16 }}>
        Meeting-wise history
      </h3>
      <ActivityTimeline activity={activity} />
    </div>
  );
}
