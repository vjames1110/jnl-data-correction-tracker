import { useMemo, useState } from "react";
import {
  Download,
  KeyRound,
  LockKeyhole,
  Plus,
  Search,
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useDepartmentsDropdown,
  useDesignationsDropdown,
  useSitesDropdown,
} from "../../../hooks/useOrganization";
import {
  useCreateEmployeeAccount,
  useCreateEmployeeProfile,
  useEmployeeDashboard,
  useEmployeeDropdown,
  useEmployeeFilterOptions,
  useEmployeeProfileExport,
  useEmployeeProfiles,
} from "../../../hooks/useEmployees";
import { KpiCard } from "../components/KpiCard";
import {
  buildParams,
  downloadCsv,
} from "../utils/organizationUtils";

const emptyForm = {
  employee_id: "",
  first_name: "",
  last_name: "",
  email: "",
  mobile: "",
  gender: "NOT_SPECIFIED",
  date_of_joining: "",
  employment_status: "CONFIRMED",
  last_working_date: "",
  site: "",
  department: "",
  designation: "",
  reporting_manager: "",
  role: "USER",
  is_active: true,
  erp_user_id: "",
  create_account: true,
  send_notification: false,
};

const fallbackOptions = {
  roles: [
    { value: "USER", label: "User" },
    {
      value: "RESPONSIBLE_PERSON",
      label: "Responsible Person",
    },
    { value: "DIRECTOR", label: "Director" },
    { value: "ADMIN", label: "Admin" },
    {
      value: "SUPER_ADMIN",
      label: "Super Admin",
    },
  ],
  account_statuses: [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
    { value: "LOCKED", label: "Locked" },
    { value: "SUSPENDED", label: "Suspended" },
  ],
  employment_statuses: [
    { value: "PROBATION", label: "Probation" },
    { value: "CONFIRMED", label: "Confirmed" },
    { value: "CONTRACT", label: "Contract" },
    {
      value: "NOTICE_PERIOD",
      label: "Notice Period",
    },
    { value: "RELIEVED", label: "Relieved" },
    { value: "TERMINATED", label: "Terminated" },
  ],
  genders: [
    { value: "NOT_SPECIFIED", label: "Not Specified" },
    { value: "MALE", label: "Male" },
    { value: "FEMALE", label: "Female" },
    { value: "OTHER", label: "Other" },
  ],
};

function optionLabel(options, value) {
  return (
    options.find((option) => option.value === value)
      ?.label ?? value ?? "-"
  );
}

function accountStatus(profile) {
  return (
    profile.user_detail?.account_status ??
    (profile.is_active ? "NO_ACCOUNT" : "INACTIVE")
  );
}

function AccountStatusChip({ profile }) {
  const status = accountStatus(profile);
  const successStatuses = ["ACTIVE"];
  const label =
    status === "NO_ACCOUNT"
      ? "No Account"
      : optionLabel(
          fallbackOptions.account_statuses,
          status,
        );

  return (
    <span
      className={
        successStatuses.includes(status)
          ? "status-chip status-chip--success"
          : "status-chip status-chip--error"
      }
    >
      {label}
    </span>
  );
}

function normalizeProfilePayload(form) {
  return {
    employee_id: form.employee_id,
    first_name: form.first_name,
    last_name: form.last_name,
    email: form.email,
    mobile: form.mobile,
    gender: form.gender,
    date_of_joining:
      form.date_of_joining || null,
    employment_status:
      form.employment_status,
    last_working_date:
      form.last_working_date || null,
    site: form.site || null,
    department: form.department || null,
    designation: form.designation || null,
    reporting_manager:
      form.reporting_manager || null,
    role: form.role,
    is_active: form.is_active,
    erp_user_id: form.erp_user_id,
  };
}

