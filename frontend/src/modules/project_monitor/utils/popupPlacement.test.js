import { describe, expect, it } from "vitest";

import { placePopup } from "./popupPlacement";

const VIEWPORT = { width: 1400, height: 800 };
// A row 40px tall with its top at 300.
const ROW = { top: 300, bottom: 340, left: 100 };

describe("placePopup", () => {
  it("opens just under the row, lined up with the click", () => {
    const place = placePopup({
      anchor: ROW,
      anchorX: 400,
      contentHeight: 300,
      viewport: VIEWPORT,
    });

    expect(place.top).toBe(346);
    expect(place.left).toBe(360);
    expect(place.width).toBe(420);
    expect(place.maxHeight).toBe(800 - 340 - 6 - 8);
  });

  it("lines up with the row when the click position is unknown", () => {
    const place = placePopup({
      anchor: ROW,
      contentHeight: 300,
      viewport: VIEWPORT,
    });

    expect(place.left).toBe(100 + 24 - 40);
  });

  it("never runs off the right or left edge", () => {
    const right = placePopup({
      anchor: ROW,
      anchorX: 1390,
      contentHeight: 300,
      viewport: VIEWPORT,
    });
    const left = placePopup({
      anchor: { ...ROW, left: 0 },
      anchorX: 2,
      contentHeight: 300,
      viewport: VIEWPORT,
    });

    expect(right.left + right.width).toBeLessThanOrEqual(1400 - 8);
    expect(left.left).toBe(8);
  });

  it("opens above the row when it will not fit below but does fit above", () => {
    const place = placePopup({
      anchor: { top: 600, bottom: 640, left: 100 },
      anchorX: 150,
      contentHeight: 400,
      viewport: VIEWPORT,
    });

    // Bottom edge of the box sits 6px above the row.
    expect(place.top + 400).toBe(600 - 6);
    expect(place.top).toBeGreaterThanOrEqual(8);
  });

  it("uses the roomier side, scrolling inside, when neither side fits", () => {
    const below = placePopup({
      anchor: { top: 200, bottom: 240, left: 100 },
      anchorX: 150,
      contentHeight: 900,
      viewport: VIEWPORT,
    });
    const above = placePopup({
      anchor: { top: 560, bottom: 600, left: 100 },
      anchorX: 150,
      contentHeight: 900,
      viewport: VIEWPORT,
    });

    expect(below.top).toBe(246);
    expect(below.maxHeight).toBe(800 - 240 - 6 - 8);
    expect(above.top).toBe(8);
    expect(above.maxHeight).toBe(560 - 6 - 8);
  });

  it("is laid over the row using most of the height when there is no room either side", () => {
    const place = placePopup({
      anchor: { top: 200, bottom: 240, left: 100 },
      anchorX: 150,
      contentHeight: 900,
      viewport: { width: 1400, height: 400 },
    });

    expect(place.top).toBe(8);
    expect(place.maxHeight).toBe(400 - 16);
  });

  it("shrinks to fit a narrow window", () => {
    const place = placePopup({
      anchor: ROW,
      anchorX: 200,
      contentHeight: 300,
      viewport: { width: 500, height: 800 },
    });

    expect(place.width).toBe(420);
    const narrower = placePopup({
      anchor: ROW,
      anchorX: 200,
      contentHeight: 300,
      viewport: { width: 380, height: 800 },
    });
    expect(narrower.width).toBe(364);
    expect(narrower.left).toBe(8);
  });

  it("uses the width it is asked for, up to the window", () => {
    const wide = placePopup({
      anchor: ROW,
      anchorX: 300,
      contentHeight: 220,
      viewport: VIEWPORT,
      maxWidth: 680,
    });
    const squeezed = placePopup({
      anchor: ROW,
      anchorX: 300,
      contentHeight: 220,
      viewport: { width: 600, height: 800 },
      maxWidth: 680,
    });

    expect(wide.width).toBe(680);
    expect(squeezed.width).toBe(600 - 16);
    expect(squeezed.left).toBe(8);
  });

  it("keeps a wide box inside the right edge", () => {
    const place = placePopup({
      anchor: ROW,
      anchorX: 1300,
      contentHeight: 220,
      viewport: VIEWPORT,
      maxWidth: 680,
    });

    expect(place.left + place.width).toBe(1400 - 8);
  });
});
