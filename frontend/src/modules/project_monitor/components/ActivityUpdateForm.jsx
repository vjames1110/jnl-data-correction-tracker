import { useState } from "react";

import {
  formatQty,
  MATERIAL_STATUS_LABELS,
  STATUS_LABELS,
} from "../utils/status";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ActivityUpdateForm({
  activity,
  onSubmit,
  isPending,
  error,
}) {
  const [meetingDate, setMeetingDate] = useState(
    todayIso(),
  );
  const [targetDate, setTargetDate] = useState(
    activity.current_target_date || "",
  );
  const [status, setStatus] = useState(
    activity.status,
  );
  const [doneQty, setDoneQty] = useState(
    formatQty(activity.done_qty ?? 0),
  );
  const [comment, setComment] = useState("");
  const [materialStatus, setMaterialStatus] =
    useState(
      activity.material_status || "NOT_ORDERED",
    );
  const [isHindrance, setIsHindrance] = useState(
    Boolean(activity.is_hindrance),
  );
  const [
    hindranceExpectedDate,
    setHindranceExpectedDate,
  ] = useState(
    activity.hindrance_expected_removal_date ||
      "",
  );
  const [
    hindranceActualDate,
    setHindranceActualDate,
  ] = useState(
    activity.hindrance_actual_removal_date || "",
  );
  const [
    hindranceRemarks,
    setHindranceRemarks,
  ] = useState(
    activity.hindrance_remarks || "",
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      meeting_date: meetingDate,
      new_target_date: targetDate || null,
      status,
      done_qty:
        doneQty === "" ? null : doneQty,
      comment,
      is_hindrance: isHindrance,
      hindrance_expected_removal_date:
        hindranceExpectedDate || null,
      hindrance_actual_removal_date:
        hindranceActualDate || null,
      hindrance_remarks: hindranceRemarks,
      ...(activity.material_tracked
        ? { material_status: materialStatus }
        : {}),
    });
    setComment("");
  };

  return (
    <form
      className="pm-drawer-form"
      onSubmit={handleSubmit}
    >
      <label className="filter-control">
        <span>Meeting date</span>
        <input
          type="date"
          value={meetingDate}
          onChange={(event) =>
            setMeetingDate(event.target.value)
          }
          required
        />
      </label>
      <label className="filter-control">
        <span>
          {activity.is_doc
            ? "Approval date (or expected)"
            : "Target date"}
        </span>
        <input
          type="date"
          value={targetDate}
          onChange={(event) =>
            setTargetDate(event.target.value)
          }
        />
      </label>
      <label className="filter-control">
        <span>Status</span>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
        >
          {Object.entries(STATUS_LABELS).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
      </label>
      <label className="filter-control">
        <span>
          {activity.kind === "LENGTH"
            ? `Done (${activity.unit || "qty"}) of ${formatQty(
                activity.total_qty,
              )}`
            : "% done"}
        </span>
        <input
          type="number"
          min="0"
          max={
            activity.kind === "LENGTH"
              ? undefined
              : 100
          }
          value={doneQty}
          onChange={(event) =>
            setDoneQty(event.target.value)
          }
        />
      </label>
      {activity.material_tracked ? (
        <label className="filter-control">
          <span>Material status</span>
          <select
            value={materialStatus}
            onChange={(event) =>
              setMaterialStatus(
                event.target.value,
              )
            }
          >
            {Object.entries(
              MATERIAL_STATUS_LABELS,
            ).map(([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="toggle-field pm-drawer-form__full">
        <input
          type="checkbox"
          checked={isHindrance}
          onChange={(event) =>
            setIsHindrance(
              event.target.checked,
            )
          }
        />
        <span>
          Blocked by Railways/Authority
          (hindrance)
        </span>
      </label>
      {isHindrance ? (
        <div className="pm-hindrance-fields pm-drawer-form__full">
          <div className="pm-drawer-form">
            <label className="filter-control">
              <span>
                Expected removal date
              </span>
              <input
                type="date"
                value={
                  hindranceExpectedDate
                }
                onChange={(event) =>
                  setHindranceExpectedDate(
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="filter-control">
              <span>
                Actual/final removal date
              </span>
              <input
                type="date"
                value={hindranceActualDate}
                onChange={(event) =>
                  setHindranceActualDate(
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="filter-control pm-drawer-form__full">
              <span>Hindrance remarks</span>
              <input
                type="text"
                value={hindranceRemarks}
                onChange={(event) =>
                  setHindranceRemarks(
                    event.target.value,
                  )
                }
                placeholder="e.g. Awaiting Railway block clearance"
              />
            </label>
          </div>
        </div>
      ) : null}
      <label className="filter-control pm-drawer-form__full">
        <span>Remark for this meeting</span>
        <input
          type="text"
          value={comment}
          onChange={(event) =>
            setComment(event.target.value)
          }
          placeholder="e.g. Shuttering in progress"
        />
      </label>
      <div className="pm-inline-row pm-drawer-form__full">
        <button
          type="submit"
          className="button button--primary"
          disabled={isPending}
        >
          Save update
        </button>
      </div>
      {error ? (
        <div className="inline-alert inline-alert--error pm-drawer-form__full">
          {error.message}
        </div>
      ) : null}
    </form>
  );
}
