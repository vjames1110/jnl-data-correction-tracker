import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { DepartmentManagementPage } from "./DepartmentManagementPage";
import { DesignationManagementPage } from "./DesignationManagementPage";
import { DirectorMappingPage } from "./DirectorMappingPage";
import { HodMappingPage } from "./HodMappingPage";

const hooks = vi.hoisted(() => ({
  useActivateDepartmentMock: vi.fn(),
  useActivateDesignationMock: vi.fn(),
  useActivateDirectorMappingMock: vi.fn(),
  useCompaniesDropdownMock: vi.fn(),
  useCreateDepartmentMock: vi.fn(),
  useCreateDesignationMock: vi.fn(),
  useCreateDirectorMappingMock: vi.fn(),
  useDeactivateDepartmentMock: vi.fn(),
  useDeactivateDesignationMock: vi.fn(),
  useDeactivateDirectorMappingMock: vi.fn(),
  useDepartmentExportMock: vi.fn(),
  useDepartmentsMock: vi.fn(),
  useDepartmentsDropdownMock: vi.fn(),
  useDesignationExportMock: vi.fn(),
  useDesignationsMock: vi.fn(),
  useDirectorMappingExportMock: vi.fn(),
  useDirectorMappingsMock: vi.fn(),
  useHodMappingsMock: vi.fn(),
  useSitesDropdownMock: vi.fn(),
  useUpdateDepartmentMock: vi.fn(),
  useUpdateDepartmentHodMock: vi.fn(),
  useUpdateDesignationMock: vi.fn(),
  useUpdateDirectorMappingMock: vi.fn(),
  useUpdateSiteHodMock: vi.fn(),
  useUsersDropdownMock: vi.fn(),
}));

vi.mock("../../../hooks/useOrganization", () => ({
  useActivateDepartment: (...args) =>
    hooks.useActivateDepartmentMock(...args),
  useActivateDesignation: (...args) =>
    hooks.useActivateDesignationMock(...args),
  useActivateDirectorMapping: (...args) =>
    hooks.useActivateDirectorMappingMock(...args),
  useCompaniesDropdown: (...args) =>
    hooks.useCompaniesDropdownMock(...args),
  useCreateDepartment: (...args) =>
    hooks.useCreateDepartmentMock(...args),
  useCreateDesignation: (...args) =>
    hooks.useCreateDesignationMock(...args),
  useCreateDirectorMapping: (...args) =>
    hooks.useCreateDirectorMappingMock(...args),
  useDeactivateDepartment: (...args) =>
    hooks.useDeactivateDepartmentMock(...args),
  useDeactivateDesignation: (...args) =>
    hooks.useDeactivateDesignationMock(...args),
  useDeactivateDirectorMapping: (...args) =>
    hooks.useDeactivateDirectorMappingMock(...args),
  useDepartmentExport: (...args) =>
    hooks.useDepartmentExportMock(...args),
  useDepartments: (...args) =>
    hooks.useDepartmentsMock(...args),
  useDepartmentsDropdown: (...args) =>
    hooks.useDepartmentsDropdownMock(...args),
  useDesignationExport: (...args) =>
    hooks.useDesignationExportMock(...args),
  useDesignations: (...args) =>
    hooks.useDesignationsMock(...args),
  useDirectorMappingExport: (...args) =>
    hooks.useDirectorMappingExportMock(...args),
  useDirectorMappings: (...args) =>
    hooks.useDirectorMappingsMock(...args),
  useHodMappings: (...args) =>
    hooks.useHodMappingsMock(...args),
  useSitesDropdown: (...args) =>
    hooks.useSitesDropdownMock(...args),
  useUpdateDepartment: (...args) =>
    hooks.useUpdateDepartmentMock(...args),
  useUpdateDepartmentHod: (...args) =>
    hooks.useUpdateDepartmentHodMock(...args),
  useUpdateDesignation: (...args) =>
    hooks.useUpdateDesignationMock(...args),
  useUpdateDirectorMapping: (...args) =>
    hooks.useUpdateDirectorMappingMock(...args),
  useUpdateSiteHod: (...args) =>
    hooks.useUpdateSiteHodMock(...args),
  useUsersDropdown: (...args) =>
    hooks.useUsersDropdownMock(...args),
}));

function mutationMock() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  };
}

function renderWithRouter(element) {
  render(
    <MemoryRouter>{element}</MemoryRouter>,
  );
}

