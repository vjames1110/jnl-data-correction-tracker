const DEFAULT_WIDTH = 420;
const MARGIN = 8;
const GAP = 6;
// Below this much free room on either side, the box would be a sliver:
// it is laid over the row instead, using most of the screen height.
const MIN_ROOM = 220;

/**
 * Where the box goes: just under the clicked row (or above it when
 * there is more room there), lined up with where the click landed,
 * and never off the screen. Pure so it can be tested on its own.
 */
export function placePopup({
  anchor,
  anchorX,
  contentHeight,
  viewport,
  maxWidth = DEFAULT_WIDTH,
}) {
  const width = Math.min(maxWidth, viewport.width - 2 * MARGIN);
  const wanted =
    (anchorX ?? anchor.left + 24) - 40;
  const left = Math.max(
    MARGIN,
    Math.min(wanted, viewport.width - width - MARGIN),
  );

  const below = viewport.height - anchor.bottom - GAP - MARGIN;
  const above = anchor.top - GAP - MARGIN;

  if (contentHeight <= below) {
    return {
      top: anchor.bottom + GAP,
      left,
      width,
      maxHeight: below,
    };
  }
  if (contentHeight <= above) {
    return {
      top: anchor.top - GAP - contentHeight,
      left,
      width,
      maxHeight: above,
    };
  }
  if (Math.max(below, above) < MIN_ROOM) {
    return {
      top: MARGIN,
      left,
      width,
      maxHeight: viewport.height - 2 * MARGIN,
    };
  }
  return below >= above
    ? {
        top: anchor.bottom + GAP,
        left,
        width,
        maxHeight: below,
      }
    : { top: MARGIN, left, width, maxHeight: above };
}
