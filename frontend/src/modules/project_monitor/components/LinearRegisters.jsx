import { Trash2 } from "lucide-react";
import { Fragment, useState } from "react";

import { formatDate } from "../utils/status";
import { ActivityStatusChip } from "./ActivityStatusChip";

function EditProgressEntryForm({
  entry,
  onSave,
  onCancel,
  isPending,
}) {
  const [status, setStatus] = useState(
    entry.status,
  );
  const [contractor, setContractor] =
    useState(entry.contractor);
  const [remarks, setRemarks] = useState(
    entry.remarks,
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ status, contractor, remarks });
  };

  return (
    <form
      className="pm-inline-row"
      onSubmit={handleSubmit}
    >
      <select
        value={status}
        onChange={(event) =>
          setStatus(event.target.value)
        }
      >
        <option value="IN_PROGRESS">
          Ongoing
        </option>
        <option value="COMPLETE">
          Completed
        </option>
        <option value="HOLD">Hold</option>
      </select>
      <input
        type="text"
        value={contractor}
        onChange={(event) =>
          setContractor(event.target.value)
        }
        placeholder="Contractor"
      />
      <input
        type="text"
        value={remarks}
        onChange={(event) =>
          setRemarks(event.target.value)
        }
        placeholder="Remarks"
      />
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
    </form>
  );
}

/**
 * The Scope register - every patch on every item - one of the
 * prototype's own "two registers", distinct from both the diagram
 * and the day-wise pivot. Shown only on its own tab (see
 * ``LinearWorksPage``) rather than always alongside the diagram, so
 * it reads as a deliberate "view" rather than a wall of tables
 * competing with it for space.
 */
export function ScopeRegisterTable({
  items,
  canEdit,
  onDeleteScopePatch,
}) {
  const scopeRows = items.flatMap((item) =>
    item.scope_patches.map((patch) => ({
      item,
      patch,
    })),
  );

  return (
    <div className="pm-linear-registers">
      {scopeRows.length === 0 ? (
        <p className="pm-timeline-empty">
          No scope patches recorded yet.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table">
            <thead>
              <tr>
                <th>Item</th>
                <th>From (km)</th>
                <th>To (km)</th>
                <th>Qty</th>
                <th>Side</th>
                <th>Remarks</th>
                {canEdit ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {scopeRows.map(
                ({ item, patch }) => (
                  <tr key={patch.id}>
                    <td>{item.name}</td>
                    <td>
                      {
                        patch.from_chainage_km
                      }
                    </td>
                    <td>
                      {patch.to_chainage_km}
                    </td>
                    <td>{patch.qty}</td>
                    <td>{patch.side}</td>
                    <td>
                      {patch.remarks || "-"}
                    </td>
                    {canEdit ? (
                      <td>
                        <button
                          type="button"
                          className="icon-button icon-button--danger"
                          onClick={() =>
                            onDeleteScopePatch(
                              patch.id,
                            )
                          }
                          aria-label="Delete scope patch"
                        >
                          <Trash2
                            size={14}
                          />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * The Progress register - every entry on every item, newest first -
 * the prototype's other register, shown on its own tab for the same
 * reason the Scope register is (see ``ScopeRegisterTable`` above).
 */
export function ProgressRegisterTable({
  items,
  canEdit,
  onUpdateProgressEntry,
  updateProgressEntryStatus,
  onDeleteProgressEntry,
}) {
  const [editingEntryId, setEditingEntryId] =
    useState(null);

  const progressRows = items
    .flatMap((item) =>
      item.progress_entries.map((entry) => ({
        item,
        entry,
      })),
    )
    .sort(
      (a, b) =>
        b.entry.date.localeCompare(
          a.entry.date,
        ),
    );

  return (
    <div className="pm-linear-registers">
      {progressRows.length === 0 ? (
        <p className="pm-timeline-empty">
          No progress entries logged yet.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>From (km)</th>
                <th>To (km)</th>
                <th>Qty</th>
                <th>Side</th>
                <th>Contractor</th>
                <th>Status</th>
                <th>Remarks</th>
                {canEdit ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {progressRows.map(
                ({ item, entry }) => (
                  <Fragment key={entry.id}>
                    <tr>
                      <td>
                        {formatDate(
                          entry.date,
                        )}
                      </td>
                      <td>{item.name}</td>
                      <td>
                        {
                          entry.from_chainage_km
                        }
                      </td>
                      <td>
                        {
                          entry.to_chainage_km
                        }
                      </td>
                      <td>{entry.qty}</td>
                      <td>{entry.side}</td>
                      <td>
                        {entry.contractor ||
                          "-"}
                      </td>
                      <td>
                        <ActivityStatusChip
                          activity={entry}
                        />
                      </td>
                      <td>
                        {entry.remarks ||
                          "-"}
                      </td>
                      {canEdit ? (
                        <td>
                          <button
                            type="button"
                            className="button button--tertiary button--sm"
                            onClick={() =>
                              setEditingEntryId(
                                (
                                  current,
                                ) =>
                                  current ===
                                  entry.id
                                    ? null
                                    : entry.id,
                              )
                            }
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="icon-button icon-button--danger"
                            onClick={() =>
                              onDeleteProgressEntry(
                                entry.id,
                              )
                            }
                            aria-label="Delete progress entry"
                          >
                            <Trash2
                              size={14}
                            />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                    {editingEntryId ===
                    entry.id ? (
                      <tr>
                        <td
                          colSpan={
                            canEdit ? 10 : 9
                          }
                        >
                          <EditProgressEntryForm
                            entry={entry}
                            isPending={
                              updateProgressEntryStatus?.isPending
                            }
                            onSave={(
                              payload,
                            ) =>
                              onUpdateProgressEntry(
                                entry.id,
                                payload,
                                {
                                  onSuccess:
                                    () =>
                                      setEditingEntryId(
                                        null,
                                      ),
                                },
                              )
                            }
                            onCancel={() =>
                              setEditingEntryId(
                                null,
                              )
                            }
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
