import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getAgeingLabel,
  getWorkSlaState,
} from "./workDisplay";

describe("getWorkSlaState", () => {
  it("returns no_sla when there is no deadline", () => {
    expect(
      getWorkSlaState({
        sla_deadline: null,
        current_status: "IN_PROGRESS",
      }).key,
    ).toBe("no_sla");
  });

  it("flags overdue active work", () => {
    const state = getWorkSlaState({
      sla_deadline: new Date(
        Date.now() - 3_600_000,
      ).toISOString(),
      current_status: "IN_PROGRESS",
    });

    expect(state.key).toBe("overdue");
    expect(state.tone).toBe("error");
  });

  it("flags work due within 24 hours", () => {
    const state = getWorkSlaState({
      sla_deadline: new Date(
        Date.now() + 3_600_000,
      ).toISOString(),
      current_status: "ACCEPTED",
    });

    expect(state.key).toBe("due_today");
    expect(state.tone).toBe("warning");
  });

  it("treats resolved requests as closed regardless of deadline", () => {
    const state = getWorkSlaState({
      sla_deadline: new Date(
        Date.now() - 3_600_000,
      ).toISOString(),
      current_status: "RESOLVED",
    });

    expect(state.key).toBe("closed");
    expect(state.tone).toBe("neutral");
  });

  it("marks work on track when the deadline is far away", () => {
    const state = getWorkSlaState({
      sla_deadline: new Date(
        Date.now() + 5 * 24 * 3_600_000,
      ).toISOString(),
      current_status: "IN_PROGRESS",
    });

    expect(state.key).toBe("on_track");
    expect(state.tone).toBe("success");
  });
});

describe("getAgeingLabel", () => {
  it("returns a placeholder for missing values", () => {
    expect(getAgeingLabel(null)).toBe("-");
  });

  it("formats hours for recent timestamps", () => {
    const label = getAgeingLabel(
      new Date(
        Date.now() - 5 * 3_600_000,
      ).toISOString(),
    );

    expect(label).toMatch(/^\d+h$/);
  });

  it("formats days and hours for older timestamps", () => {
    const label = getAgeingLabel(
      new Date(
        Date.now() - 50 * 3_600_000,
      ).toISOString(),
    );

    expect(label).toMatch(/^\d+d( \d+h)?$/);
  });
});
