import { describe, expect, it } from "vitest";

import { USER_ROLES } from "../constants/roles";
import {
  getAccessibleModules,
  getDefaultModuleKey,
  getModuleHome,
  getModuleNav,
  MODULE_KEYS,
  resolveActiveModuleKey,
  resolveModuleFromPath,
} from "./moduleRegistry";

const keysFor = (role) =>
  getAccessibleModules(role).map(
    (module) => module.key,
  );

describe("module access by role", () => {
  it("gives Admin and Super Admin every module", () => {
    const all = [
      MODULE_KEYS.APPROVAL,
      MODULE_KEYS.PRODUCTION,
      MODULE_KEYS.PROJECT,
      MODULE_KEYS.ADMINISTRATION,
    ];
    expect(keysFor(USER_ROLES.ADMIN)).toEqual(all);
    expect(keysFor(USER_ROLES.SUPER_ADMIN)).toEqual(
      all,
    );
  });

  it("keeps Administration Admin-only", () => {
    Object.values(USER_ROLES)
      .filter(
        (role) =>
          role !== USER_ROLES.ADMIN &&
          role !== USER_ROLES.SUPER_ADMIN,
      )
      .forEach((role) => {
        expect(keysFor(role)).not.toContain(
          MODULE_KEYS.ADMINISTRATION,
        );
      });
  });

  it("maps the other roles to their modules", () => {
    expect(keysFor(USER_ROLES.DIRECTOR)).toEqual([
      MODULE_KEYS.APPROVAL,
      MODULE_KEYS.PRODUCTION,
      MODULE_KEYS.PROJECT,
    ]);
    expect(keysFor(USER_ROLES.USER)).toEqual([
      MODULE_KEYS.APPROVAL,
    ]);
    expect(
      keysFor(USER_ROLES.RESPONSIBLE_PERSON),
    ).toEqual([MODULE_KEYS.APPROVAL]);
    expect(keysFor(USER_ROLES.STORE_HO)).toEqual([
      MODULE_KEYS.PRODUCTION,
    ]);
    expect(
      keysFor(USER_ROLES.PROJECT_MANAGER),
    ).toEqual([MODULE_KEYS.PROJECT]);
    expect(
      keysFor(USER_ROLES.PROJECT_INCHARGE),
    ).toEqual([MODULE_KEYS.PROJECT]);
  });

  it("gives a Project Incharge the same Project Management module as a Project Manager", () => {
    const incharge = getModuleNav(
      USER_ROLES.PROJECT_INCHARGE,
      MODULE_KEYS.PROJECT,
    );
    expect(incharge).toEqual(
      getModuleNav(
        USER_ROLES.PROJECT_MANAGER,
        MODULE_KEYS.PROJECT,
      ),
    );
    expect(incharge.map((entry) => entry.label)).toEqual([
      "Project Monitor",
    ]);
    expect(
      getModuleHome(
        USER_ROLES.PROJECT_INCHARGE,
        MODULE_KEYS.PROJECT,
      ),
    ).toBe("/project-manager/dashboard");
  });

  it("opens each role in its own module by default", () => {
    expect(getDefaultModuleKey(USER_ROLES.ADMIN)).toBe(
      MODULE_KEYS.APPROVAL,
    );
    expect(
      getDefaultModuleKey(USER_ROLES.STORE_HO),
    ).toBe(MODULE_KEYS.PRODUCTION);
    expect(
      getDefaultModuleKey(USER_ROLES.PROJECT_MANAGER),
    ).toBe(MODULE_KEYS.PROJECT);
  });
});

