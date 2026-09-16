import { useEffect } from "react";

/**
 * Calls ``onOutsideClick`` when a mousedown lands outside ``ref``'s
 * element, only while ``isActive`` is true - same pattern already
 * used inline in ``NotificationBell``/``SearchableSelect``, pulled
 * into a hook since Project Monitor needs it in several places
 * (the add-item form panels, the inline activity-row expand).
 */
export function useOutsideClick(
  ref,
  isActive,
  onOutsideClick,
) {
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    function handleOutsideClick(event) {
      if (
        ref.current &&
        !ref.current.contains(event.target)
      ) {
        onOutsideClick(event);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
  }, [isActive, ref, onOutsideClick]);
}
