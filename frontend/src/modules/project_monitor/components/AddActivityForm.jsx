import { Trash2, X } from "lucide-react";
import { useState } from "react";

/**
 * The "+ Add activity" form: which existing section it joins, its
 * name and kind, and where it lands - at the end (default), or
 * before/after a task already in that same section. Mirrors
 * ``CustomActivityCreateSerializer`` on the backend field for field.
 *
 * Also lists every hand-added activity already on this sheet (across
 * every section, not just the one being added to) with its own Remove
 * button right here - the same place you'd come to add one, rather
 * than having to find and reopen a custom row's own update popup just
 * to remove it.
 */
export function AddActivityForm({
  groups,
  defaultGroupTitle,
  onAdd,
  onClose,
  isPending,
  error,
  onDeleteActivity,
  deleteActivityStatus,
}) {
  const sections = uniqueSections(groups);
  const [groupTitle, setGroupTitle] = useState(
    defaultGroupTitle &&
      sections.some((s) => s.group_title === defaultGroupTitle)
      ? defaultGroupTitle
      : (sections[0]?.group_title ?? ""),
  );
  const [name, setName] = useState("");
  const [kind, setKind] = useState("TASK");
  const [unit, setUnit] = useState("");
  const [position, setPosition] = useState("end");
  const [relativeId, setRelativeId] = useState("");
  const [pendingDeleteId, setPendingDeleteId] =
    useState(null);

  const customActivities = groups.flatMap((group) =>
    group.rows
      .filter((row) => row.is_custom)
      .map((row) => ({
        ...row,
        group_title: group.group_title,
      })),
  );

  const handleDelete = (activity) => {
    if (
      !window.confirm(
        `Remove "${activity.name}"? This was added by hand and can't be undone.`,
      )
    ) {
      return;
    }
    setPendingDeleteId(activity.id);
    onDeleteActivity(activity.id, {
      onSettled: () => setPendingDeleteId(null),
    });
  };

  const rowsInSection =
    groups.find((g) => g.group_title === groupTitle)?.rows ?? [];

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!name.trim() || !groupTitle) {
      return;
    }
    onAdd(
      {
        group_title: groupTitle,
        name: name.trim(),
        kind,
        unit: kind === "LENGTH" ? unit.trim() : "",
        position,
        ...(position === "end"
          ? {}
          : { relative_activity_id: relativeId }),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <form className="pm-add-activity" onSubmit={handleSubmit}>
      <div className="pm-update-panel__head">
        <div className="pm-update-panel__title">
          <span className="page-eyebrow">Add activity</span>
          <h4>New task</h4>
        </div>
        <button
          type="button"
          className="icon-button pm-popup__close"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      {customActivities.length && onDeleteActivity ? (
        <div className="pm-add-activity__existing">
          <span className="pm-add-activity__existing-label">
            Custom activities on this sheet
          </span>
          <ul className="pm-add-activity__existing-list">
            {customActivities.map((activity) => (
              <li key={activity.id}>
                <span>
                  {activity.name}
                  <span className="sub">
                    {" "}
                    &middot; {activity.group_title}
                  </span>
                </span>
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  aria-label={`Remove ${activity.name}`}
                  title="Remove this activity"
                  disabled={
                    pendingDeleteId === activity.id &&
                    deleteActivityStatus?.isPending
                  }
                  onClick={() => handleDelete(activity)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
          {pendingDeleteId &&
          deleteActivityStatus?.isError ? (
            <div className="inline-alert inline-alert--error">
              {deleteActivityStatus.error.message}
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="form-field">
        <span>Section</span>
        <select
          value={groupTitle}
          onChange={(event) => {
            setGroupTitle(event.target.value);
            setRelativeId("");
          }}
        >
          {sections.map((section) => (
            <option
              key={section.group_title}
              value={section.group_title}
            >
              {section.group_title}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span>Activity name</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Anti-carbonation coating"
          required
        />
      </label>

      <div className="pm-add-activity__row">
        <label className="form-field">
          <span>Kind</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="TASK">Task (% done)</option>
            <option value="LENGTH">Quantity</option>
          </select>
        </label>
        {kind === "LENGTH" ? (
          <label className="form-field">
            <span>Unit</span>
            <input
              type="text"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="e.g. m"
            />
          </label>
        ) : null}
      </div>

      <label className="form-field">
        <span>Position</span>
        <select
          value={position}
          onChange={(event) => {
            setPosition(event.target.value);
            setRelativeId("");
          }}
        >
          <option value="end">At the end of this section</option>
          <option value="before">Before&hellip;</option>
          <option value="after">After&hellip;</option>
        </select>
      </label>

      {position !== "end" ? (
        <label className="form-field">
          <span>Which task</span>
          <select
            value={relativeId}
            onChange={(event) => setRelativeId(event.target.value)}
            required
          >
            <option value="">Select a task</option>
            {rowsInSection.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="pm-update-form__footer">
        <button
          type="submit"
          className="button button--primary"
          disabled={isPending || !name.trim() || !groupTitle}
        >
          {isPending ? "Adding..." : "Add activity"}
        </button>
      </div>
      {error ? (
        <div className="inline-alert inline-alert--error">
          {error.message}
        </div>
      ) : null}
    </form>
  );
}

// One entry per section (``group_title``), in the sheet's own order -
// the underlying group list, not the merged/pivoted matrix tables, so
// a stacked table ("Piers") still lets you pick "Pier P3" specifically.
function uniqueSections(groups) {
  const seen = new Set();
  return groups.filter((group) => {
    if (seen.has(group.group_title)) {
      return false;
    }
    seen.add(group.group_title);
    return true;
  });
}
