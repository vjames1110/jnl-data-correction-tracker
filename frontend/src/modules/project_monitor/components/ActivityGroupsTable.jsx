import clsx from "clsx";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Fragment } from "react";

import { ActivityDetailPanel } from "./ActivityDetailPanel";
import { ActivityProgressBar } from "./ActivityProgressBar";
import {
  ActivityStatusChip,
  MaterialStatusBadge,
} from "./ActivityStatusChip";
import { TargetDateHistory } from "./ActivityTimeline";

/**
 * Renders a list of activity ``groups`` (the shape shared by every
 * Project Monitor sheet - Structures, Buildings, Girders' bridge-
 * level GAD row, and each Girder span's own chains) as one table per
 * group, with a chevron-driven inline-expand row for the update
 * form/review control - extracted out of ``ActivityWorkspace`` so
 * Girders can render this same table more than once per bridge (once
 * for the GAD row, once per span) without duplicating the row/expand
 * logic.
 */
export function ActivityGroupsTable({
  groups,
  activeActivityId,
  onSelectActivity,
  canEdit,
  onSubmitUpdate,
  updateStatus,
  onReviewActivity,
  reviewActivityStatus,
}) {
  return (
    <>
      {groups.map((group) => (
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
    </>
  );
}
