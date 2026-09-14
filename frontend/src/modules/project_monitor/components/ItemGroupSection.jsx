import { Trash2 } from "lucide-react";

/**
 * A labeled group of Structures/Buildings (grouped by type for
 * Structures, by site/station for Buildings) with a summary row per
 * item - name/chainage, description, progress - and View/Delete
 * actions. Shared because both sections render identically once you
 * have ``{id, name, chainage_km, description, overall_progress}``.
 */
export function ItemGroupSection({
  label,
  items,
  onView,
  onDelete,
  canEdit,
  deleteTitle = "Delete this sheet and all its data",
}) {
  return (
    <div className="pm-structure-section">
      <div className="pm-structure-section__header">
        <h3>{label}</h3>
        <span className="sub">
          {items.length} nos
        </span>
      </div>

      {items.length === 0 ? (
        <p className="pm-timeline-empty">
          None added yet.
        </p>
      ) : (
        items.map((item) => (
          <div
            className="pm-structure-row"
            key={item.id}
          >
            <div className="pm-structure-row__main">
              <strong>
                {item.name}
                {item.chainage_km != null
                  ? ` · Ch. ${item.chainage_km} km`
                  : ""}
              </strong>
              <span>
                {item.description}
                {" — "}
                {item.overall_progress.done}/
                {item.overall_progress.total}{" "}
                activities complete
              </span>
            </div>
            <div className="pm-structure-row__actions">
              <button
                type="button"
                className="button button--tertiary"
                onClick={() => onView(item.id)}
              >
                View
              </button>
              {canEdit ? (
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  onClick={() =>
                    onDelete(item.id)
                  }
                  aria-label="Delete"
                  title={deleteTitle}
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
