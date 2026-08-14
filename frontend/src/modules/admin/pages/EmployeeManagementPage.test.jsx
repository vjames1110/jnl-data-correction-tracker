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
  useActivateEmployeeProfileMock: vi.fn(),
  useChangeEmployeeRoleMock: vi.fn(),
  useCreateEmployeeAccountMock: vi.fn(),
  useCreateEmployeeProfileMock: vi.fn(),
  useDeactivateEmployeeProfileMock: vi.fn(),
  useDepartmentsDropdownMock: vi.fn(),
  useDesignationsDropdownMock: vi.fn(),
  useDownloadEmployeeTemplateMock: vi.fn(),
  useEmployeeDashboardMock: vi.fn(),
  useEmployeeDropdownMock: vi.fn(),
  useEmployeeFilterOptionsMock: vi.fn(),
  useEmployeeImportColumnsMock: vi.fn(),
  useEmployeeLoginHistoryMock: vi.fn(),
  useEmployeeProfileExportMock: vi.fn(),
  useEmployeeProfilesMock: vi.fn(),
  useExportEmployeeFailedRowsMock: vi.fn(),
  useImportEmployeesMock: vi.fn(),
  usePreviewEmployeeImportMock: vi.fn(),
  useReactivateEmployeeAccountMock: vi.fn(),
  useResetEmployeeTemporaryPasswordMock: vi.fn(),
  useRevokeEmployeeSessionsMock: vi.fn(),
  useSuspendEmployeeAccountMock: vi.fn(),
  useSitesDropdownMock: vi.fn(),
  useUnlockEmployeeAccountMock: vi.fn(),
  useUpdateEmployeeProfileMock: vi.fn(),
}));

