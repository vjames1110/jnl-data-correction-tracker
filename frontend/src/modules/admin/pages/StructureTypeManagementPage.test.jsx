import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { StructureTypeManagementPage } from "./StructureTypeManagementPage";

const auth = vi.hoisted(() => ({ role: "ADMIN" }));

const hooks = vi.hoisted(() => ({
  useStructureTypes: vi.fn(),
}));

const mutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
};

const GLOBAL_TYPE = {
  id: "t-global",
  code: "MINOR",
  name: "Minor Bridge",
  owner_site: null,
  owner_site_name: null,
  distributed_site_ids: [],
  distributed_site_names: [],
  config_schema: [],
  group_templates: [],
  is_active: true,
};

const SITE_A_TYPE = {
  id: "t-a",
  code: "ESP",
  name: "ESP structure",
  owner_site: "site-a",
  owner_site_name: "Project A",
  distributed_site_ids: [],
  distributed_site_names: [],
  config_schema: [],
  group_templates: [],
  is_active: true,
};

const SITE_B_TYPE = {
  id: "t-b",
  code: "OTHER",
  name: "Other site's type",
  owner_site: "site-b",
  owner_site_name: "Project B",
  distributed_site_ids: ["site-a"],
  distributed_site_names: ["Project A"],
  config_schema: [],
  group_templates: [],
  is_active: true,
};

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useProjectSites: () => ({
    data: [
      { id: "site-a", code: "A", label: "Project A" },
      { id: "site-b", code: "B", label: "Project B" },
    ],
  }),
  useAutoSelectSite: () => {},
  useSiteTasks: () => ({
    isLoading: false,
    has: () => true,
    canEnter: () => true,
  }),
  useStructureTypes: (...args) =>
    hooks.useStructureTypes(...args),
  useCreateStructureType: () => mutation,
  useUpdateStructureType: () => mutation,
  useDeleteStructureType: () => mutation,
  useDistributeStructureType: () => mutation,
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: auth.role } }),
}));

describe("StructureTypeManagementPage", () => {
  beforeEach(() => {
    auth.role = "ADMIN";
    hooks.useStructureTypes.mockReturnValue({
      data: [GLOBAL_TYPE, SITE_A_TYPE],
      isLoading: false,
      isError: false,
    });
  });

  describe("admin-tier roles (Admin/Director/Project HO)", () => {
    it("shows every type with no site picker", () => {
      render(<StructureTypeManagementPage />);

      expect(
        screen.queryByText("Select project"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Minor Bridge")).toBeInTheDocument();
      expect(screen.getByText("ESP structure")).toBeInTheDocument();
    });

    it("labels ownership as Global or the owning project", () => {
      render(<StructureTypeManagementPage />);

      expect(screen.getByText("Global")).toBeInTheDocument();
      expect(screen.getByText("Project A")).toBeInTheDocument();
    });

    it("an Admin may share a site-owned type with other projects", () => {
      render(<StructureTypeManagementPage />);

      expect(
        screen.getByLabelText("Share with other projects"),
      ).toBeInTheDocument();
    });

    it("the Project Management HO cannot share a type (Admin/Director only)", () => {
      auth.role = "PROJECT_HO";
      render(<StructureTypeManagementPage />);

      expect(
        screen.queryByLabelText("Share with other projects"),
      ).not.toBeInTheDocument();
      // The HO still manages the global master like Admin/Director.
      expect(
        screen.getAllByLabelText("Edit structure type"),
      ).toHaveLength(2);
    });

    it("the Director can also share a type", () => {
      auth.role = "DIRECTOR";
      render(<StructureTypeManagementPage />);

      expect(
        screen.getByLabelText("Share with other projects"),
      ).toBeInTheDocument();
    });
  });

  describe("Project Manager / Incharge (site-scoped)", () => {
    beforeEach(() => {
      auth.role = "PROJECT_MANAGER";
    });

    it("shows a project picker instead of the full master view", () => {
      render(<StructureTypeManagementPage />);

      expect(
        screen.getByText("Select project"),
      ).toBeInTheDocument();
    });

    it("asks to pick a project before showing anything", () => {
      render(<StructureTypeManagementPage />);

      expect(
        screen.getByText("Pick a project to get started"),
      ).toBeInTheDocument();
      // Fetching no types at all with no site chosen.
      expect(hooks.useStructureTypes).toHaveBeenCalledWith(
        true,
        "",
      );
    });

    it("can edit a type owned by their own project, but not a global or another project's type", () => {
      hooks.useStructureTypes.mockReturnValue({
        data: [GLOBAL_TYPE, SITE_A_TYPE, SITE_B_TYPE],
        isLoading: false,
        isError: false,
      });
      render(<StructureTypeManagementPage />);

      fireEvent.change(
        screen.getByLabelText("Project"),
        { target: { value: "site-a" } },
      );

      // Three rows: Global (view only), their own ESP (editable),
      // and Project B's type merely distributed to them (view only).
      expect(
        screen.getAllByText("View only"),
      ).toHaveLength(2);
      expect(
        screen.getByLabelText("Edit structure type"),
      ).toBeInTheDocument();
    });

    it("never shows the Share action, even for their own type", () => {
      hooks.useStructureTypes.mockReturnValue({
        data: [SITE_A_TYPE],
        isLoading: false,
        isError: false,
      });
      render(<StructureTypeManagementPage />);

      expect(
        screen.queryByLabelText("Share with other projects"),
      ).not.toBeInTheDocument();
    });
  });
});
