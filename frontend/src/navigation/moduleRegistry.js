import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  ClipboardEdit,
  ClipboardList,
  Download,
  FilePlus2,
  FileStack,
  FileText,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  LineChart,
  Milestone,
  PackageCheck,
  Ruler,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Factory,
  FolderKanban,
  Files,
} from "lucide-react";

import {
  isAdminRole,
  projectMonitorOverviewPath,
  USER_ROLES,
} from "../constants/roles";

/**
 * Single source of truth for JNLOps navigation: which modules exist,
 * which roles can open them, and what each role sees inside each one.
 *
 * Every module is organised the ERP way, in three groups:
 * Transaction (day-to-day work), Master (setup data) and Reports.
 * Navigation is data only - URLs and route guards live in the router,
 * so this file can change without touching any page.
 *
 * The role -> modules mapping in `getAccessibleModules` is the one
 * place to replace when per-user module assignments arrive.
 */

export const MODULE_KEYS = Object.freeze({
  APPROVAL: "approval",
  PRODUCTION: "production",
  PROJECT: "project",
  ADMINISTRATION: "administration",
});

export const MODULES = Object.freeze({
  [MODULE_KEYS.APPROVAL]: {
    key: MODULE_KEYS.APPROVAL,
    label: "Approval Management",
    description:
      "Requests, approvals, vouchers",
    icon: ClipboardCheck,
  },
  [MODULE_KEYS.PRODUCTION]: {
    key: MODULE_KEYS.PRODUCTION,
    label: "Production",
    description:
      "Reconciliation and its setup",
    icon: Factory,
  },
  [MODULE_KEYS.PROJECT]: {
    key: MODULE_KEYS.PROJECT,
    label: "Project Management",
    description:
      "Monitoring, DPR, bills, setup",
    icon: FolderKanban,
  },
  [MODULE_KEYS.ADMINISTRATION]: {
    key: MODULE_KEYS.ADMINISTRATION,
    label: "Administration",
    description:
      "Users, organization, audit",
    icon: ShieldCheck,
  },
});

export const NAV_GROUPS = Object.freeze([
  { key: "transaction", label: "Transaction" },
  { key: "master", label: "Master" },
  { key: "reports", label: "Reports" },
]);

const GROUP_ORDER = NAV_GROUPS.map(
  (group) => group.key,
);

const ACTIVE_MODULE_STORAGE_KEY =
  "jnlops-active-module";

function item(
  key,
  label,
  path,
  icon,
  group,
  requiredCapability,
) {
  return {
    key,
    label,
    path,
    icon,
    group,
    requiredCapability,
  };
}

function adminNav(moduleKey) {
  switch (moduleKey) {
    case MODULE_KEYS.APPROVAL:
      return [
        item(
          "dashboard",
          "Dashboard",
          "/admin/dashboard",
          LayoutDashboard,
          undefined,
          "view_admin_dashboard",
        ),
        item(
          "requests",
          "Correction Requests",
          "/admin/requests",
          ClipboardList,
          "transaction",
          "view_correction_requests",
        ),
        item(
          "vouchers",
          "Voucher Configuration",
          "/admin/vouchers",
          FileText,
          "master",
          "view_vouchers",
        ),
        item(
          "reports",
          "Reports and Analytics",
          "/admin/reports",
          BarChart3,
          "reports",
          "view_reports",
        ),
      ];
    case MODULE_KEYS.PRODUCTION:
      return [
        item(
          "dashboard",
          "Dashboard",
          "/store/dashboard",
          LayoutDashboard,
          undefined,
          "view_reconciliation",
        ),
        item(
          "entry",
          "Monthly Entry",
          "/store/entry",
          ClipboardEdit,
          "transaction",
          "view_reconciliation",
        ),
        item(
          "approvals",
          "Reconciliation Approvals",
          "/admin/reconciliation/approvals",
          PackageCheck,
          "transaction",
          "view_reconciliation",
        ),
        item(
          "setup",
          "Reconciliation Setup",
          "/admin/reconciliation",
          SlidersHorizontal,
          "master",
          "view_reconciliation",
        ),
        item(
          "reports",
          "Reports",
          "/admin/reconciliation/reports",
          BarChart3,
          "reports",
          "view_reconciliation",
        ),
        item(
          "statement-pack",
          "Statement Pack",
          "/admin/reconciliation/statement-pack",
          FileStack,
          "reports",
          "view_reconciliation",
        ),
      ];
    case MODULE_KEYS.PROJECT:
      return [
        item(
          "project-monitor",
          "Project Monitor",
          "/admin/project-monitor",
          Milestone,
          "transaction",
          "view_project_monitor",
        ),
        item(
          "structure-types",
          "Structure Types",
          "/admin/project-monitor/structure-types",
          Layers,
          "master",
          "manage_project_monitor",
        ),
        item(
          "rdso-span-library",
          "RDSO Span Library",
          "/admin/project-monitor/rdso-span-library",
          Ruler,
          "master",
          "manage_project_monitor",
        ),
        item(
          "site-access",
          "Site Access",
          "/admin/project-monitor/site-access",
          KeyRound,
          "master",
          "manage_project_monitor",
        ),
      ];
    case MODULE_KEYS.ADMINISTRATION:
      return [
        item(
          "users",
          "User Management",
          "/admin/users",
          Users,
          "master",
          "view_users",
        ),
        item(
          "organization",
          "Organization Setup",
          "/admin/organization",
          Building2,
          "master",
          "view_sites",
        ),
        item(
          "settings",
          "System Settings",
          "/admin/settings",
          Settings,
          "master",
          "manage_system_settings",
        ),
        item(
          "audit",
          "Audit Logs",
          "/admin/audit",
          History,
          "reports",
          "view_audit_logs",
        ),
      ];
    default:
      return [];
  }
}