describe("Organization management pages", () => {
  beforeEach(() => {
    Object.values(hooks).forEach((mock) =>
      mock.mockReset(),
    );

    hooks.useCompaniesDropdownMock.mockReturnValue({
      data: [
        {
          id: "company-1",
          code: "JNL",
          label: "Jhajharia Nirman Limited",
        },
      ],
    });
    hooks.useDepartmentsDropdownMock.mockReturnValue({
      data: [
        {
          id: "department-1",
          code: "FIN",
          label: "Finance",
        },
      ],
    });
    hooks.useSitesDropdownMock.mockReturnValue({
      data: [
        {
          id: "site-1",
          code: "BKN",
          label: "Bikaner Site",
        },
        {
          id: "site-2",
          code: "JPR",
          label: "Jaipur Site",
        },
      ],
    });
    hooks.useUsersDropdownMock.mockReturnValue({
      data: [
        {
          id: "director-1",
          employee_id: "DIR001",
          full_name: "Site Director",
          label: "DIR001 - Site Director",
        },
      ],
    });

    [
      hooks.useCreateDepartmentMock,
      hooks.useUpdateDepartmentMock,
      hooks.useActivateDepartmentMock,
      hooks.useDeactivateDepartmentMock,
      hooks.useCreateDesignationMock,
      hooks.useUpdateDesignationMock,
      hooks.useActivateDesignationMock,
      hooks.useDeactivateDesignationMock,
      hooks.useCreateDirectorMappingMock,
      hooks.useUpdateDirectorMappingMock,
      hooks.useActivateDirectorMappingMock,
      hooks.useDeactivateDirectorMappingMock,
      hooks.useUpdateSiteHodMock,
      hooks.useUpdateDepartmentHodMock,
    ].forEach((mock) =>
      mock.mockReturnValue(mutationMock()),
    );

    [
      hooks.useDepartmentExportMock,
      hooks.useDesignationExportMock,
      hooks.useDirectorMappingExportMock,
    ].forEach((mock) =>
      mock.mockReturnValue({
        refetch: vi.fn(),
        isFetching: false,
      }),
    );
  });

  it("renders department records and add form", async () => {
    hooks.useDepartmentsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [
          {
            id: "department-1",
            company: "company-1",
            company_code: "JNL",
            department_code: "FIN",
            department_name: "Finance",
            description: "Accounts team",
            display_order: 10,
            is_active: true,
          },
        ],
        meta: {},
      },
    });

    renderWithRouter(
      <DepartmentManagementPage />,
    );

    expect(
      screen.getByText("Finance"),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /add department/i,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: /add department/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders designation records and add form", async () => {
    hooks.useDesignationsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [
          {
            id: "designation-1",
            designation_code: "ACC",
            designation_name: "Accountant",
            level: 5,
            is_active: true,
          },
        ],
        meta: {},
      },
    });

    renderWithRouter(
      <DesignationManagementPage />,
    );

    expect(
      screen.getByText("Accountant"),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /add designation/i,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: /add designation/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders director mappings and validates mapping context", async () => {
    const createDirectorMapping =
      mutationMock();
    hooks.useCreateDirectorMappingMock.mockReturnValue(
      createDirectorMapping,
    );
    hooks.useDirectorMappingsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [
          {
            id: "mapping-1",
            director: "director-1",
            director_detail: {
              employee_id: "DIR001",
              full_name: "Site Director",
            },
            site: "site-1",
            site_code: "BKN",
            department: null,
            department_code: "",
            authority_type: "PRIMARY",
            effective_from: "2026-07-21",
            effective_to: null,
            is_active: true,
          },
        ],
        meta: {},
      },
    });

    renderWithRouter(<DirectorMappingPage />);

    expect(
      screen.getByText("Site Director"),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /add mapping/i,
      }),
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/^director$/i),
      "director-1",
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/^sites$/i),
      ["site-1", "site-2"],
    );
    await userEvent.type(
      screen.getByLabelText(/effective from/i),
      "2026-07-21",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /save mapping/i,
      }),
    );

    await waitFor(() => {
      expect(
        createDirectorMapping.mutateAsync,
      ).toHaveBeenCalledTimes(2);
    });
    expect(
      createDirectorMapping.mutateAsync,
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        director: "director-1",
        site: "site-1",
        department: null,
        effective_from: "2026-07-21",
      }),
    );
    expect(
      createDirectorMapping.mutateAsync,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        director: "director-1",
        site: "site-2",
        department: null,
        effective_from: "2026-07-21",
      }),
    );
  });

  it("renders HOD mappings and saves selected HODs", async () => {
    const updateSiteHod =
      mutationMock();
    const updateDepartmentHod =
      mutationMock();

    hooks.useUpdateSiteHodMock.mockReturnValue(
      updateSiteHod,
    );
    hooks.useUpdateDepartmentHodMock.mockReturnValue(
      updateDepartmentHod,
    );
    hooks.useHodMappingsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        summary: {
          sites: 1,
          departments: 1,
          missing_site_hods: 1,
          missing_department_hods: 1,
          incomplete_mapping_history: 0,
          total_missing: 2,
        },
        sites: [
          {
            id: "site-1",
            company_code: "JNL",
            site_code: "BKN",
            site_name: "Bikaner Site",
            site_hod: null,
            site_hod_detail: null,
          },
        ],
        departments: [
          {
            id: "department-1",
            company_code: "JNL",
            department_code: "FIN",
            department_name: "Finance",
            department_hod: null,
            department_hod_detail: null,
          },
        ],
        site_department_mappings: [
          {
            id: "history-1",
            site_code: "BKN",
            site_name: "Bikaner Site",
            department_code: "FIN",
            department_name: "Finance",
            site_hod_detail: {
              full_name: "Site Director",
            },
            department_hod_detail: {
              full_name: "Site Director",
            },
            effective_date: "2026-07-21",
            is_active: true,
          },
        ],
        users: [
          {
            id: "director-1",
            label: "DIR001 - Site Director",
          },
        ],
        employees: [
          {
            id: "employee-1",
            label: "SPM001 - Site PM Candidate",
          },
        ],
        missing: {
          site_hods: [
            {
              id: "site-1",
              site_code: "BKN",
              site_name: "Bikaner Site",
            },
          ],
          department_hods: [
            {
              id: "department-1",
              department_code: "FIN",
              department_name: "Finance",
            },
          ],
        },
      },
    });

    renderWithRouter(<HodMappingPage />);

    expect(
      screen.getByText(/2 PM\/HOD mapping gaps/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mapping History"),
    ).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByRole("combobox", {
        name: /site pm for bikaner site/i,
      }),
      "employee-1",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /save site pm for bikaner site/i,
      }),
    );

    expect(
      updateSiteHod.mutateAsync,
    ).toHaveBeenCalledWith({
      id: "site-1",
      siteHod: "employee-1",
    });

    await userEvent.selectOptions(
      screen.getByRole("combobox", {
        name: /department hod for finance/i,
      }),
      "director-1",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /save department hod for finance/i,
      }),
    );

    expect(
      updateDepartmentHod.mutateAsync,
    ).toHaveBeenCalledWith({
      id: "department-1",
      departmentHod: "director-1",
    });
  });

  it("collapses and expands the Site PM and Department HOD sections", async () => {
    hooks.useUpdateSiteHodMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useUpdateDepartmentHodMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useHodMappingsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        summary: {
          sites: 1,
          departments: 1,
          missing_site_hods: 0,
          missing_department_hods: 0,
          incomplete_mapping_history: 0,
          total_missing: 0,
        },
        sites: [
          {
            id: "site-1",
            company_code: "JNL",
            site_code: "BKN",
            site_name: "Bikaner Site",
            site_hod: null,
            site_hod_detail: null,
          },
        ],
        departments: [
          {
            id: "department-1",
            company_code: "JNL",
            department_code: "FIN",
            department_name: "Finance",
            department_hod: null,
            department_hod_detail: null,
          },
        ],
        site_department_mappings: [],
        users: [],
        missing: {
          site_hods: [],
          department_hods: [],
        },
      },
    });

    renderWithRouter(<HodMappingPage />);

    expect(
      screen.getByRole("combobox", {
        name: /site pm for bikaner site/i,
      }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /collapse site pm section/i,
      }),
    );

    expect(
      screen.queryByRole("combobox", {
        name: /site pm for bikaner site/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", {
        name: /department hod for finance/i,
      }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /expand site pm section/i,
      }),
    );

    expect(
      screen.getByRole("combobox", {
        name: /site pm for bikaner site/i,
      }),
    ).toBeInTheDocument();
  });
});
