import { X } from "lucide-react";
import { useState } from "react";

/**
 * The "+ Add activity" form: which existing section it joins, its
 * name and kind, and where it lands - at the end (default), or
 * before/after a task already in that same section. Mirrors
 * ``CustomActivityCreateSerializer`` on the backend field for field.
 */
export function AddActivityForm({
  groups,
  defaultGroupTitle,
  onAdd,
  onClose,
  isPending,
  error,
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
