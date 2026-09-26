import clsx from "clsx";
import { AlertTriangle, BadgeCheck } from "lucide-react";
import { useMemo, useState } from "react";

import {
  buildMatrix,
  cellDetail,
  cellProgress,
  tableProgress,
} from "../utils/activityMatrix";
import {
  STATUS_LABELS,
  statusClass,
  statusLabel,
} from "../utils/status";
import { ActivityDetailPanel } from "./ActivityDetailPanel";
import { ActivityPopup } from "./ActivityPopup";
import { WorkspaceSwitch } from "./WorkspaceSwitch";

const LEGEND = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETE",
  "HOLD",
  "NOT_APPLICABLE",
];

/** The colour plan, once above a matrix. */
function MatrixLegend() {
  return (
    <ul className="pm-matrix-legend" aria-label="Colour key">
      {LEGEND.map((status) => (
        <li key={status}>
          <span
            className={`pm-matrix-legend__swatch pm-cell--${statusClass(status)}`}
            aria-hidden="true"
          />
          {STATUS_LABELS[status]}
        </li>
      ))}
    </ul>
  );
}

function cellLabel(activity) {
  const detail = cellDetail(activity);
  const notes = [
    detail,
    activity.is_hindrance ? "blocked by a hindrance" : "",
    activity.reviewed_at ? "reviewed" : "",
  ].filter(Boolean);
  return `${activity.name}: ${statusLabel(activity)}${
    notes.length ? `, ${notes.join(", ")}` : ""
  }`;
}

/**
 * One activity as a coloured status cell. Its colour is its status
 * (red not taken up, amber in progress, green complete, orange hold,
 * grey not applicable); an in-progress cell also shows how far along it
 * is. Pressing it opens the update popup.
 */
function MatrixCell({ activity, isActive, onOpen }) {
  const detail = cellDetail(activity);
  const progress = cellProgress(activity);

  return (
    <button
      type="button"
      className={clsx(
        "pm-cell",
        `pm-cell--${statusClass(activity.status)}`,
        isActive && "pm-cell--active",
      )}
      data-activity-row={activity.id}
      aria-haspopup="dialog"
      aria-expanded={isActive}
      aria-label={cellLabel(activity)}
      title={activity.name}
      onClick={onOpen}
    >
      <span className="pm-cell__marks" aria-hidden="true">
        {activity.reviewed_at ? <BadgeCheck size={12} /> : null}
        {activity.is_hindrance ? <AlertTriangle size={12} /> : null}
      </span>
      <span className="pm-cell__status">
        {statusLabel(activity)}
      </span>
      {detail ? (
        <span className="pm-cell__detail">{detail}</span>
      ) : null}
      {progress > 0 ? (
        <span className="pm-cell__bar" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </span>
      ) : null}
    </button>
  );
}

function MatrixTable({ table, activeActivityId, onOpen }) {
  return (
    <div className="pm-matrix-block">
      {table.subcaption ? (
        <p className="pm-matrix-block__caption">
          {table.subcaption}
        </p>
      ) : null}
      <div className="pm-matrix-wrap">
        <table className="pm-matrix" aria-label={table.title}>
          <thead>
            <tr>
              <th scope="col" className="pm-matrix__corner">
                {table.lines.length > 1 ? "Element" : null}
              </th>
              {table.columns.map((column, index) => (
                <th
                  key={`${column.key}-${index}`}
                  scope="col"
                  className="pm-matrix__colhead"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.lines.map((line) => (
              <tr key={line.key}>
                <th scope="row" className="pm-matrix__rowhead">
                  <strong>{line.label}</strong>
                  {line.sublabel ? (
                    <span>{line.sublabel}</span>
                  ) : null}
                </th>
                {line.cells.map((activity, index) => (
                  <td
                    key={activity?.id ?? `empty-${index}`}
                    className="pm-matrix__cell"
                  >
                    {activity ? (
                      <MatrixCell
                        activity={activity}
                        isActive={activity.id === activeActivityId}
                        onOpen={(event) => onOpen(activity, event)}
                      />
                    ) : (
                      <span
                        className="pm-cell pm-cell--empty"
                        aria-hidden="true"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * A sheet's activity ``groups`` (the shape shared by Structures,
 * Buildings and Girders) as horizontal status matrices - see
 * ``buildMatrix`` for how they are laid out. The sheet's sections
 * (Approvals, Abutments, Piers ...) are buttons across the top, each
 * with how much of it is done; the chosen one shows its matrix. A
 * sheet with a single section skips the buttons.
 *
 * Every activity is a coloured cell. Pressing one opens a small popup
 * beside it (see ``ActivityPopup``) holding its update form, with its
 * Action History and review sign-off as icons in the popup's corner;
 * saving closes the popup and the cell then shows the new status.
 */
export function ActivityMatrix({
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
  const [selectedKey, setSelectedKey] = useState(null);

  const tables = useMemo(() => buildMatrix(groups), [groups]);

  if (!tables.length) {
    return (
      <p className="pm-timeline-empty">No tasks on this sheet.</p>
    );
  }

  let active = null;
  groups.forEach((group) => {
    group.rows.forEach((row) => {
      if (row.id === activeActivityId) {
        active = { row, group };
      }
    });
  });

  const close = () => onSelectActivity(null);

  const selected =
    tables.find((table) => table.key === selectedKey) ?? tables[0];

  return (
    <div className="pm-matrix-stack">
      {tables.length > 1 ? (
        <WorkspaceSwitch
          label="Sections"
          value={selected.key}
          onChange={(key) => {
            setSelectedKey(key);
            // An open popup belongs to the section being left.
            close();
          }}
          options={tables.map((table) => {
            const { done, total } = tableProgress(table);
            return {
              key: table.key,
              label: table.title,
              badge: `${done}/${total}`,
            };
          })}
        />
      ) : null}

      <MatrixLegend />

      <MatrixTable
        key={selected.key}
        table={selected}
        activeActivityId={activeActivityId}
        onOpen={(activity, event) => {
          setClickX(event.clientX);
          onSelectActivity(
            activity.id === activeActivityId ? null : activity.id,
          );
        }}
      />

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
            onReview={(remarks, options) =>
              onReviewActivity(active.row.id, remarks, options)
            }
            reviewStatus={reviewActivityStatus}
          />
        </ActivityPopup>
      ) : null}
    </div>
  );
}
