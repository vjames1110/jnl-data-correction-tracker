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
  useActivateErpModule,
  useCreateErpModule,
  useDeactivateErpModule,
  useErpModuleExport,
  useErpModules,
  useUpdateErpModule,
} from "../../../hooks/useErp";
import {
  useDepartmentsDropdown,
} from "../../../hooks/useOrganization";
import {
  ManagementPanel,
  StatusChip,
} from "../components/OrganizationControls";
import {
  buildParams,
  downloadCsv,
} from "../utils/organizationUtils";

const emptyForm = {
  module_code: "",
  module_name: "",
  description: "",
  departments: [],
  display_order: 0,
  is_active: true,
};

function selectedOptions(options) {
  return Array.from(options)
    .filter((option) => option.selected)
    .map((option) => option.value);
}

function ErpModuleForm({
  departments,
  error,
  isSubmitting,
  module,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() =>
    module
      ? {
          module_code: module.module_code ?? "",
          module_name: module.module_name ?? "",
          description: module.description ?? "",
          departments:
            module.departments?.map(String) ?? [],
          display_order:
            module.display_order ?? 0,
          is_active: module.is_active ?? true,
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
      eyebrow="ERP Module Master"
      title={
        module
          ? "Edit ERP Module"
          : "Add ERP Module"
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
            display_order: Number(
              form.display_order || 0,
            ),
          });
        }}
      >
        <div className="form-grid">
          {module ? (
            <label className="form-field">
              <span>Module Code</span>
              <input
                value={form.module_code}
                readOnly
              />
            </label>
          ) : null}
          <label className="form-field">
            <span>Module Name</span>
            <input
              value={form.module_name}
              onChange={(event) =>
                setField(
                  "module_name",
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

        <label className="form-field">
          <span>Department Mapping</span>
          <select
            multiple
            value={form.departments}
            onChange={(event) =>
              setField(
                "departments",
                selectedOptions(
                  event.target.options,
                ),
              )
            }
            size={Math.min(
              Math.max(departments.length, 3),
              7,
            )}
          >
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
          <span>Active module</span>
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
              : "Save Module"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function ErpModuleManagementPage() {
  const [filters, setFilters] = useState({
    search: "",
    departments: "",
    is_active: "",
    ordering: "display_order",
    page: 1,
  });
  const [editingModule, setEditingModule] =
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
        departments: filters.departments,
        is_active: filters.is_active,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const modulesQuery =
    useErpModules(queryParams);
  const departmentsQuery =
    useDepartmentsDropdown();
  const exportQuery =
    useErpModuleExport(exportParams);
  const createModule = useCreateErpModule();
  const updateModule = useUpdateErpModule();
  const activateModule = useActivateErpModule();
  const deactivateModule =
    useDeactivateErpModule();

  const modules =
    modulesQuery.data?.items ?? [];
  const pagination =
    modulesQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingModule) {
      await updateModule.mutateAsync({
        id: editingModule.id,
        payload,
      });
    } else {
      await createModule.mutateAsync(payload);
    }

    setEditingModule(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "erp-modules.csv",
      result.data ?? [],
      [
        {
          key: "module_code",
          label: "Module Code",
        },
        {
          key: "module_name",
          label: "Module Name",
        },
        {
          key: "description",
          label: "Description",
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
            ERP Masters
          </span>
          <h1>ERP Module Management</h1>
          <p>
            Maintain ERP functional modules and
            department coverage.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--tertiary"
            to="/admin/vouchers"
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
              setEditingModule(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Module
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
              placeholder="Search modules"
            />
          </label>
          <label className="filter-control">
            <span>Department</span>
            <select
              value={filters.departments}
              onChange={(event) =>
                setFilter(
                  "departments",
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
              <option value="module_name">
                Module name
              </option>
              <option value="module_code">
                Module code
              </option>
            </select>
          </label>
        </div>

        {modulesQuery.isLoading ? (
          <AppLoader label="Loading ERP modules..." />
        ) : modulesQuery.isError ? (
          <ErrorState
            title="ERP modules unavailable"
            message={
              modulesQuery.error?.message
            }
            onRetry={modulesQuery.refetch}
          />
        ) : !modules.length ? (
          <EmptyState
            title="No ERP modules found"
            message="Adjust filters or add a module."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Module</th>
                  <th>Departments</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module.id}>
                    <td>{module.module_code}</td>
                    <td>
                      <strong>
                        {module.module_name}
                      </strong>
                      <span className="table-subtext">
                        {module.description || "-"}
                      </span>
                    </td>
                    <td>
                      {module.department_details
                        ?.map(
                          (department) =>
                            department.code,
                        )
                        .join(", ") || "-"}
                    </td>
                    <td>{module.display_order}</td>
                    <td>
                      <StatusChip
                        active={module.is_active}
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingModule(
                              module,
                            );
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit ERP module"
                          title="Edit module"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            module.is_active
                              ? deactivateModule.mutate(
                                  module.id,
                                )
                              : activateModule.mutate(
                                  module.id,
                                )
                          }
                          aria-label={
                            module.is_active
                              ? "Deactivate ERP module"
                              : "Activate ERP module"
                          }
                          title={
                            module.is_active
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
        <ErpModuleForm
          departments={
            departmentsQuery.data ?? []
          }
          error={
            createModule.error ??
            updateModule.error
          }
          isSubmitting={
            createModule.isPending ||
            updateModule.isPending
          }
          module={editingModule}
          onClose={() => {
            setEditingModule(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
