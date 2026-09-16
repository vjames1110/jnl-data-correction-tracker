import { X } from "lucide-react";
import { useRef } from "react";

import { useOutsideClick } from "../../../hooks/useOutsideClick";

export function StatusChip({ active }) {
  return (
    <span
      className={
        active
          ? "status-chip status-chip--success"
          : "status-chip status-chip--error"
      }
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function ManagementPanel({
  children,
  eyebrow,
  title,
  onClose,
  closeOnOutsideClick = false,
}) {
  const panelRef = useRef(null);
  useOutsideClick(
    panelRef,
    closeOnOutsideClick,
    onClose,
  );

  return (
    <div
      className="management-panel"
      ref={panelRef}
    >
      <div className="management-panel__header">
        <div>
          <span className="page-eyebrow">
            {eyebrow}
          </span>
          <h2>{title}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close form"
        >
          <X size={18} />
        </button>
      </div>

      {children}
    </div>
  );
}
