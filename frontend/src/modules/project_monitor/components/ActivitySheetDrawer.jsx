import { X } from "lucide-react";

import { ActivityDetailPanel } from "./ActivityDetailPanel";
import { ActivityProgressBar } from "./ActivityProgressBar";
import {
  ActivityStatusChip,
  MaterialStatusBadge,
} from "./ActivityStatusChip";
import { TargetDateHistory } from "./ActivityTimeline";

/**
 * The generic "click a structure/building, see its full activity
 * sheet in a side drawer, click a row for its update form + full
 * history" panel - shared by Structures and Buildings, since once
 * an item has ``groups``/``overall_progress`` (see
 * ``ActivityGroupedSerializerMixin`` on the backend) the drawer's
 * body is identical either way.
 */
export function ActivitySheetDrawer({
  item,
  eyebrow,
  metaLine,
  backLabel,
  activeActivityId,
  onSelectActivity,
  canEdit,
  onClose,
  onSubmitUpdate,
  updateStatus,
}) {
  if (!item) {
    return null;
  }

  const activeGroup = activeActivityId
    ? item.groups.find((group) =>
        group.rows.some(
          (row) => row.id === activeActivityId,
        ),
      )
    : null;
  const activeActivity = activeGroup
    ? activeGroup.rows.find(
        (row) => row.id === activeActivityId,
      )
    : null;

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

      {activeActivity ? (
        <ActivityDetailPanel
          activity={activeActivity}
          groupTitle={
            activeGroup.group_title
          }
          canEdit={canEdit}
          backLabel={backLabel}
          onBack={() =>
            onSelectActivity(null)
          }
          onSubmitUpdate={(payload) =>
            onSubmitUpdate(
              activeActivity.id,
              payload,
            )
          }
          isPending={updateStatus.isPending}
          error={
            updateStatus.isError
              ? updateStatus.error
              : null
          }
        />
      ) : (
        <>
          {item.description ? (
            <p className="sub">
              {item.description}
            </p>
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
                    {group.rows.map((row) => (
                      <tr
                        key={row.id}
                        className={
                          row.status ===
                          "COMPLETE"
                            ? "pm-row--done"
                            : ""
                        }
                        onClick={() =>
                          onSelectActivity(
                            row.id,
                          )
                        }
                      >
                        <td>{row.name}</td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </aside>
  );
}
