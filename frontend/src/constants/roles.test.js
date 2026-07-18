import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isAdminRole,
  USER_ROLES,
} from "./roles";

describe("role utilities", () => {
  it("recognizes admin portal roles", () => {
    expect(
      isAdminRole(USER_ROLES.ADMIN),
    ).toBe(true);
    expect(
      isAdminRole(USER_ROLES.SUPER_ADMIN),
    ).toBe(true);
    expect(
      isAdminRole(USER_ROLES.DIRECTOR),
    ).toBe(false);
    expect(
      isAdminRole(USER_ROLES.USER),
    ).toBe(false);
  });
});
