import { describe, expect, it } from "vitest";

import {
  compareWithEntered,
  comparisonText,
  isMeasured,
  lineQuantity,
  sheetTotal,
} from "./measurement";

describe("lineQuantity", () => {
  it("multiplies only the filled dimensions", () => {
    expect(
      lineQuantity({ nos: "2", length: "10", breadth: "1.5" }),
    ).toBe(30);
    expect(
      lineQuantity({
        nos: "2",
        length: "10",
        breadth: "1.5",
        depth: "0.5",
      }),
    ).toBe(15);
    expect(lineQuantity({ length: "12.5" })).toBe(12.5);
  });

  it("treats nos alone as a count", () => {
    expect(lineQuantity({ nos: "7" })).toBe(7);
  });

  it("counts a deduction negatively", () => {
    expect(
      lineQuantity({
        nos: "1",
        length: "2",
        breadth: "2",
        is_deduction: true,
      }),
    ).toBe(-4);
  });

  it("is zero for an empty or invalid line", () => {
    expect(lineQuantity({})).toBe(0);
    expect(lineQuantity({ nos: "", length: "" })).toBe(0);
    expect(lineQuantity({ nos: "abc" })).toBe(0);
  });

  it("rounds to three places", () => {
    expect(
      lineQuantity({ length: "1.111", breadth: "1.111" }),
    ).toBe(1.234);
  });
});

describe("sheetTotal", () => {
  it("adds the lines, deductions taking away", () => {
    expect(
      sheetTotal([
        { nos: "2", length: "5" },
        { nos: "1", length: "1", breadth: "2", is_deduction: true },
      ]),
    ).toBe(8);
    expect(sheetTotal([])).toBe(0);
  });

  it("does not drift on decimals", () => {
    expect(
      sheetTotal([{ length: "0.1" }, { length: "0.2" }]),
    ).toBe(0.3);
  });
});

describe("isMeasured", () => {
  it("needs something filled in", () => {
    expect(isMeasured({})).toBe(false);
    expect(isMeasured({ nos: "", length: "" })).toBe(false);
    expect(isMeasured({ depth: "0" })).toBe(true);
  });
});

describe("compareWithEntered", () => {
  it.each([
    [12.5, "12.5", "match", 0],
    [12.5, 15, "short", 2.5],
    [17, "15", "over", 2],
    [12.5, "", "unentered", 12.5],
    [0, "15", "none", 0],
  ])("%s against %s is %s", (total, entered, state, diff) => {
    expect(compareWithEntered(total, entered)).toEqual({
      state,
      diff,
    });
  });
});

describe("comparisonText", () => {
  it("words each state", () => {
    expect(comparisonText(12.5, "12.5")).toBe(
      "Matches the 12.5 entered",
    );
    expect(comparisonText(12.5, "15")).toBe(
      "Measured 12.5 of 15 entered",
    );
    expect(comparisonText(17, "15")).toBe(
      "Measured 17 - 2 more than the 15 entered",
    );
    expect(comparisonText(4, "")).toBe(
      "Measured 4 - no quantity entered yet",
    );
    expect(comparisonText(0, "15")).toBe("Nothing measured yet");
  });
});