describe("module navigation", () => {
  const labels = (role, module, capabilities) =>
    getModuleNav(role, module, capabilities).map(
      (entry) => entry.label,
    );

  it("lists ungrouped links first, then Transaction, Master, Reports", () => {
    const nav = getModuleNav(
      USER_ROLES.ADMIN,
      MODULE_KEYS.APPROVAL,
    );
    expect(nav.map((entry) => entry.group)).toEqual([
      undefined,
      "transaction",
      "master",
      "reports",
    ]);
  });

  it("puts Voucher Configuration in Approval Master for Admin only", () => {
    const admin = getModuleNav(
      USER_ROLES.ADMIN,
      MODULE_KEYS.APPROVAL,
    ).find((entry) => entry.key === "vouchers");
    expect(admin.group).toBe("master");

    [
      USER_ROLES.USER,
      USER_ROLES.DIRECTOR,
      USER_ROLES.RESPONSIBLE_PERSON,
    ].forEach((role) => {
      expect(
        labels(role, MODULE_KEYS.APPROVAL),
      ).not.toContain("Voucher Configuration");
    });
  });

  it("keeps the requester's Transaction links", () => {
    expect(
      labels(USER_ROLES.USER, MODULE_KEYS.APPROVAL),
    ).toEqual([
      "Dashboard",
      "Create Request",
      "My Requests",
      "Analytics",
    ]);
  });

  it("gives Store HO both Master and Transaction in Production", () => {
    const nav = getModuleNav(
      USER_ROLES.STORE_HO,
      MODULE_KEYS.PRODUCTION,
    );
    const groups = nav.map((entry) => entry.group);
    expect(groups).toContain("transaction");
    expect(groups).toContain("master");
    expect(
      nav.find((entry) => entry.key === "setup").path,
    ).toBe("/store/settings");
  });

  it("gives the Director reconciliation approvals but no setup", () => {
    const nav = getModuleNav(
      USER_ROLES.DIRECTOR,
      MODULE_KEYS.PRODUCTION,
    );
    expect(nav.map((entry) => entry.label)).toContain(
      "Reconciliation Approvals",
    );
    expect(
      nav.some((entry) => entry.group === "master"),
    ).toBe(false);
  });

  it("makes Project Monitor a Transaction and the setup pages Master", () => {
    const nav = getModuleNav(
      USER_ROLES.ADMIN,
      MODULE_KEYS.PROJECT,
    );
    const group = (key) =>
      nav.find((entry) => entry.key === key).group;
    expect(group("project-monitor")).toBe(
      "transaction",
    );
    expect(group("structure-types")).toBe("master");
    expect(group("rdso-span-library")).toBe("master");
    expect(group("site-access")).toBe("master");

    expect(
      labels(
        USER_ROLES.PROJECT_MANAGER,
        MODULE_KEYS.PROJECT,
      ),
    ).toEqual(["Project Monitor"]);
  });

  it("puts User and Organization Management in Administration Master", () => {
    const nav = getModuleNav(
      USER_ROLES.ADMIN,
      MODULE_KEYS.ADMINISTRATION,
    );
    ["users", "organization"].forEach((key) => {
      expect(
        nav.find((entry) => entry.key === key).group,
      ).toBe("master");
    });
  });

  it("hides items whose capability the person lacks", () => {
    const adminCapabilities = ["view_users", "view_sites"];
    expect(
      labels(
        USER_ROLES.ADMIN,
        MODULE_KEYS.ADMINISTRATION,
        adminCapabilities,
      ),
    ).toEqual(["User Management", "Organization Setup"]);

    expect(
      labels(
        USER_ROLES.SUPER_ADMIN,
        MODULE_KEYS.ADMINISTRATION,
        [
          ...adminCapabilities,
          "view_audit_logs",
          "manage_system_settings",
        ],
      ),
    ).toEqual([
      "User Management",
      "Organization Setup",
      "System Settings",
      "Audit Logs",
    ]);
  });

  it("returns nothing for a module the role cannot open", () => {
    expect(
      getModuleNav(
        USER_ROLES.USER,
        MODULE_KEYS.PRODUCTION,
      ),
    ).toEqual([]);
  });

  it("lands on the first link of each module", () => {
    expect(
      getModuleHome(
        USER_ROLES.ADMIN,
        MODULE_KEYS.APPROVAL,
      ),
    ).toBe("/admin/dashboard");
    expect(
      getModuleHome(
        USER_ROLES.ADMIN,
        MODULE_KEYS.ADMINISTRATION,
      ),
    ).toBe("/admin/users");
    expect(
      getModuleHome(
        USER_ROLES.DIRECTOR,
        MODULE_KEYS.PROJECT,
      ),
    ).toBe("/director/project-monitor");
    expect(
      getModuleHome(
        USER_ROLES.PROJECT_MANAGER,
        MODULE_KEYS.PROJECT,
      ),
    ).toBe("/project-manager/dashboard");
  });
});

describe("resolving the module from the URL", () => {
  it.each([
    ["/admin/dashboard", MODULE_KEYS.APPROVAL],
    ["/admin/vouchers/fields", MODULE_KEYS.APPROVAL],
    ["/admin/requests", MODULE_KEYS.APPROVAL],
    ["/admin/reports", MODULE_KEYS.APPROVAL],
    ["/admin/users", MODULE_KEYS.ADMINISTRATION],
    [
      "/admin/organization/sites",
      MODULE_KEYS.ADMINISTRATION,
    ],
    ["/admin/audit", MODULE_KEYS.ADMINISTRATION],
    ["/admin/reconciliation", MODULE_KEYS.PRODUCTION],
    [
      "/admin/reconciliation/items",
      MODULE_KEYS.PRODUCTION,
    ],
    ["/admin/project-monitor", MODULE_KEYS.PROJECT],
    [
      "/admin/project-monitor/structure-types",
      MODULE_KEYS.PROJECT,
    ],
    ["/store/entry", MODULE_KEYS.PRODUCTION],
    ["/store/settings/items", MODULE_KEYS.PRODUCTION],
    [
      "/director/reconciliation-approvals",
      MODULE_KEYS.PRODUCTION,
    ],
    [
      "/director/project-monitor/dpr-bills",
      MODULE_KEYS.PROJECT,
    ],
    ["/director/approvals/12", MODULE_KEYS.APPROVAL],
    ["/project-manager/structures", MODULE_KEYS.PROJECT],
    ["/user/requests/new", MODULE_KEYS.APPROVAL],
    ["/responsible/assignments", MODULE_KEYS.APPROVAL],
  ])("%s -> %s", (path, expected) => {
    expect(resolveModuleFromPath(path)).toBe(expected);
  });

  it("leaves shared pages unresolved", () => {
    expect(
      resolveModuleFromPath("/admin/notifications"),
    ).toBeNull();
    expect(
      resolveModuleFromPath("/admin/change-password"),
    ).toBeNull();
  });

  it("keeps the remembered module on shared pages", () => {
    expect(
      resolveActiveModuleKey(
        USER_ROLES.ADMIN,
        "/admin/notifications",
        MODULE_KEYS.PROJECT,
      ),
    ).toBe(MODULE_KEYS.PROJECT);
  });

  it("ignores a remembered module the role cannot open", () => {
    expect(
      resolveActiveModuleKey(
        USER_ROLES.USER,
        "/user/notifications",
        MODULE_KEYS.ADMINISTRATION,
      ),
    ).toBe(MODULE_KEYS.APPROVAL);
  });

  it("prefers the URL over the remembered module", () => {
    expect(
      resolveActiveModuleKey(
        USER_ROLES.ADMIN,
        "/admin/project-monitor",
        MODULE_KEYS.APPROVAL,
      ),
    ).toBe(MODULE_KEYS.PROJECT);
  });
});
