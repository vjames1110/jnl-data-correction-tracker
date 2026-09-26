import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { placePopup } from "../utils/popupPlacement";

// Narrow screens get a bottom sheet rather than a floating box.
const SHEET_QUERY = "(max-width: 640px)";

function samePlacement(a, b) {
  return (
    a === b ||
    (a &&
      b &&
      a.sheet === b.sheet &&
      a.top === b.top &&
      a.left === b.left &&
      a.width === b.width &&
      a.maxHeight === b.maxHeight)
  );
}

// What a popup is attached to: a task row (``data-activity-row``) or
// one of its icon buttons (``data-popup-anchor``).
function findAnchor(anchorId) {
  return document.querySelector(
    `[data-activity-row="${anchorId}"],[data-popup-anchor="${anchorId}"]`,
  );
}

// Presses on these open / close popups themselves, so the outside-
// press handler leaves them alone (else a second click on the same
// icon would close it and immediately reopen it).
const TRIGGERS = "[data-activity-row],[data-popup-anchor]";

/**
 * The floating box that opens right beside a task when it is clicked
 * - the task's own inputs, action history and review sign-off, kept
 * with the task instead of pushing the table around. It is attached to
 * the clicked row (``anchorId``), follows it as the page scrolls,
 * closes on Escape, on its own close button or on a click anywhere
 * outside it (a click on another task row just moves it there), and
 * turns into a bottom sheet on a phone.
 */
export function ActivityPopup({
  anchorId,
  anchorX,
  label,
  width = 420,
  onClose,
  children,
}) {
  const popupRef = useRef(null);
  const [placement, setPlacement] = useState(null);

  const reposition = useCallback(() => {
    const popup = popupRef.current;
    const anchorEl = findAnchor(anchorId);
    if (!popup || !anchorEl) {
      return;
    }
    let next;
    if (window.matchMedia?.(SHEET_QUERY)?.matches) {
      next = { sheet: true };
    } else {
      next = placePopup({
        anchor: anchorEl.getBoundingClientRect(),
        anchorX,
        maxWidth: width,
        contentHeight: popup.scrollHeight,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      });
    }
    setPlacement((current) =>
      samePlacement(current, next) ? current : next,
    );
  }, [anchorId, anchorX, width]);

  useLayoutEffect(() => {
    reposition();
  }, [reposition]);

  useEffect(() => {
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(reposition);
    if (observer && popupRef.current) {
      observer.observe(popupRef.current);
    }
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      observer?.disconnect();
    };
  }, [reposition]);

  useEffect(() => {
    popupRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function handleMouseDown(event) {
      if (popupRef.current?.contains(event.target)) {
        return;
      }
      // Another task row or icon moves the box itself; closing here
      // first would make that click reopen what it just closed.
      if (event.target.closest?.(TRIGGERS)) {
        return;
      }
      onClose();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        const anchor = findAnchor(anchorId);
        (anchor?.matches("button")
          ? anchor
          : anchor?.querySelector("button")
        )?.focus({ preventScroll: true });
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, anchorId]);

  const isSheet = Boolean(placement?.sheet);
  const style = placement
    ? isSheet
      ? undefined
      : {
          top: placement.top,
          left: placement.left,
          width: placement.width,
          maxHeight: placement.maxHeight,
        }
    : { top: 0, left: 0, visibility: "hidden" };

  return createPortal(
    <div
      ref={popupRef}
      className={
        isSheet ? "pm-popup pm-popup--sheet" : "pm-popup"
      }
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      style={style}
    >
      {children}
    </div>,
    document.body,
  );
}
