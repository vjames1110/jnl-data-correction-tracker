import clsx from "clsx";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";

/**
 * A labeled group of Structures/Buildings (grouped by type for
 * Structures, by site/station for Buildings) with a summary row per
 * item - name/chainage, description, progress - and Edit/Delete
 * actions. Shared because both sections render identically once you
 * have ``{id, name, chainage_km, description, overall_progress}``.
 * ``onEdit`` is optional - a section that has no edit form yet (e.g.
 * Buildings, for now) simply omits it and gets no Edit button.
 *
 * Clicking the item's details opens (or closes) it like a dropdown:
 * with ``renderExpanded`` its workspace opens right under its own row
 * (``expandedId`` says which item is open), and a chevron on the row
 * shows the state - there is no separate View button.
 */
export function ItemGroupSection({
  label,
  items,
  onView,
  onEdit,
  onDelete,
  canEdit,
  expandedId = null,
  renderExpanded,
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
        items.map((item) => {
          const isOpen =
            Boolean(renderExpanded) && expandedId === item.id;
          return (
            <div
              className={clsx(
                "pm-structure-item",
                isOpen && "pm-structure-item--open",
              )}
              key={item.id}
            >
              <div className="pm-structure-row">
                <button
                  type="button"
                  className="pm-structure-row__main"
                  onClick={() => onView(item.id)}
                  aria-expanded={
                    renderExpanded ? isOpen : undefined
                  }
                >
                  <span className="pm-structure-row__text">
                    <strong>
                      {item.name}
                      {item.chainage_km != null
                        ? ` \u00b7 Ch. ${item.chainage_km} km`
                        : ""}
                    </strong>
                    <span>
                      {item.description}
                      {" \u2014 "}
                      {item.overall_progress.done}/
                      {item.overall_progress.total}{" "}
                      activities complete
                    </span>
                  </span>
                  {renderExpanded ? (
                    <ChevronDown
                      size={18}
                      className="pm-structure-row__chevron"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
                {canEdit ? (
                  <div className="pm-structure-row__actions">
                    {canEdit && onEdit ? (
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => onEdit(item)}
                        aria-label="Edit"
                        title="Edit name/chainage"
                      >
                        <Pencil size={16} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      onClick={() => onDelete(item.id)}
                      aria-label="Delete"
                      title={deleteTitle}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : null}
              </div>
              {isOpen ? renderExpanded(item) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