vi.mock("../../../hooks/useEmployees", () => ({
  useActivateEmployeeProfile: (...args) =>
    hooks.useActivateEmployeeProfileMock(...args),
  useChangeEmployeeRole: (...args) =>
    hooks.useChangeEmployeeRoleMock(...args),
  useCreateEmployeeAccount: (...args) =>
    hooks.useCreateEmployeeAccountMock(...args),
  useCreateEmployeeProfile: (...args) =>
    hooks.useCreateEmployeeProfileMock(...args),
  useDeactivateEmployeeProfile: (...args) =>
    hooks.useDeactivateEmployeeProfileMock(...args),
  useDownloadEmployeeTemplate: (...args) =>
    hooks.useDownloadEmployeeTemplateMock(...args),
  useEmployeeDashboard: (...args) =>
    hooks.useEmployeeDashboardMock(...args),
  useEmployeeDropdown: (...args) =>
    hooks.useEmployeeDropdownMock(...args),
  useEmployeeFilterOptions: (...args) =>
    hooks.useEmployeeFilterOptionsMock(...args),
  useEmployeeImportColumns: (...args) =>
    hooks.useEmployeeImportColumnsMock(...args),
  useEmployeeLoginHistory: (...args) =>
    hooks.useEmployeeLoginHistoryMock(...args),
  useEmployeeProfileExport: (...args) =>
    hooks.useEmployeeProfileExportMock(...args),
  useEmployeeProfiles: (...args) =>
    hooks.useEmployeeProfilesMock(...args),
  useExportEmployeeFailedRows: (...args) =>
    hooks.useExportEmployeeFailedRowsMock(...args),
  useImportEmployees: (...args) =>
    hooks.useImportEmployeesMock(...args),
  usePreviewEmployeeImport: (...args) =>
    hooks.usePreviewEmployeeImportMock(...args),
  useReactivateEmployeeAccount: (...args) =>
    hooks.useReactivateEmployeeAccountMock(...args),
  useResetEmployeeTemporaryPassword: (...args) =>
    hooks.useResetEmployeeTemporaryPasswordMock(...args),
  useRevokeEmployeeSessions: (...args) =>
    hooks.useRevokeEmployeeSessionsMock(...args),
  useSuspendEmployeeAccount: (...args) =>
    hooks.useSuspendEmployeeAccountMock(...args),
  useUnlockEmployeeAccount: (...args) =>
    hooks.useUnlockEmployeeAccountMock(...args),
  useUpdateEmployeeProfile: (...args) =>
    hooks.useUpdateEmployeeProfileMock(...args),
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
            first_name: "Asha",
            last_name: "Sharma",
            full_name: "Asha Sharma",
            email: "asha.sharma@jnl.com",
            site_code: "BKN",
            department_code: "FIN",
            designation_code: "HOD",
            role: "USER",
            is_active: true,
            user_detail: {
              id: "user-1",
              account_status: "ACTIVE",
              is_active: true,
              must_change_password: true,
              last_login: null,
            },
            created_at: "2026-07-21T10:00:00Z",
            updated_at: "2026-07-21T10:00:00Z",
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
    hooks.useEmployeeImportColumnsMock.mockReturnValue(
      {
        data: {
          columns: [],
          required_columns: [],
        },
      },
    );
    hooks.useCreateEmployeeProfileMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useCreateEmployeeAccountMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useUpdateEmployeeProfileMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useActivateEmployeeProfileMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useDeactivateEmployeeProfileMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useResetEmployeeTemporaryPasswordMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useUnlockEmployeeAccountMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useSuspendEmployeeAccountMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useReactivateEmployeeAccountMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useChangeEmployeeRoleMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useRevokeEmployeeSessionsMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useEmployeeLoginHistoryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          id: "history-1",
          event_type: "LOGIN_SUCCESS",
          was_successful: true,
          created_at: "2026-07-21T10:05:00Z",
        },
      ],
    });
    hooks.useDownloadEmployeeTemplateMock.mockReturnValue(
      mutationMock(),
    );
    hooks.usePreviewEmployeeImportMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useImportEmployeesMock.mockReturnValue(
      mutationMock(),
    );
    hooks.useExportEmployeeFailedRowsMock.mockReturnValue(
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
        employee_id: "",
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

  it("opens employee details and resets temporary password", async () => {
    const resetPassword = mutationMock({
      mutateAsync: vi.fn().mockResolvedValue({
        temporary_password: "ResetPass123!",
      }),
    });
    hooks.useResetEmployeeTemporaryPasswordMock.mockReturnValue(
      resetPassword,
    );

    render(<EmployeeManagementPage />);

    await userEvent.click(
      screen.getByRole("button", {
        name: /details/i,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: /asha sharma/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Login History"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("LOGIN_SUCCESS"),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /reset password/i,
      }),
    );

    expect(
      resetPassword.mutateAsync,
    ).toHaveBeenCalledWith("profile-1");
    expect(
      await screen.findByText("ResetPass123!"),
    ).toBeInTheDocument();
  });

  it("edits an employee profile", async () => {
    const updateProfile = mutationMock({
      mutateAsync: vi.fn().mockResolvedValue({
        id: "profile-1",
      }),
    });
    hooks.useUpdateEmployeeProfileMock.mockReturnValue(
      updateProfile,
    );

    render(<EmployeeManagementPage />);

    await userEvent.click(
      screen.getByRole("button", {
        name: /^edit$/i,
      }),
    );

    const panel = screen.getByRole("complementary");
    const mobileInput =
      within(panel).getByLabelText(/mobile/i);
    await userEvent.clear(mobileInput);
    await userEvent.type(
      mobileInput,
      "9999999999",
    );
    await userEvent.click(
      within(panel).getByRole("button", {
        name: /update employee/i,
      }),
    );

    expect(
      updateProfile.mutateAsync,
    ).toHaveBeenCalledWith({
      profileId: "profile-1",
      payload: expect.objectContaining({
        mobile: "9999999999",
      }),
    });
  });

  it("previews and confirms bulk employee import", async () => {
    const previewImport = mutationMock({
      mutateAsync: vi.fn().mockResolvedValue({
        summary: {
          total_rows: 2,
          valid_rows: 1,
          failed_rows: 1,
        },
        failed_rows: [
          {
            row_number: 3,
            row: { employee_id: "EMP003" },
            errors: ["Site mapping not found"],
          },
        ],
      }),
    });
    const importEmployees = mutationMock({
      mutateAsync: vi.fn().mockResolvedValue({
        summary: {
          total_rows: 2,
          created_rows: 1,
          failed_rows: 1,
        },
        failed_rows: [],
      }),
    });
    hooks.usePreviewEmployeeImportMock.mockReturnValue(
      previewImport,
    );
    hooks.useImportEmployeesMock.mockReturnValue(
      importEmployees,
    );

    render(<EmployeeManagementPage />);

    await userEvent.click(
      screen.getByRole("button", {
        name: /import/i,
      }),
    );

    const panel = screen.getByRole("complementary");
    const file = new File(
      ["employee_id,first_name\nEMP003,Test"],
      "employees.csv",
      { type: "text/csv" },
    );

    await userEvent.upload(
      within(panel).getByLabelText(
        /select csv or excel file/i,
      ),
      file,
    );
    await userEvent.click(
      within(panel).getByRole("button", {
        name: /preview validation/i,
      }),
    );

    expect(
      previewImport.mutateAsync,
    ).toHaveBeenCalledWith(file);
    expect(
      await screen.findByText(
        "Site mapping not found",
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      within(panel).getByRole("button", {
        name: /confirm import/i,
      }),
    );

    expect(
      importEmployees.mutateAsync,
    ).toHaveBeenCalledWith(file);
    expect(
      await screen.findByText(/import completed/i),
    ).toBeInTheDocument();
  });
});
