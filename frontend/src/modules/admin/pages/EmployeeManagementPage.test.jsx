import {
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { EmployeeManagementPage } from "./EmployeeManagementPage";

const hooks = vi.hoisted(() => ({
  useCreateEmployeeAccountMock: vi.fn(),
  useCreateEmployeeProfileMock: vi.fn(),
  useDepartmentsDropdownMock: vi.fn(),
  useDesignationsDropdownMock: vi.fn(),
  useEmployeeDashboardMock: vi.fn(),
  useEmployeeDropdownMock: vi.fn(),
  useEmployeeFilterOptionsMock: vi.fn(),
  useEmployeeProfileExportMock: vi.fn(),
  useEmployeeProfilesMock: vi.fn(),
  useSitesDropdownMock: vi.fn(),
}));

vi.mock("../../../hooks/useEmployees", () => ({
  useCreateEmployeeAccount: (...args) =>
    hooks.useCreateEmployeeAccountMock(...args),
  useCreateEmployeeProfile: (...args) =>
    hooks.useCreateEmployeeProfileMock(...args),
  useEmployeeDashboard: (...args) =>
    hooks.useEmployeeDashboardMock(...args),
  useEmployeeDropdown: (...args) =>
    hooks.useEmployeeDropdownMock(...args),
  useEmployeeFilterOptions: (...args) =>
    hooks.useEmployeeFilterOptionsMock(...args),
  useEmployeeProfileExport: (...args) =>
    hooks.useEmployeeProfileExportMock(...args),
  useEmployeeProfiles: (...args) =>
    hooks.useEmployeeProfilesMock(...args),
}));

vi.mock("../../../hooks/useOrganization", () => ({
  useDepartmentsDropdown: (...args) =>
    hooks.useDepartmentsDropdownMock(...args),
  useDesignationsDropdown: (...args) =>
    hooks.useDesignationsDropdownMock(...args),
  useSitesDropdown: (...args) =>
    hooks.useSitesDropdownMock(...args),
}));

function mutationMock(overrides = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    ...overrides,
  };
}

const filterOptions = {
  roles: [
    { value: "USER", label: "User" },
    { value: "ADMIN", label: "Admin" },
  ],
  account_statuses: [
    { value: "ACTIVE", label: "Active" },
    { value: "LOCKED", label: "Locked" },
  ],
  employment_statuses: [
    { value: "CONFIRMED", label: "Confirmed" },
    { value: "PROBATION", label: "Probation" },
  ],
  genders: [
    {
      value: "NOT_SPECIFIED",
      label: "Not Specified",
    },
    { value: "FEMALE", label: "Female" },
  ],
};

describe("EmployeeManagementPage", () => {
  beforeEach(() => {
    Object.values(hooks).forEach((mock) =>
      mock.mockReset(),
    );

    hooks.useEmployeeDashboardMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        summary: {
          total_users: 2,
          active_users: 1,
          inactive_users: 0,
          locked_users: 1,
          suspended_users: 0,
          temporary_passwords: 1,
        },
        role_distribution: [
          { role: "USER", count: 1 },
          { role: "ADMIN", count: 1 },
        ],
      },
    });
    hooks.useEmployeeProfilesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [
          {
            id: "profile-1",
            employee_id: "EMP001",
            full_name: "Asha Sharma",
            email: "asha.sharma@jnl.com",
            site_code: "BKN",
            department_code: "FIN",
            designation_code: "HOD",
            role: "USER",
            is_active: true,
            user_detail: {
              account_status: "ACTIVE",
              is_active: true,
              must_change_password: true,
              last_login: null,
            },
          },
        ],
        meta: {},
      },
    });
    hooks.useEmployeeFilterOptionsMock.mockReturnValue({
      data: filterOptions,
    });
    hooks.useEmployeeProfileExportMock.mockReturnValue({
      refetch: vi.fn(),
      isFetching: false,
    });
    hooks.useEmployeeDropdownMock.mockReturnValue({
      data: [
        {
          id: "manager-1",
          label: "MGR001 - Reporting Manager",
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
    hooks.useDepartmentsDropdownMock.mockReturnValue({
      data: [
        {
          id: "department-1",
          code: "FIN",
          label: "Finance",
        },
      ],
    });
    hooks.useDesignationsDropdownMock.mockReturnValue({
      data: [
        {
          id: "designation-1",
          code: "HOD",
          label: "Head of Department",
        },
      ],
    });
    hooks.useCreateEmployeeProfileMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useCreateEmployeeAccountMock.mockReturnValue(
      mutationMock(),
    );
  });

  it("renders user dashboard and employee table", () => {
    render(<EmployeeManagementPage />);

    expect(
      screen.getByRole("heading", {
        name: /employees & user accounts/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Total Users"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Locked Users"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Asha Sharma"),
    ).toBeInTheDocument();
    const employeeRow = screen
      .getByText("Asha Sharma")
      .closest("tr");
    expect(
      within(employeeRow).getByText("BKN"),
    ).toBeInTheDocument();
    expect(
      within(employeeRow).getByText("Active"),
    ).toBeInTheDocument();
  });

  it("creates an employee profile and user account", async () => {
    const createProfile = mutationMock({
      mutateAsync: vi.fn().mockResolvedValue({
        id: "profile-2",
        employee_id: "EMP002",
      }),
    });
    const createAccount = mutationMock({
      mutateAsync: vi.fn().mockResolvedValue({
        temporary_password: "TmpPass123!",
      }),
    });

    hooks.useCreateEmployeeProfileMock.mockReturnValue(
      createProfile,
    );
    hooks.useCreateEmployeeAccountMock.mockReturnValue(
      createAccount,
    );

    render(<EmployeeManagementPage />);

    await userEvent.click(
      screen.getByRole("button", {
        name: /add employee/i,
      }),
    );

    const panel = screen.getByRole("complementary");

    await userEvent.type(
      within(panel).getByLabelText(/employee id/i),
      "EMP002",
    );
    await userEvent.type(
      within(panel).getByLabelText(/first name/i),
      "Ravi",
    );
    await userEvent.type(
      within(panel).getByLabelText(/last name/i),
      "Verma",
    );
    await userEvent.type(
      within(panel).getByLabelText(/^email$/i),
      "ravi.verma@jnl.com",
    );
    await userEvent.selectOptions(
      within(panel).getByLabelText(/^site$/i),
      "site-1",
    );
    await userEvent.selectOptions(
      within(panel).getByLabelText(/^department$/i),
      "department-1",
    );
    await userEvent.selectOptions(
      within(panel).getByLabelText(/^designation$/i),
      "designation-1",
    );
    await userEvent.selectOptions(
      within(panel).getByLabelText(/^role$/i),
      "ADMIN",
    );
    await userEvent.click(
      within(panel).getByLabelText(
        /send account notification/i,
      ),
    );
    await userEvent.click(
      within(panel).getByRole("button", {
        name: /save employee/i,
      }),
    );

    expect(
      createProfile.mutateAsync,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        employee_id: "EMP002",
        first_name: "Ravi",
        last_name: "Verma",
        email: "ravi.verma@jnl.com",
        site: "site-1",
        department: "department-1",
        designation: "designation-1",
        role: "ADMIN",
      }),
    );
    expect(
      createAccount.mutateAsync,
    ).toHaveBeenCalledWith({
      profileId: "profile-2",
      payload: {
        role: "ADMIN",
        send_notification: true,
      },
    });
    expect(
      await screen.findByText(/temporary password generated/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("TmpPass123!"),
    ).toBeInTheDocument();
  });
});
