import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import { AUTH_STORAGE_KEYS } from "../constants/auth";
import { tokenStorage } from "./tokenStorage";

afterEach(() => {
  window.sessionStorage.clear();
});

describe("tokenStorage", () => {
  it("stores, reads, and clears access and refresh tokens", () => {
    tokenStorage.setTokens({
      access: "access-token",
      refresh: "refresh-token",
    });

    expect(
      tokenStorage.getAccessToken(),
    ).toBe("access-token");
    expect(
      tokenStorage.getRefreshToken(),
    ).toBe("refresh-token");
    expect(
      tokenStorage.hasRefreshToken(),
    ).toBe(true);

    tokenStorage.clearTokens();

    expect(
      window.sessionStorage.getItem(
        AUTH_STORAGE_KEYS.ACCESS_TOKEN,
      ),
    ).toBeNull();
    expect(
      tokenStorage.hasRefreshToken(),
    ).toBe(false);
  });
});
