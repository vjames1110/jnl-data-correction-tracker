import clsx from "clsx";
import {
  AlertTriangle,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { ActivityDetailPanel } from "./ActivityDetailPanel";
import { ActivityPopup } from "./ActivityPopup";
import {
  ActivityRowTools,
  ActivityToolPopup,
} from "./ActivityRowTools";
import { ActivityStatusChip } from "./ActivityStatusChip";
import { TargetDateHistory } from "./ActivityTimeline";

function ItemFieldsEditForm({
  item,
  onSave,
  onCancel,
  isPending,
}) {
  const [responsibility, setResponsibility] =
    useState(item.responsibility);
  const [remarks, setRemarks] = useState(
    item.remarks,
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ responsibility, remarks });
  };

  return (
    <form
      className="pm-drawer-form"
      onSubmit={handleSubmit}
    >
      <label className="form-field">
        <span>Responsibility</span>
        <input
          type="text"
          value={responsibility}
          onChange={(event) =>
            setResponsibility(
              event.target.value,
            )
          }
        />
      </label>
      <label className="form-field pm-drawer-form__full">
        <span>Remarks</span>
        <input
          type="text"
          value={remarks}
          onChange={(event) =>
            setRemarks(event.target.value)
          }
        />
      </label>
      <div className="pm-inline-row pm-drawer-form__full">
        <button
          type="submit"
          className="button button--primary"
          disabled={isPending}
        >
          Save
        </button>
        <button
          type="button"
          className="button button--tertiary"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ItemFieldsSummary({
  item,
  canEdit,
  onEdit,
}) {
  return (
    <div className="pm-action-item__fields">
      <span>
        <strong>Responsibility:</strong>{" "}
        {item.responsibility || "Not assigned"}
      </span>
      <span>
        <strong>Remarks:</strong>{" "}
        {item.remarks || "-"}
      </span>
      {canEdit ? (
        <button
          type="button"
          className="button button--tertiary"
          onClick={onEdit}
        >
          Edit responsibility / remarks
        </button>
      ) : null}
    </div>
  );
}

/**
 * One Open or Completed table of Action Items - the plainest use of
 * the shared Activity engine, so this reuses ``ActivityDetailPanel``
 * (with ``showProgress={false}``, since Action Items track no qty/
 * %) for the meeting-update form, and adds only what Action Items
 * have that other sections don't: a Responsibility column, an
 * overdue flag, an editable persistent-remarks box, and (for
 * completed items) a Re-open shortcut. Clicking a row opens all of
 * that in a popup beside it, like every other task in Project
 * Monitor (see ``ActivityPopup``); the Action History and review
 * sign-off are icon buttons at the end of the row (see
 * ``ActivityRowTools``).
 */
export function ActionItemTable({
  items,
  emptyMessage,
  canEdit,
  activeActivityId,
  onSelectActivity,
  onSubmitUpdate,
  updateStatus,
  onReviewActivity,
  reviewActivityStatus,
  onUpdateItem,
  updateItemStatus,
  onDeleteItem,
  onReopen,
  isCompletedTable = false,
}) {
  const [editingItemId, setEditingItemId] =
    useState(null);
  const [clickX, setClickX] = useState(undefined);
  const [tool, setTool] = useState(null);

  if (items.length === 0) {
    return (
      <p className="pm-timeline-empty">
        {emptyMessage}
      </p>
    );
  }

  const activeItem = items.find(
    (item) =>
      item.activity &&
      item.activity.id === activeActivityId,
  );
  const toolItem = tool
    ? items.find(
        (item) => item.activity && item.activity.id === tool.id,
      )
    : null;
  const close = () => {
    setEditingItemId(null);
    onSelectActivity(null);
  };
  const openTool = (id, kind) => {
    close();
    setTool(kind ? { id, kind } : null);
  };

  return (
    <div className="pm-table-wrap">
      <table className="pm-activity-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Responsibility</th>
            <th>Status</th>
            <th>Target date</th>
            <th className="pm-tools-head">History / Review</th>
            {canEdit ? <th></th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const activity = item.activity;
            const isActive =
              Boolean(activity) &&
              activity.id === activeActivityId;
            return (
              <tr
                key={item.id}
                data-activity-row={activity?.id}
                className={clsx(
                  activity?.status === "COMPLETE" &&
                    "pm-row--done",
                  isActive && "pm-row--expanded",
                )}
                onClick={(event) => {
                  setClickX(event.clientX);
                  setTool(null);
                  setEditingItemId(null);
                  onSelectActivity(
                    isActive ? null : activity?.id,
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
                    {activity?.name}
                  </button>
                  {item.is_overdue ? (
                    <AlertTriangle
                      size={13}
                      className="pm-overdue-icon"
                      aria-label="Overdue"
                    />
                  ) : null}
                </td>
                <td>{item.responsibility || "-"}</td>
                <td>
                  <ActivityStatusChip activity={activity} />
                </td>
                <td>
                  <TargetDateHistory activity={activity} />
                </td>
                <td className="pm-tools-cell">
                  {activity ? (
                    <ActivityRowTools
                      activity={activity}
                      openTool={
                        tool?.id === activity.id ? tool.kind : null
                      }
                      onOpenTool={(kind) =>
                        openTool(activity.id, kind)
                      }
                    />
                  ) : null}
                </td>
                {canEdit ? (
                  <td>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteItem(item.id);
                      }}
                      aria-label="Delete action item"
                      title="Delete this action item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>

      {activeItem ? (
        <ActivityPopup
          key={activeItem.activity.id}
          anchorId={activeItem.activity.id}
          anchorX={clickX}
          label={`${activeItem.activity.name} - update`}
          width={540}
          onClose={close}
        >
          {isCompletedTable && canEdit ? (
            <div className="pm-inline-row pm-action-item__reopen">
              <button
                type="button"
                className="button button--secondary"
                onClick={() =>
                  onReopen(activeItem.activity.id)
                }
              >
                <RotateCcw size={14} /> Re-open
              </button>
            </div>
          ) : null}

          {editingItemId === activeItem.id ? (
            <ItemFieldsEditForm
              item={activeItem}
              isPending={updateItemStatus?.isPending}
              onSave={(payload) =>
                onUpdateItem(activeItem.id, payload, {
                  onSuccess: () => setEditingItemId(null),
                })
              }
              onCancel={() => setEditingItemId(null)}
            />
          ) : (
            <ItemFieldsSummary
              item={activeItem}
              canEdit={canEdit}
              onEdit={() => setEditingItemId(activeItem.id)}
            />
          )}

          <ActivityDetailPanel
            activity={activeItem.activity}
            groupTitle="Action item"
            canEdit={canEdit}
            showProgress={false}
            onClose={close}
            // Saving closes the popup once the server has accepted it.
            onSubmitUpdate={(payload) =>
              onSubmitUpdate(activeItem.activity.id, payload, {
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

      {toolItem ? (
        <ActivityToolPopup
          tool={tool.kind}
          activity={toolItem.activity}
          onClose={() => setTool(null)}
          onReview={(remarks, options) =>
            onReviewActivity(
              toolItem.activity.id,
              remarks,
              options,
            )
          }
          reviewStatus={reviewActivityStatus}
        />
      ) : null}
    </div>
  );
}
