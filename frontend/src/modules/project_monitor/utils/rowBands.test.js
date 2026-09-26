import { describe, expect, it } from "vitest";

import { bandClasses, clusterKey, rowBands } from "./rowBands";

const named = (...names) => names.map((name) => ({ name }));

describe("clusterKey", () => {
  it.each([
    ["S1 – Bearings", "S1"],
    ["S12 - Girder launching", "S12"],
    ["P3 — Cap", "P3"],
    ["Pier 2 - Cap", "PIER2"],
    ["s4 – deck slab", "S4"],
  ])("%s -> %s", (name, key) => {
    expect(clusterKey(name)).toBe(key);
  });

  it.each([
    "Excavation",
    "R/W 1",
    "Return wall 1",
    "Deck slab - phase two",
    "Approach - LHS",
    "",
    null,
  ])("%s has no cluster", (name) => {
    expect(clusterKey(name)).toBeNull();
  });
});

describe("rowBands", () => {
  const SPANS = named(
    "S1 – Bearings",
    "S1 – Girder fabrication",
    "S1 – Girder launching",
    "S1 – Deck slab / Ballast wall",
    "S2 – Bearings",
    "S2 – Girder fabrication",
    "S3 – Bearings",
  );

  it("alternates light grey and white from one span to the next", () => {
    expect(rowBands(SPANS).map((entry) => entry.band)).toEqual([
      "a",
      "a",
      "a",
      "a",
      "b",
      "b",
      "a",
    ]);
  });

  it("marks where each new span starts, but not the very first row", () => {
    expect(rowBands(SPANS).map((entry) => entry.start)).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
      true,
    ]);
  });

  it("leaves an ordinary group plain", () => {
    const bands = rowBands(
      named("Excavation", "Bottom slab", "Top slab"),
    );

    expect(bands.every((entry) => entry.band === null)).toBe(true);
    expect(bands.some((entry) => entry.start)).toBe(false);
  });

  it("leaves a group with only one span plain", () => {
    const bands = rowBands(
      named("S1 – Bearings", "S1 – Girder fabrication"),
    );

    expect(bands.every((entry) => entry.band === null)).toBe(true);
  });

  it("keeps an unlabelled row between spans in its own band", () => {
    const bands = rowBands(
      named("S1 – Bearings", "Handing over", "S2 – Bearings"),
    );

    expect(bands.map((entry) => entry.band)).toEqual(["a", "b", "a"]);
  });

  it("copes with no rows", () => {
    expect(rowBands([])).toEqual([]);
  });
});

describe("bandClasses", () => {
  it("names the classes for a banded row", () => {
    expect(bandClasses({ band: "a", start: false })).toBe(
      "pm-row--band-a",
    );
    expect(bandClasses({ band: "b", start: true })).toBe(
      "pm-row--band-b pm-row--cluster-start",
    );
  });

  it("is empty for an unbanded row", () => {
    expect(bandClasses({ band: null, start: false })).toBe("");
    expect(bandClasses(undefined)).toBe("");
  });
});
