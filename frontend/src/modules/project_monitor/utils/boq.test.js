import { describe, expect, it } from "vitest";

import {
  applyPercent,
  bidRate,
  describePercent,
  suggestChildNumber,
} from "./boq";

describe("applyPercent", () => {
  it.each([
    [1000, 5, 1050],
    [1000, -5, 950],
    [1000, 0, 1000],
    [250, -5.5, 236.25],
    [999.99, 2.345, 1023.44],
    [900, 4, 936],
  ])("%s at %s%% is %s", (amount, percent, expected) => {
    expect(applyPercent(amount, percent)).toBe(expected);
  });

  it("rounds an exact half paise to the even paisa like the server", () => {
    // 100.10 x 1.05 = 105.105 -> Decimal half-even = 105.10
    expect(applyPercent(100.1, 5)).toBe(105.1);
    // 100.30 x 1.05 = 105.315 -> half-even = 105.32
    expect(applyPercent(100.3, 5)).toBe(105.32);
  });

  it("copes with typed strings and blanks", () => {
    expect(applyPercent("1000", "5")).toBe(1050);
    expect(applyPercent("1000", "")).toBe(1000);
    expect(applyPercent("", 5)).toBe(0);
    expect(applyPercent("abc", 5)).toBeNull();
  });
});

describe("bidRate", () => {
  it("uses the item's own percentage, else the contract's", () => {
    expect(bidRate("1000", "-2", "5")).toBe(980);
    expect(bidRate("1000", "0", "5")).toBe(1000);
    expect(bidRate("1000", "", "5")).toBe(1050);
    expect(bidRate("1000", null, null)).toBe(1000);
  });

  it("is null without an authority rate", () => {
    expect(bidRate("", "", "5")).toBeNull();
    expect(bidRate(null, null, null)).toBeNull();
  });
});

describe("describePercent", () => {
  it("words a percentage", () => {
    expect(describePercent(5.5)).toBe("5.5% above");
    expect(describePercent("-3")).toBe("3% below");
    expect(describePercent(0)).toBe("at par");
    expect(describePercent(null)).toBe("not set");
  });
});

describe("suggestChildNumber", () => {
  const group = { id: "g", item_no: "4" };

  it("suggests the next number under the group", () => {
    const items = [
      { id: "a", parent_id: "g", item_no: "4.1" },
      { id: "b", parent_id: "g", item_no: "4.2" },
      { id: "c", parent_id: "other", item_no: "4.9" },
    ];

    expect(suggestChildNumber(group, items)).toBe("4.3");
    expect(suggestChildNumber(group, [])).toBe("4.1");
  });

  it("suggests nothing for an unnumbered group", () => {
    expect(suggestChildNumber({ id: "g", item_no: "" }, [])).toBe("");
    expect(suggestChildNumber(null, [])).toBe("");
  });
});