function directorNav(moduleKey) {
  switch (moduleKey) {
    case MODULE_KEYS.APPROVAL:
      return [
        item(
          "dashboard",
          "Dashboard",
          "/director/dashboard",
          LayoutDashboard,
        ),
        item(
          "approvals",
          "Approval Inbox",
          "/director/approvals",
          ClipboardCheck,
          "transaction",
        ),
        item(
          "analytics",
          "Analytics",
          "/director/analytics",
          LineChart,
          "reports",
        ),
        item(
          "export",
          "Export",
          "/director/export",
          Download,
          "reports",
        ),
      ];
    case MODULE_KEYS.PRODUCTION:
      return [
        item(
          "approvals",
          "Reconciliation Approvals",
          "/director/reconciliation-approvals",
          PackageCheck,
          "transaction",
        ),
        item(
          "reports",
          "Reports",
          "/director/reconciliation",
          BarChart3,
          "reports",
        ),
        item(
          "statement-pack",
          "Statement Pack",
          "/director/reconciliation-pack",
          FileStack,
          "reports",
        ),
      ];
    case MODULE_KEYS.PROJECT:
      return [
        item(
          "project-monitor",
          "Project Monitor",
          projectMonitorOverviewPath(
            USER_ROLES.DIRECTOR,
          ),
          Milestone,
          "transaction",
        ),
      ];
    default:
      return [];
  }
}

function userNav(moduleKey) {
  if (moduleKey !== MODULE_KEYS.APPROVAL) {
    return [];
  }
  return [
    item(
      "dashboard",
      "Dashboard",
      "/user/dashboard",
      LayoutDashboard,
    ),
    item(
      "create",
      "Create Request",
      "/user/requests/new",
      FilePlus2,
      "transaction",
    ),
    item(
      "requests",
      "My Requests",
      "/user/requests",
      ClipboardList,
      "transaction",
    ),
    item(
      "analytics",
      "Analytics",
      "/user/analytics",
      LineChart,
      "reports",
    ),
  ];
}

function responsibleNav(moduleKey) {
  if (moduleKey !== MODULE_KEYS.APPROVAL) {
    return [];
  }
  return [
    item(
      "dashboard",
      "Work Dashboard",
      "/responsible/dashboard",
      LayoutDashboard,
    ),
    item(
      "assigned",
      "Assigned Work",
      "/responsible/assignments",
      BriefcaseBusiness,
      "transaction",
    ),
    item(
      "analytics",
      "Analytics",
      "/responsible/analytics",
      BarChart3,
      "reports",
    ),
  ];
}

function storeNav(moduleKey) {
  if (moduleKey !== MODULE_KEYS.PRODUCTION) {
    return [];
  }
  return [
    item(
      "dashboard",
      "Dashboard",
      "/store/dashboard",
      LayoutDashboard,
    ),
    item(
      "entry",
      "Monthly Entry",
      "/store/entry",
      ClipboardEdit,
      "transaction",
    ),
    item(
      "setup",
      "Reconciliation Setup",
      "/store/settings",
      SlidersHorizontal,
      "master",
    ),
    item(
      "reports",
      "Reports",
      "/store/reports",
      BarChart3,
      "reports",
    ),
    item(
      "statement-pack",
      "Statement Pack",
      "/store/statement-pack",
      Files,
      "reports",
    ),
  ];
}

function projectManagerNav(moduleKey) {
  if (moduleKey !== MODULE_KEYS.PROJECT) {
    return [];
  }
  return [
    item(
      "project-monitor",
      "Project Monitor",
      projectMonitorOverviewPath(
        USER_ROLES.PROJECT_MANAGER,
      ),
      Milestone,
      "transaction",
    ),
  ];
}

const ROLE_MODULES = Object.freeze({
  [USER_ROLES.DIRECTOR]: [
    MODULE_KEYS.APPROVAL,
    MODULE_KEYS.PRODUCTION,
    MODULE_KEYS.PROJECT,
  ],
  [USER_ROLES.USER]: [MODULE_KEYS.APPROVAL],
  [USER_ROLES.RESPONSIBLE_PERSON]: [
    MODULE_KEYS.APPROVAL,
  ],
  [USER_ROLES.STORE_HO]: [MODULE_KEYS.PRODUCTION],
  [USER_ROLES.PROJECT_MANAGER]: [
    MODULE_KEYS.PROJECT,
  ],
});

