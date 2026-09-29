import { X } from "lucide-react";

/**
 * The inline "opens right where you clicked" form wrapper used across
 * Project Monitor's Add/Edit flows - trialled first on Costing's "Add
 * BOQ item" (see ``CostingBoqPanel``'s ``.pm-boq-slide``, which this
 * reuses the same entrance animation from). Replaces the old fixed,
 * right-anchored ``ManagementPanel`` drawer: instead of sliding in
 * from the side over the page, the form renders in the normal page
 * flow exactly where it's placed - right under the button that opened
 * it, or under the specific row being edited - so nothing is ever
 * hidden behind an overlay.
 */
export function SlideDownForm({ eyebrow, title, onClose, children }) {
  return (
    <div className="pm-slide-panel">
      <div className="pm-slide-panel__head">
        <div>
          <span className="page-eyebrow">{eyebrow}</span>
          <h4>{title}</h4>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close form"
        >
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  );
}
