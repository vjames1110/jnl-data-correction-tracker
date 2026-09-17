import clsx from "clsx";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Fragment, useRef, useState } from "react";

import { useOutsideClick } from "../../../hooks/useOutsideClick";
import { ActivityDetailPanel } from "./ActivityDetailPanel";
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
 * %) for the expanded meeting-update form and review sign-off, and
 * adds only what Action Items have that other sections don't: a
 * Responsibility column, an overdue flag, an editable persistent-
 * remarks box, and (for completed items) a Re-open shortcut.
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
  const tableRef = useRef(null);
  useOutsideClick(
    tableRef,
    Boolean(activeActivityId),
    () => onSelectActivity(null),
  );

  if (items.length === 0) {
    return (
      <p className="pm-timeline-empty">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div
      className="pm-table-wrap"
      ref={tableRef}
    >
      <table className="pm-activity-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Responsibility</th>
            <th>Status</th>
            <th>Target date</th>
            {canEdit ? <th></th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const activity = item.activity;
            const isExpanded =
              Boolean(activity) &&
              activity.id === activeActivityId;
            return (
              <Fragment key={item.id}>
                <tr
                  className={clsx(
                    activity?.status ===
                      "COMPLETE" &&
                      "pm-row--done",
                    isExpanded &&
                      "pm-row--expanded",
                  )}
                  onClick={() =>
                    onSelectActivity(
                      isExpanded
                        ? null
                        : activity?.id,
                    )
                  }
                >
                  <td className="pm-activity-name-cell">
                    {isExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight
                        size={14}
                      />
                    )}
                    {activity?.name}
                    {item.is_overdue ? (
                      <AlertTriangle
                        size={13}
                        className="pm-overdue-icon"
                        aria-label="Overdue"
                      />
                    ) : null}
                  </td>
                  <td>
                    {item.responsibility ||
                      "-"}
                  </td>
                  <td>
                    <ActivityStatusChip
                      activity={activity}
                    />
                  </td>
                  <td>
                    <TargetDateHistory
                      activity={activity}
                    />
                  </td>
                  {canEdit ? (
                    <td>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteItem(
                            item.id,
                          );
                        }}
                        aria-label="Delete action item"
                        title="Delete this action item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  ) : null}
                </tr>
                {isExpanded ? (
                  <tr className="pm-expand-row">
                    <td
                      colSpan={
                        canEdit ? 5 : 4
                      }
                    >
                      {isCompletedTable &&
                      canEdit ? (
                        <div className="pm-inline-row pm-action-item__reopen">
                          <button
                            type="button"
                            className="button button--secondary"
                            onClick={() =>
                              onReopen(
                                activity.id,
                              )
                            }
                          >
                            <RotateCcw
                              size={14}
                            />{" "}
                            Re-open
                          </button>
                        </div>
                      ) : null}

                      {editingItemId ===
                      item.id ? (
                        <ItemFieldsEditForm
                          item={item}
                          isPending={
                            updateItemStatus?.isPending
                          }
                          onSave={(
                            payload,
                          ) =>
                            onUpdateItem(
                              item.id,
                              payload,
                              {
                                onSuccess:
                                  () =>
                                    setEditingItemId(
                                      null,
                                    ),
                              },
                            )
                          }
                          onCancel={() =>
                            setEditingItemId(
                              null,
                            )
                          }
                        />
                      ) : (
                        <ItemFieldsSummary
                          item={item}
                          canEdit={canEdit}
                          onEdit={() =>
                            setEditingItemId(
                              item.id,
                            )
                          }
                        />
                      )}

                      <ActivityDetailPanel
                        activity={activity}
                        groupTitle="Action item"
                        canEdit={canEdit}
                        showProgress={false}
                        onSubmitUpdate={(
                          payload,
                        ) =>
                          onSubmitUpdate(
                            activity.id,
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
                            activity.id,
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
  );
}
