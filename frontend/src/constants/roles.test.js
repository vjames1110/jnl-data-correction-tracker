import { describe, expect, it } from "vitest";

import {
  canManageProjectMasters,
  isDepartmentRole,
  isProjectEntryRole,
  landingPath,
  portalBasePath,
  projectMonitorDprBillsPath,
  projectMonitorHrPath,
  projectMonitorMachineryPath,
  projectMonitorOverviewPath,
  projectMonitorRdsoPath,
  projectMonitorStructuresPath,
  projectMonitorStructureTypesPath,
  USER_ROLES,
  seesCosting,
  seesEveryProject,
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

describe("seesEveryProject", () => {
  it("is true for Admin, Super Admin, Director and the Project Management HO only", () => {
    [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DIRECTOR,
      USER_ROLES.PROJECT_HO,
    ].forEach((role) => expect(seesEveryProject(role)).toBe(true));
    [
      USER_ROLES.PROJECT_MANAGER,
      USER_ROLES.PROJECT_INCHARGE,
      USER_ROLES.STORE_HO,
      USER_ROLES.USER,
    ].forEach((role) => expect(seesEveryProject(role)).toBe(false));
  });
});

describe("Project Management HO and the departments", () => {
  const NEW_ROLES = [
    USER_ROLES.PROJECT_HO,
    USER_ROLES.HR_DEPARTMENT,
    USER_ROLES.MACHINERY_DEPARTMENT,
  ];

  it("all use the project portal", () => {
    NEW_ROLES.forEach((role) => {
      expect(usesProjectPortal(role)).toBe(true);
      expect(isProjectEntryRole(role)).toBe(true);
      expect(portalBasePath(role)).toBe("/project-manager");
    });
  });

  it("identifies the two departments", () => {
    expect(isDepartmentRole(USER_ROLES.HR_DEPARTMENT)).toBe(true);
    expect(isDepartmentRole(USER_ROLES.MACHINERY_DEPARTMENT)).toBe(true);
    expect(isDepartmentRole(USER_ROLES.PROJECT_HO)).toBe(false);
    expect(isDepartmentRole(USER_ROLES.PROJECT_MANAGER)).toBe(false);
  });

  it("lands each department on its own page, not the Overview", () => {
    expect(projectMonitorOverviewPath(USER_ROLES.HR_DEPARTMENT)).toBe(
      "/project-manager/hr",
    );
    expect(
      projectMonitorOverviewPath(USER_ROLES.MACHINERY_DEPARTMENT),
    ).toBe("/project-manager/machinery");
    expect(projectMonitorOverviewPath(USER_ROLES.PROJECT_HO)).toBe(
      "/project-manager/dashboard",
    );
  });

  it("lets Admin, Director and the HO manage the masters", () => {
    [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DIRECTOR,
      USER_ROLES.PROJECT_HO,
    ].forEach((role) =>
      expect(canManageProjectMasters(role)).toBe(true),
    );
    [
      USER_ROLES.PROJECT_MANAGER,
      USER_ROLES.PROJECT_INCHARGE,
      USER_ROLES.HR_DEPARTMENT,
      USER_ROLES.STORE_HO,
      USER_ROLES.USER,
    ].forEach((role) =>
      expect(canManageProjectMasters(role)).toBe(false),
    );
  });

  it("signs each role in to a page it can actually open", () => {
    expect(landingPath(USER_ROLES.HR_DEPARTMENT)).toBe(
      "/project-manager/hr",
    );
    expect(landingPath(USER_ROLES.MACHINERY_DEPARTMENT)).toBe(
      "/project-manager/machinery",
    );
    // Everyone else is unchanged: their portal's dashboard.
    expect(landingPath(USER_ROLES.PROJECT_HO)).toBe(
      "/project-manager/dashboard",
    );
    expect(landingPath(USER_ROLES.PROJECT_MANAGER)).toBe(
      "/project-manager/dashboard",
    );
    expect(landingPath(USER_ROLES.DIRECTOR)).toBe(
      "/director/dashboard",
    );
    expect(landingPath(USER_ROLES.ADMIN)).toBe("/admin/dashboard");
    expect(landingPath(USER_ROLES.USER)).toBe("/user/dashboard");
  });

  it("keeps Costing with Director and Admin", () => {
    [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DIRECTOR,
    ].forEach((role) => expect(seesCosting(role)).toBe(true));
    [
      USER_ROLES.PROJECT_HO,
      USER_ROLES.PROJECT_MANAGER,
      USER_ROLES.HR_DEPARTMENT,
    ].forEach((role) => expect(seesCosting(role)).toBe(false));
  });

  it("gives each role the master pages under its own portal", () => {
    expect(projectMonitorStructureTypesPath(USER_ROLES.DIRECTOR)).toBe(
      "/director/project-monitor/structure-types",
    );
    expect(projectMonitorStructureTypesPath(USER_ROLES.PROJECT_HO)).toBe(
      "/project-manager/structure-types",
    );
    expect(projectMonitorStructureTypesPath(USER_ROLES.ADMIN)).toBe(
      "/admin/project-monitor/structure-types",
    );
    expect(projectMonitorRdsoPath(USER_ROLES.DIRECTOR)).toBe(
      "/director/project-monitor/rdso-span-library",
    );
    expect(projectMonitorRdsoPath(USER_ROLES.PROJECT_HO)).toBe(
      "/project-manager/rdso-span-library",
    );
  });
});
