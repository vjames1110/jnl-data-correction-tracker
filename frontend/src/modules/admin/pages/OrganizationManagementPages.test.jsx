import {
  render,
  screen,
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
  useSitesDropdownMock: vi.fn(),
  useUpdateDepartmentMock: vi.fn(),
  useUpdateDesignationMock: vi.fn(),
  useUpdateDirectorMappingMock: vi.fn(),
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
  useSitesDropdown: (...args) =>
    hooks.useSitesDropdownMock(...args),
  useUpdateDepartment: (...args) =>
    hooks.useUpdateDepartmentMock(...args),
  useUpdateDesignation: (...args) =>
    hooks.useUpdateDesignationMock(...args),
  useUpdateDirectorMapping: (...args) =>
    hooks.useUpdateDirectorMappingMock(...args),
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
    await userEvent.type(
      screen.getByLabelText(/effective from/i),
      "2026-07-21",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /save mapping/i,
      }),
    );

    expect(
      screen.getByText(
        /select at least one site or department/i,
      ),
    ).toBeInTheDocument();
  });
});
