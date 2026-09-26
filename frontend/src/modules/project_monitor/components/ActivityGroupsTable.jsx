import clsx from "clsx";
import { useState } from "react";

import { bandClasses, rowBands } from "../utils/rowBands";
import { ActivityDetailPanel } from "./ActivityDetailPanel";
import { ActivityPopup } from "./ActivityPopup";
import { ActivityProgressBar } from "./ActivityProgressBar";
import {
  ActivityRowTools,
  ActivityToolPopup,
} from "./ActivityRowTools";
import {
  ActivityStatusChip,
  MaterialStatusBadge,
} from "./ActivityStatusChip";
import { TargetDateHistory } from "./ActivityTimeline";

/**
 * Renders a list of activity ``groups`` (the shape shared by every
 * Project Monitor sheet - Structures, Buildings, Girders' bridge-
 * level GAD row, and each Girder span's own chains) as one table per
 * group.
 *
 * Clicking a task anywhere on its row opens a small, wide popup beside
 * it with just that task's update form (see ``ActivityPopup``); saving
 * closes it. Each row ends with two icon buttons - its Action History
 * and its review sign-off - each opening its own small popup (see
 * ``ActivityRowTools``). Rows that repeat per span ("S1 - ...",
 * "S2 - ...") are banded so each span reads as its own block.
 * Extracted out of ``ActivityWorkspace`` so Girders can render this
 * same table more than once per bridge (once for the GAD row, once
 * per span) without duplicating the row logic.
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
  // Where the last click landed, so the popup can line up with it.
  const [clickX, setClickX] = useState(undefined);
  // The row whose Action History / review popup is open, if any.
  const [tool, setTool] = useState(null);

  const findRow = (id) => {
    let found = null;
    groups.forEach((group) => {
      group.rows.forEach((row) => {
        if (row.id === id) {
          found = { row, group };
        }
      });
    });
    return found;
  };
  const active = findRow(activeActivityId);
  const toolRow = tool ? findRow(tool.id) : null;

  const close = () => onSelectActivity(null);

  const openTool = (id, kind) => {
    onSelectActivity(null);
    setTool(kind ? { id, kind } : null);
  };

  return (
    <>
      {groups.map((group) => {
        const bands = rowBands(group.rows);
        return (
          <div
            className="pm-group"
            key={`${group.group_order}-${group.group_title}`}
          >
            <div className="pm-group__header">
              <strong>{group.group_title}</strong>
              {group.group_subtitle ? (
                <span>{group.group_subtitle}</span>
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
                    <th className="pm-tools-head">
                      History / Review
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, index) => {
                    const isActive = row.id === activeActivityId;
                    return (
                      <tr
                        key={row.id}
                        data-activity-row={row.id}
                        className={clsx(
                          bandClasses(bands[index]),
                          row.status === "COMPLETE" &&
                            "pm-row--done",
                          isActive && "pm-row--expanded",
                        )}
                        onClick={(event) => {
                          setClickX(event.clientX);
                          setTool(null);
                          onSelectActivity(
                            isActive ? null : row.id,
                          );
                        }}
                      >
                        <td className="pm-activity-name-cell">
                          <button
                            type="button"
                            className="pm-activity-name-button"
                            aria-haspopup="dialog"
                            aria-expanded={isActive}
                          >
                            {row.name}
                          </button>
                        </td>
                        <td>
                          <ActivityProgressBar activity={row} />
                        </td>
                        <td>
                          <ActivityStatusChip activity={row} />
                          <div>
                            <MaterialStatusBadge activity={row} />
                          </div>
                        </td>
                        <td>
                          <TargetDateHistory activity={row} />
                        </td>
                        <td className="pm-tools-cell">
                          <ActivityRowTools
                            activity={row}
                            openTool={
                              tool?.id === row.id
                                ? tool.kind
                                : null
                            }
                            onOpenTool={(kind) =>
                              openTool(row.id, kind)
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {active ? (
        <ActivityPopup
          key={active.row.id}
          anchorId={active.row.id}
          anchorX={clickX}
          label={`${active.row.name} - update`}
          width={680}
          onClose={close}
        >
          <ActivityDetailPanel
            activity={active.row}
            groupTitle={active.group.group_title}
            canEdit={canEdit}
            onClose={close}
            // Saving closes the popup once the server has accepted it;
            // a refused save leaves it open with the error.
            onSubmitUpdate={(payload) =>
              onSubmitUpdate(active.row.id, payload, {
                onSuccess: close,
              })
            }
            isPending={updateStatus.isPending}
            error={
              updateStatus.isError ? updateStatus.error : null
            }
          />
        </ActivityPopup>
      ) : null}

      {toolRow ? (
        <ActivityToolPopup
          tool={tool.kind}
          activity={toolRow.row}
          onClose={() => setTool(null)}
          onReview={(remarks, options) =>
            onReviewActivity(toolRow.row.id, remarks, options)
          }
          reviewStatus={reviewActivityStatus}
        />
      ) : null}
    </>
  );
}