const ALL_MODULES = Object.freeze([
  MODULE_KEYS.APPROVAL,
  MODULE_KEYS.PRODUCTION,
  MODULE_KEYS.PROJECT,
  MODULE_KEYS.ADMINISTRATION,
]);

/**
 * Modules a role may open, in switcher order. Interim: derived from
 * the role. Per-user module assignments will replace this function.
 */
export function getAccessibleModules(role) {
  const keys = isAdminRole(role)
    ? ALL_MODULES
    : (ROLE_MODULES[role] ?? []);
  return keys.map((key) => MODULES[key]);
}

export function getDefaultModuleKey(role) {
  return getAccessibleModules(role)[0]?.key ?? null;
}

function rawNav(role, moduleKey) {
  if (isAdminRole(role)) {
    return adminNav(moduleKey);
  }
  switch (role) {
    case USER_ROLES.DIRECTOR:
      return directorNav(moduleKey);
    case USER_ROLES.USER:
      return userNav(moduleKey);
    case USER_ROLES.RESPONSIBLE_PERSON:
      return responsibleNav(moduleKey);
    case USER_ROLES.STORE_HO:
      return storeNav(moduleKey);
    case USER_ROLES.PROJECT_MANAGER:
      return projectManagerNav(moduleKey);
    default:
      return [];
  }
}

function orderForSidebar(items) {
  // Ungrouped links (Dashboard) come first, then the groups in ERP
  // order. Array.sort is stable, so each group keeps its own order.
  const rank = (entry) =>
    entry.group
      ? GROUP_ORDER.indexOf(entry.group) + 1
      : 0;
  return [...items].sort(
    (a, b) => rank(a) - rank(b),
  );
}

/**
 * The sidebar items for one role inside one module. `capabilities`
 * (the admin capability list) filters items that declare a
 * `requiredCapability`; pass nothing to skip that filter.
 */
export function getModuleNav(
  role,
  moduleKey,
  capabilities,
) {
  const items = rawNav(role, moduleKey).filter(
    (entry) =>
      !capabilities ||
      !entry.requiredCapability ||
      capabilities.includes(
        entry.requiredCapability,
      ),
  );
  return orderForSidebar(items);
}

export function getModuleHome(role, moduleKey) {
  return (
    getModuleNav(role, moduleKey)[0]?.path ?? "/"
  );
}

// Most specific prefix first. Paths matching nothing here (shared
// pages such as notifications) keep whichever module is current.
const PATH_RULES = [
  [/^\/admin\/project-monitor(\/|$)/, MODULE_KEYS.PROJECT],
  [/^\/admin\/reconciliation(\/|$)/, MODULE_KEYS.PRODUCTION],
  [
    /^\/admin\/(dashboard|requests|vouchers|reports)(\/|$)/,
    MODULE_KEYS.APPROVAL,
  ],
  [
    /^\/admin\/(users|organization|audit|settings)(\/|$)/,
    MODULE_KEYS.ADMINISTRATION,
  ],
  [/^\/store(\/|$)/, MODULE_KEYS.PRODUCTION],
  [/^\/director\/reconciliation/, MODULE_KEYS.PRODUCTION],
  [/^\/director\/project-monitor(\/|$)/, MODULE_KEYS.PROJECT],
  [/^\/project-manager(\/|$)/, MODULE_KEYS.PROJECT],
  [/^\/(director|user|responsible)(\/|$)/, MODULE_KEYS.APPROVAL],
];

export function resolveModuleFromPath(pathname) {
  const match = PATH_RULES.find(([pattern]) =>
    pattern.test(pathname),
  );
  return match ? match[1] : null;
}

/**
 * The module the sidebar should show: the one the current URL belongs
 * to, else the last one the person used, else the role's default.
 * Always one the role can actually open.
 */
export function resolveActiveModuleKey(
  role,
  pathname,
  storedKey,
) {
  const accessible = getAccessibleModules(role).map(
    (module) => module.key,
  );
  const fromPath = resolveModuleFromPath(pathname);
  if (fromPath && accessible.includes(fromPath)) {
    return fromPath;
  }
  if (storedKey && accessible.includes(storedKey)) {
    return storedKey;
  }
  return accessible[0] ?? null;
}

export function readStoredModuleKey() {
  try {
    return window.localStorage.getItem(
      ACTIVE_MODULE_STORAGE_KEY,
    );
  } catch {
    return null;
  }
}

export function storeModuleKey(moduleKey) {
  try {
    window.localStorage.setItem(
      ACTIVE_MODULE_STORAGE_KEY,
      moduleKey,
    );
  } catch {
    // Storage disabled - the module still resolves from the URL.
  }
}
