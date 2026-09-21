import { describe, expect, it } from "vitest";

import {
  isProjectEntryRole,
  portalBasePath,
  projectMonitorDprBillsPath,
  projectMonitorHrPath,
  projectMonitorMachineryPath,
  projectMonitorOverviewPath,
  projectMonitorStructuresPath,
  USER_ROLES,
  usesProjectPortal,
} from "./roles";

describe("Project Incharge role", () => {
  it("uses the project portal, like the Project Manager", () => {
    expect(
      usesProjectPortal(USER_ROLES.PROJECT_INCHARGE),
    ).toBe(true);
    expect(
      usesProjectPortal(USER_ROLES.PROJECT_MANAGER),
    ).toBe(true);
    [
      USER_ROLES.ADMIN,
      USER_ROLES.DIRECTOR,
      USER_ROLES.USER,
      USER_ROLES.STORE_HO,
    ].forEach((role) => {
      expect(usesProjectPortal(role)).toBe(false);
    });
  });

  it("may enter Project Monitor data; the Director may not", () => {
    [
      USER_ROLES.PROJECT_INCHARGE,
      USER_ROLES.PROJECT_MANAGER,
      USER_ROLES.ADMIN,
      USER_ROLES.SUPER_ADMIN,
    ].forEach((role) => {
      expect(isProjectEntryRole(role)).toBe(true);
    });
    expect(isProjectEntryRole(USER_ROLES.DIRECTOR)).toBe(
      false,
    );
    expect(isProjectEntryRole(USER_ROLES.USER)).toBe(false);
  });

  it("signs in to the project portal", () => {
    expect(
      portalBasePath(USER_ROLES.PROJECT_INCHARGE),
    ).toBe("/project-manager");
  });

  it("gets the same page paths as the Project Manager", () => {
    [
      projectMonitorOverviewPath,
      projectMonitorStructuresPath,
      projectMonitorDprBillsPath,
      projectMonitorHrPath,
      projectMonitorMachineryPath,
    ].forEach((pathFor) => {
      expect(pathFor(USER_ROLES.PROJECT_INCHARGE)).toBe(
        pathFor(USER_ROLES.PROJECT_MANAGER),
      );
      expect(pathFor(USER_ROLES.PROJECT_INCHARGE)).toMatch(
        /^\/project-manager\//,
      );
    });
  });
});
