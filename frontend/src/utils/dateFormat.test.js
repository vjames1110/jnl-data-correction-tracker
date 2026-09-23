import { describe, expect, it } from "vitest";

import { formatCalendarDate, formatDateTime } from "./dateFormat";

describe("formatCalendarDate", () => {
  it("formats a plain YYYY-MM-DD string as DD-MM-YYYY", () => {
    expect(formatCalendarDate("2026-09-23")).toBe("23-09-2026");
  });

  it("reads only the date portion of a full timestamp, never through Date", () => {
    // A UTC-suffixed timestamp whose date-portion is what a "day"
    // field means here - no timezone shift is applied.
    expect(
      formatCalendarDate("2026-01-05T18:30:00.000Z"),
    ).toBe("05-01-2026");
  });

  it("returns null for nothing", () => {
    expect(formatCalendarDate(null)).toBeNull();
    expect(formatCalendarDate("")).toBeNull();
  });

  it("falls back to Date-based extraction for a Date object", () => {
    const date = new Date(2026, 8, 23); // local 23 Sep 2026
    expect(formatCalendarDate(date)).toBe("23-09-2026");
  });
});

describe("formatDateTime", () => {
  it("formats a real timestamp as DD-MM-YYYY, hh:mm am/pm in local time", () => {
    const date = new Date(2026, 8, 23, 14, 5);
    expect(formatDateTime(date)).toBe("23-09-2026, 02:05 pm");
  });

  it("can return the date only", () => {
    const date = new Date(2026, 0, 5, 9, 0);
    expect(formatDateTime(date, { dateOnly: true })).toBe(
      "05-01-2026",
    );
  });

  it("returns null for nothing or an unparseable value", () => {
    expect(formatDateTime(null)).toBeNull();
    expect(formatDateTime("not a date")).toBeNull();
  });

  it("accepts an ISO string", () => {
    expect(
      formatDateTime("2026-09-23T00:00:00", { dateOnly: true }),
    ).toBe("23-09-2026");
  });
});