function EmployeeCreatePanel({
  departments,
  designations,
  employees,
  error,
  filterOptions,
  isSubmitting,
  onClose,
  onSubmit,
  sites,
}) {
  const [form, setForm] = useState(emptyForm);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const roleOptions =
    filterOptions.roles ?? fallbackOptions.roles;
  const genderOptions =
    filterOptions.genders ?? fallbackOptions.genders;
  const employmentOptions =
    filterOptions.employment_statuses ??
    fallbackOptions.employment_statuses;

  return (
    <aside className="management-panel employee-panel">
      <div className="management-panel__header">
        <div>
          <span className="page-eyebrow">
            User Management
          </span>
          <h2>Add Employee</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close employee form"
        >
          <X size={18} />
        </button>
      </div>

      {error ? (
        <div className="inline-alert inline-alert--error">
          <strong>{error.message}</strong>
        </div>
      ) : null}

      <form
        className="site-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(form);
        }}
      >
        <section className="employee-form-section">
          <h3>Personal Information</h3>
          <label className="form-field">
            <span>Employee ID</span>
            <input
              value={form.employee_id}
              onChange={(event) =>
                updateField(
                  "employee_id",
                  event.target.value,
                )
              }
              required
            />
          </label>
          <div className="form-grid">
            <label className="form-field">
              <span>First Name</span>
              <input
                value={form.first_name}
                onChange={(event) =>
                  updateField(
                    "first_name",
                    event.target.value,
                  )
                }
                required
              />
            </label>
            <label className="form-field">
              <span>Last Name</span>
              <input
                value={form.last_name}
                onChange={(event) =>
                  updateField(
                    "last_name",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>
          <div className="form-grid">
            <label className="form-field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateField(
                    "email",
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="form-field">
              <span>Mobile</span>
              <input
                value={form.mobile}
                onChange={(event) =>
                  updateField(
                    "mobile",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>
          <label className="form-field">
            <span>Gender</span>
            <select
              value={form.gender}
              onChange={(event) =>
                updateField(
                  "gender",
                  event.target.value,
                )
              }
            >
              {genderOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="employee-form-section">
          <h3>Employment Information</h3>
          <div className="form-grid">
            <label className="form-field">
              <span>Date of Joining</span>
              <input
                type="date"
                value={form.date_of_joining}
                onChange={(event) =>
                  updateField(
                    "date_of_joining",
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="form-field">
              <span>Last Working Date</span>
              <input
                type="date"
                value={form.last_working_date}
                onChange={(event) =>
                  updateField(
                    "last_working_date",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>
          <div className="form-grid">
            <label className="form-field">
              <span>Employment Status</span>
              <select
                value={form.employment_status}
                onChange={(event) =>
                  updateField(
                    "employment_status",
                    event.target.value,
                  )
                }
              >
                {employmentOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>ERP User ID</span>
              <input
                value={form.erp_user_id}
                onChange={(event) =>
                  updateField(
                    "erp_user_id",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className="employee-form-section">
          <h3>Organization Mapping</h3>
          <label className="form-field">
            <span>Site</span>
            <select
              value={form.site}
              onChange={(event) =>
                updateField(
                  "site",
                  event.target.value,
                )
              }
            >
              <option value="">Select site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.code} - {site.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Department</span>
            <select
              value={form.department}
              onChange={(event) =>
                updateField(
                  "department",
                  event.target.value,
                )
              }
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option
                  key={department.id}
                  value={department.id}
                >
                  {department.code} -{" "}
                  {department.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Designation</span>
            <select
              value={form.designation}
              onChange={(event) =>
                updateField(
                  "designation",
                  event.target.value,
                )
              }
            >
              <option value="">Select designation</option>
              {designations.map((designation) => (
                <option
                  key={designation.id}
                  value={designation.id}
                >
                  {designation.code} -{" "}
                  {designation.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Reporting Manager</span>
            <select
              value={form.reporting_manager}
              onChange={(event) =>
                updateField(
                  "reporting_manager",
                  event.target.value,
                )
              }
            >
              <option value="">
                Select reporting manager
              </option>
              {employees.map((employee) => (
                <option
                  key={employee.id}
                  value={employee.id}
                >
                  {employee.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="employee-form-section">
          <h3>Authentication</h3>
          <label className="form-field">
            <span>Role</span>
            <select
              value={form.role}
              onChange={(event) =>
                updateField(
                  "role",
                  event.target.value,
                )
              }
            >
              {roleOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                updateField(
                  "is_active",
                  event.target.checked,
                )
              }
            />
            <span>Active employee</span>
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={form.create_account}
              onChange={(event) =>
                updateField(
                  "create_account",
                  event.target.checked,
                )
              }
            />
            <span>Create user account</span>
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={form.send_notification}
              disabled={!form.create_account}
              onChange={(event) =>
                updateField(
                  "send_notification",
                  event.target.checked,
                )
              }
            />
            <span>Send account notification</span>
          </label>
        </section>

        <div className="management-panel__actions">
          <button
            type="button"
            className="button button--tertiary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Saving..."
              : "Save Employee"}
          </button>
        </div>
      </form>
    </aside>
  );
}

export function EmployeeManagementPage() {
  const [filters, setFilters] = useState({
    search: "",
    site: "",
    department: "",
    role: "",
    account_status: "",
    employment_status: "",
    ordering: "employee_id",
    page: 1,
  });
  const [isFormOpen, setIsFormOpen] =
    useState(false);
  const [
    accountCreationResult,
    setAccountCreationResult,
  ] = useState(null);

  const queryParams = useMemo(
    () => buildParams(filters),
    [filters],
  );
  const exportParams = useMemo(
    () =>
      buildParams({
        search: filters.search,
        site: filters.site,
        department: filters.department,
        role: filters.role,
        account_status:
          filters.account_status,
        employment_status:
          filters.employment_status,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const dashboardQuery =
    useEmployeeDashboard();
  const profilesQuery =
    useEmployeeProfiles(queryParams);
  const exportQuery =
    useEmployeeProfileExport(exportParams);
  const filterOptionsQuery =
    useEmployeeFilterOptions();
  const employeeDropdownQuery =
    useEmployeeDropdown();
  const sitesQuery = useSitesDropdown();
  const departmentsQuery =
    useDepartmentsDropdown();
  const designationsQuery =
    useDesignationsDropdown();
  const createProfile =
    useCreateEmployeeProfile();
  const createAccount =
    useCreateEmployeeAccount();

  const profiles =
    profilesQuery.data?.items ?? [];
  const pagination =
    profilesQuery.data?.meta?.pagination;
  const filterOptions =
    filterOptionsQuery.data ?? {};
  const roleOptions =
    filterOptions.roles ?? fallbackOptions.roles;
  const accountStatusOptions =
    filterOptions.account_statuses ??
    fallbackOptions.account_statuses;
  const employmentStatusOptions =
    filterOptions.employment_statuses ??
    fallbackOptions.employment_statuses;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "employee-profiles.csv",
      result.data ?? [],
      [
        { key: "employee_id", label: "Employee ID" },
        { key: "full_name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "mobile", label: "Mobile" },
        { key: "site_code", label: "Site" },
        {
          key: "department_code",
          label: "Department",
        },
        {
          key: "designation_code",
          label: "Designation",
        },
        { key: "role", label: "Role" },
        {
          key: "employment_status",
          label: "Employment Status",
        },
        { key: "is_active", label: "Active" },
      ],
    );
  };

  const handleCreateEmployee = async (form) => {
    setAccountCreationResult(null);
    const profile =
      await createProfile.mutateAsync(
        normalizeProfilePayload(form),
      );

    if (form.create_account) {
      const account =
        await createAccount.mutateAsync({
          profileId: profile.id,
          payload: {
            role: form.role,
            send_notification:
              form.send_notification,
          },
        });

      setAccountCreationResult({
        employee_id: profile.employee_id,
        temporary_password:
          account.temporary_password,
      });
    }

    setIsFormOpen(false);
  };

  const dashboard =
    dashboardQuery.data ?? {};
  const summary = dashboard.summary ?? {};

  return (
    <div className="organization-page employee-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            User Management
          </span>
          <h1>Employees & User Accounts</h1>
          <p>
            Manage employee profiles, account
            creation and user access readiness.
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={handleExport}
            disabled={exportQuery.isFetching}
          >
            <Download size={17} />
            Export
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus size={17} />
            Add Employee
          </button>
        </div>
      </div>

      {accountCreationResult ? (
        <div className="inline-alert inline-alert--success">
          <KeyRound size={18} />
          <div>
            <strong>
              Temporary password generated for{" "}
              {
                accountCreationResult.employee_id
              }
              .
            </strong>
            <p>
              {
                accountCreationResult.temporary_password
              }
            </p>
          </div>
        </div>
      ) : null}

      {dashboardQuery.isLoading ? (
        <AppLoader label="Loading user dashboard..." />
      ) : dashboardQuery.isError ? (
        <ErrorState
          title="User dashboard unavailable"
          message={
            dashboardQuery.error?.message
          }
          onRetry={dashboardQuery.refetch}
        />
      ) : (
        <>
          <section className="kpi-grid">
            <KpiCard
              label="Total Users"
              value={summary.total_users ?? 0}
              icon={Users}
              helper="Employee profile records"
            />
            <KpiCard
              label="Active Users"
              value={summary.active_users ?? 0}
              icon={UserCheck}
              tone="success"
              helper="Active login accounts"
            />
            <KpiCard
              label="Inactive Users"
              value={summary.inactive_users ?? 0}
              icon={UserX}
              tone="error"
              helper="Inactive profiles or accounts"
            />
            <KpiCard
              label="Locked Users"
              value={summary.locked_users ?? 0}
              icon={LockKeyhole}
              tone="warning"
              helper="Accounts requiring unlock"
            />
            <KpiCard
              label="Suspended Users"
              value={summary.suspended_users ?? 0}
              icon={ShieldAlert}
              tone="error"
              helper="Suspended login accounts"
            />
            <KpiCard
              label="Temporary Passwords"
              value={
                summary.temporary_passwords ?? 0
              }
              icon={KeyRound}
              tone="information"
              helper="Password change pending"
            />
          </section>

          <SurfaceCard title="Role Distribution">
            <div className="role-distribution-list">
              {(
                dashboard.role_distribution ?? []
              ).map((item) => (
                <div key={item.role}>
                  <span>
                    {optionLabel(
                      roleOptions,
                      item.role,
                    )}
                  </span>
                  <strong>{item.count}</strong>
                </div>
              ))}
              {!dashboard.role_distribution
                ?.length ? (
                <EmptyState
                  title="No role data"
                  message="Create employee profiles to see role distribution."
                />
              ) : null}
            </div>
          </SurfaceCard>
        </>
      )}

      <SurfaceCard title="Employees">
        <div className="employee-toolbar">
          <label className="input-control">
            <Search size={17} />
            <input
              value={filters.search}
              onChange={(event) =>
                setFilter(
                  "search",
                  event.target.value,
                )
              }
              placeholder="Search employees"
            />
          </label>
          <label className="filter-control">
            <span>Site</span>
            <select
              value={filters.site}
              onChange={(event) =>
                setFilter(
                  "site",
                  event.target.value,
                )
              }
            >
              <option value="">All sites</option>
              {(sitesQuery.data ?? []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.code}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-control">
            <span>Department</span>
            <select
              value={filters.department}
              onChange={(event) =>
                setFilter(
                  "department",
                  event.target.value,
                )
              }
            >
              <option value="">
                All departments
              </option>
              {(departmentsQuery.data ?? []).map(
                (department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.code}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="filter-control">
            <span>Role</span>
            <select
              value={filters.role}
              onChange={(event) =>
                setFilter(
                  "role",
                  event.target.value,
                )
              }
            >
              <option value="">All roles</option>
              {roleOptions.map((role) => (
                <option
                  key={role.value}
                  value={role.value}
                >
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-control">
            <span>Status</span>
            <select
              value={filters.account_status}
              onChange={(event) =>
                setFilter(
                  "account_status",
                  event.target.value,
                )
              }
            >
              <option value="">All statuses</option>
              {accountStatusOptions.map((statusOption) => (
                <option
                  key={statusOption.value}
                  value={statusOption.value}
                >
                  {statusOption.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-control">
            <span>Employment</span>
            <select
              value={filters.employment_status}
              onChange={(event) =>
                setFilter(
                  "employment_status",
                  event.target.value,
                )
              }
            >
              <option value="">All employment</option>
              {employmentStatusOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {profilesQuery.isLoading ? (
          <AppLoader label="Loading employees..." />
        ) : profilesQuery.isError ? (
          <ErrorState
            title="Employees unavailable"
            message={
              profilesQuery.error?.message
            }
            onRetry={profilesQuery.refetch}
          />
        ) : !profiles.length ? (
          <EmptyState
            title="No employees found"
            message="Adjust filters or add an employee."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Site</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td>{profile.employee_id}</td>
                    <td>
                      <strong>
                        {profile.full_name}
                      </strong>
                      <span className="table-subtext">
                        {profile.email || "-"}
                      </span>
                    </td>
                    <td>
                      {profile.site_code || "-"}
                    </td>
                    <td>
                      {profile.department_code || "-"}
                    </td>
                    <td>
                      {profile.designation_code || "-"}
                    </td>
                    <td>
                      {optionLabel(
                        roleOptions,
                        profile.role,
                      )}
                    </td>
                    <td>
                      <AccountStatusChip
                        profile={profile}
                      />
                    </td>
                    <td>
                      {profile.user_detail?.last_login
                        ? new Date(
                            profile.user_detail.last_login,
                          ).toLocaleString()
                        : "-"}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="button button--tertiary employee-table-action"
                          disabled
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination ? (
          <div className="pagination-bar">
            <span>
              Page {pagination.page} of{" "}
              {pagination.total_pages}
            </span>
            <div>
              <button
                type="button"
                className="button button--tertiary"
                disabled={
                  !pagination.has_previous
                }
                onClick={() =>
                  setFilter(
                    "page",
                    pagination.page - 1,
                  )
                }
              >
                Previous
              </button>
              <button
                type="button"
                className="button button--tertiary"
                disabled={!pagination.has_next}
                onClick={() =>
                  setFilter(
                    "page",
                    pagination.page + 1,
                  )
                }
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </SurfaceCard>

      {isFormOpen ? (
        <EmployeeCreatePanel
          departments={
            departmentsQuery.data ?? []
          }
          designations={
            designationsQuery.data ?? []
          }
          employees={
            employeeDropdownQuery.data ?? []
          }
          error={
            createProfile.error ??
            createAccount.error
          }
          filterOptions={filterOptions}
          isSubmitting={
            createProfile.isPending ||
            createAccount.isPending
          }
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleCreateEmployee}
          sites={sitesQuery.data ?? []}
        />
      ) : null}
    </div>
  );
}
