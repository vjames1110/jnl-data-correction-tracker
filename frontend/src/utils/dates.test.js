import {
  describe,
  expect,
  it,
} from "vitest";

import {
  formatDateTime,
  formatDisplayDate,
  formatDisplayTime,
} from "./dates";

describe("date utilities", () => {
  it("returns stable empty values", () => {
    expect(formatDisplayDate(null)).toBe("\u2014");
    expect(formatDateTime(null)).toBe("\u2014");
    expect(formatDisplayTime(null)).toBe("--:--:--");
  });

  it("formats a valid date", () => {
    expect(
      formatDisplayDate("2026-07-18T10:30:00Z"),
    ).toContain("2026");
  });
});
