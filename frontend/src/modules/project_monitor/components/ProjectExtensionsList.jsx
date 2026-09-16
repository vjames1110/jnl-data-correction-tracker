import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { formatDate } from "../utils/status";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The project's contract-extension history (E1, E2, E3... in the
 * order the backend already returns them, per
 * ``ProjectExtension.Meta.ordering``) plus, for Project Manager/
 * Admin, an inline form to record a new one - new end date + a
 * reason, so the schedule's history stays auditable rather than a
 * silently-overwritten date.
 */
export function ProjectExtensionsList({
  extensions,
  canEdit,
  onAddExtension,
  addExtensionStatus,
  onDeleteExtension,
}) {
  const [isFormOpen, setIsFormOpen] =
    useState(false);
  const [newEndDate, setNewEndDate] = useState(
    todayIso(),
  );
  const [reason, setReason] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    onAddExtension(
      {
        new_end_date: newEndDate,
        reason,
      },
      {
        onSuccess: () => {
          setIsFormOpen(false);
          setReason("");
        },
      },
    );
  };

  return (
    <div className="pm-extensions">
      <div className="surface-card__header">
        <h2>Extensions</h2>
        {canEdit && !isFormOpen ? (
          <button
            type="button"
            className="button button--tertiary"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus size={14} /> Add extension
          </button>
        ) : null}
      </div>

      {extensions.length === 0 ? (
        <p className="pm-timeline-empty">
          No extensions recorded yet.
        </p>
      ) : (
        <table className="pm-extensions__table">
          <thead>
            <tr>
              <th></th>
              <th>New end date</th>
              <th>Reason</th>
              <th>Recorded by</th>
              {canEdit ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {extensions.map(
              (extension, index) => (
                <tr key={extension.id}>
                  <td>E{index + 1}</td>
                  <td>
                    {formatDate(
                      extension.new_end_date,
                    )}
                  </td>
                  <td>
                    {extension.reason || "-"}
                  </td>
                  <td>
                    {extension.created_by_name ||
                      "-"}
                  </td>
                  {canEdit ? (
                    <td>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        onClick={() =>
                          onDeleteExtension(
                            extension.id,
                          )
                        }
                        aria-label="Delete extension"
                        title="Delete this extension record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      {isFormOpen ? (
        <form
          className="pm-inline-row"
          onSubmit={handleSubmit}
        >
          <label className="filter-control">
            <span>New end date</span>
            <input
              type="date"
              value={newEndDate}
              onChange={(event) =>
                setNewEndDate(
                  event.target.value,
                )
              }
              required
            />
          </label>
          <label className="filter-control">
            <span>Reason</span>
            <input
              type="text"
              value={reason}
              onChange={(event) =>
                setReason(event.target.value)
              }
              placeholder="e.g. Land acquisition delay"
            />
          </label>
          <button
            type="submit"
            className="button button--primary"
            disabled={
              addExtensionStatus?.isPending
            }
          >
            Save
          </button>
          <button
            type="button"
            className="button button--tertiary"
            onClick={() =>
              setIsFormOpen(false)
            }
          >
            Cancel
          </button>
          {addExtensionStatus?.isError ? (
            <div className="inline-alert inline-alert--error pm-drawer-form__full">
              {
                addExtensionStatus.error
                  ?.message
              }
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
