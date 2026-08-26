import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { offlineReadCache } from "./offlineReadCache";

// This Node version ships an experimental native `localStorage`
// that shadows jsdom's real implementation with a non-functional
// stub (no setItem/getItem/clear at all), so a minimal in-memory
// polyfill is installed here rather than relying on the global.
beforeAll(() => {
  const store = new Map();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) =>
        store.has(key) ? store.get(key) : null,
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
});

afterEach(() => {
  window.localStorage.clear();
});

describe("offlineReadCache", () => {
  it("returns null for a key that was never written", () => {
    expect(
      offlineReadCache.get("entries:missing"),
    ).toBeNull();
  });

  it("round-trips data with a cachedAt timestamp", () => {
    const payload = { site_code: "BKN", status: "DRAFT" };

    offlineReadCache.set("period:x", payload);
    const cached = offlineReadCache.get("period:x");

    expect(cached.data).toEqual(payload);
    expect(typeof cached.cachedAt).toBe("string");
    expect(
      new Date(cached.cachedAt).toString(),
    ).not.toBe("Invalid Date");
  });

  it("overwrites a previous entry for the same key", () => {
    offlineReadCache.set("items:list", { count: 1 });
    offlineReadCache.set("items:list", { count: 2 });

    expect(
      offlineReadCache.get("items:list").data,
    ).toEqual({ count: 2 });
  });

  it("keeps separate keys independent", () => {
    offlineReadCache.set("entries:a", [1, 2]);
    offlineReadCache.set("entries:b", [3]);

    expect(
      offlineReadCache.get("entries:a").data,
    ).toEqual([1, 2]);
    expect(
      offlineReadCache.get("entries:b").data,
    ).toEqual([3]);
  });
});
