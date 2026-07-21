import { useMemo, useState } from "react";
import {
  Download,
  Pencil,
  Plus,
  Power,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  ManagementPanel,
  StatusChip,
} from "../components/OrganizationControls";
import {
  buildParams,
  downloadCsv,
} from "../utils/organizationUtils";
import {
  useActivateDepartment,
  useCompaniesDropdown,
  useCreateDepartment,
  useDeactivateDepartment,
  useDepartmentExport,
  useDepartments,
  useUpdateDepartment,
  useUsersDropdown,
} from "../../../hooks/useOrganization";

const emptyForm = {
  company: "",
  department_code: "",
  department_name: "",
  description: "",
  department_hod: "",
  display_order: 0,
  is_active: true,
};

function DepartmentForm({
  companies,
  users,
  department,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() =>
    department
      ? {
          company: department.company ?? "",
          department_code:
            department.department_code ?? "",
          department_name:
            department.department_name ?? "",
          description:
            department.description ?? "",
          department_hod:
            department.department_hod ?? "",
          display_order:
            department.display_order ?? 0,
          is_active:
            department.is_active ?? true,
        }
      : emptyForm,
  );

  const setField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <ManagementPanel
      eyebrow="Department Master"
      title={
        department
          ? "Edit Department"
          : "Add Department"
      }
      onClose={onClose}
    >
      {error ? (
        <div className="inline-alert inline-alert--error">
          <strong>{error.message}</strong>
        </div>
      ) : null}

      <form
        className="site-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            ...form,
            department_hod:
              form.department_hod || null,
            display_order: Number(
              form.display_order || 0,
            ),
          });
        }}
      >
        <label className="form-field">
          <span>Company</span>
          <select
            value={form.company}
            onChange={(event) =>
              setField(
                "company",
                event.target.value,
              )
            }
            required
          >
            <option value="" disabled hidden>
              Select company
            </option>
            {companies.map((company) => (
              <option
                key={company.id}
                value={company.id}
              >
                {company.code} - {company.label}
              </option>
            ))}
          </select>
        </label>

        <div className="form-grid">
          <label className="form-field">
            <span>Department Code</span>
            <input
              value={form.department_code}
              onChange={(event) =>
                setField(
                  "department_code",
                  event.target.value,
                )
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Department Name</span>
            <input
              value={form.department_name}
              onChange={(event) =>
                setField(
                  "department_name",
                  event.target.value,
                )
              }
              required
            />
          </label>
        </div>

        <label className="form-field">
          <span>Description</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) =>
              setField(
                "description",
                event.target.value,
              )
            }
          />
        </label>

        <div className="form-grid">
          <label className="form-field">
            <span>Department HOD</span>
            <select
              value={form.department_hod}
              onChange={(event) =>
                setField(
                  "department_hod",
                  event.target.value,
                )
              }
            >
              <option value="" disabled hidden>
                Select HOD
              </option>
              {users.map((user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Display Order</span>
            <input
              type="number"
              min="0"
              value={form.display_order}
              onChange={(event) =>
                setField(
                  "display_order",
                  event.target.value,
                )
              }
            />
          </label>
        </div>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) =>
              setField(
                "is_active",
                event.target.checked,
              )
            }
          />
          <span>Active department</span>
        </label>

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
              : "Save Department"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function DepartmentManagementPage() {
  const [filters, setFilters] = useState({
    search: "",
    company: "",
    is_active: "",
    ordering: "display_order",
    page: 1,
  });
  const [editingDepartment, setEditingDepartment] =
    useState(null);
  const [isFormOpen, setIsFormOpen] =
    useState(false);

  const queryParams = useMemo(
    () => buildParams(filters),
    [filters],
  );
  const exportParams = useMemo(
    () =>
      buildParams({
        search: filters.search,
        company: filters.company,
        is_active: filters.is_active,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const departmentsQuery =
    useDepartments(queryParams);
  const companiesQuery =
    useCompaniesDropdown();
  const usersQuery = useUsersDropdown();
  const exportQuery =
    useDepartmentExport(exportParams);
  const createDepartment =
    useCreateDepartment();
  const updateDepartment =
    useUpdateDepartment();
  const activateDepartment =
    useActivateDepartment();
  const deactivateDepartment =
    useDeactivateDepartment();

  const departments =
    departmentsQuery.data?.items ?? [];
  const pagination =
    departmentsQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingDepartment) {
      await updateDepartment.mutateAsync({
        id: editingDepartment.id,
        payload,
      });
    } else {
      await createDepartment.mutateAsync(
        payload,
      );
    }

    setEditingDepartment(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "organization-departments.csv",
      result.data ?? [],
      [
        {
          key: "department_code",
          label: "Department Code",
        },
        {
          key: "department_name",
          label: "Department Name",
        },
        {
          key: "company_name",
          label: "Company",
        },
        {
          key: "display_order",
          label: "Display Order",
        },
        {
          key: "is_active",
          label: "Active",
        },
      ],
    );
  };

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Organization Masters
          </span>
          <h1>Department Management</h1>
          <p>
            Maintain department masters,
            status and HOD ownership.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--tertiary"
            to="/admin/organization"
          >
            Overview
          </Link>
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
            onClick={() => {
              setEditingDepartment(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Department
          </button>
        </div>
      </div>

      <SurfaceCard>
        <div className="site-toolbar">
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
              placeholder="Search departments"
            />
          </label>
          <label className="filter-control">
            <span>Company</span>
            <select
              value={filters.company}
              onChange={(event) =>
                setFilter(
                  "company",
                  event.target.value,
                )
              }
            >
              <option value="">All companies</option>
              {(companiesQuery.data ?? []).map(
                (company) => (
                  <option
                    key={company.id}
                    value={company.id}
                  >
                    {company.code}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="filter-control">
            <span>Status</span>
            <select
              value={filters.is_active}
              onChange={(event) =>
                setFilter(
                  "is_active",
                  event.target.value,
                )
              }
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">
                Inactive
              </option>
            </select>
          </label>
          <label className="filter-control">
            <span>Order</span>
            <select
              value={filters.ordering}
              onChange={(event) =>
                setFilter(
                  "ordering",
                  event.target.value,
                )
              }
            >
              <option value="display_order">
                Display order
              </option>
              <option value="department_name">
                Department name
              </option>
              <option value="department_code">
                Department code
              </option>
            </select>
          </label>
        </div>

        {departmentsQuery.isLoading ? (
          <AppLoader label="Loading departments..." />
        ) : departmentsQuery.isError ? (
          <ErrorState
            title="Departments unavailable"
            message={
              departmentsQuery.error?.message
            }
            onRetry={departmentsQuery.refetch}
          />
        ) : !departments.length ? (
          <EmptyState
            title="No departments found"
            message="Adjust filters or add a department."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Department</th>
                  <th>Company</th>
                  <th>HOD</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.id}>
                    <td>
                      {department.department_code}
                    </td>
                    <td>
                      <strong>
                        {
                          department.department_name
                        }
                      </strong>
                      <span className="table-subtext">
                        {department.description ||
                          "-"}
                      </span>
                    </td>
                    <td>
                      {department.company_code ||
                        "-"}
                    </td>
                    <td>
                      {department
                        .department_hod_detail
                        ?.full_name || "-"}
                    </td>
                    <td>
                      {department.display_order}
                    </td>
                    <td>
                      <StatusChip
                        active={
                          department.is_active
                        }
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingDepartment(
                              department,
                            );
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit department"
                          title="Edit department"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            department.is_active
                              ? deactivateDepartment.mutate(
                                  department.id,
                                )
                              : activateDepartment.mutate(
                                  department.id,
                                )
                          }
                          aria-label={
                            department.is_active
                              ? "Deactivate department"
                              : "Activate department"
                          }
                          title={
                            department.is_active
                              ? "Deactivate"
                              : "Activate"
                          }
                        >
                          <Power size={17} />
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
        <DepartmentForm
          companies={
            companiesQuery.data ?? []
          }
          users={usersQuery.data ?? []}
          department={editingDepartment}
          error={
            createDepartment.error ??
            updateDepartment.error
          }
          isSubmitting={
            createDepartment.isPending ||
            updateDepartment.isPending
          }
          onClose={() => {
            setEditingDepartment(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
