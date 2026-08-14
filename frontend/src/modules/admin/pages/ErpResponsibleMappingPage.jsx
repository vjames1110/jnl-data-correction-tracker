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
import { USER_ROLES } from "../../../constants/roles";
import {
  useDepartmentsDropdown,
  useSitesDropdown,
  useUsersDropdown,
} from "../../../hooks/useOrganization";
import {
  useActivateErpResponsiblePersonMapping,
  useCreateErpResponsiblePersonMapping,
  useDeactivateErpResponsiblePersonMapping,
  useErpModulesDropdown,
  useErpPrioritiesDropdown,
  useErpResponsiblePersonMappingExport,
  useErpResponsiblePersonMappings,
  useErpVoucherTypesDropdown,
  useErpWorkTypesDropdown,
  useUpdateErpResponsiblePersonMapping,
} from "../../../hooks/useErp";
import {
  ManagementPanel,
  StatusChip,
} from "../components/OrganizationControls";
import {
  buildParams,
  downloadCsv,
} from "../utils/organizationUtils";

const emptyForm = {
  erp_module: "",
  voucher_type: "",
  department: "",
  site: "",
  work_type: "",
  priority: "",
  responsible_person: "",
  display_order: 0,
  is_active: true,
};

function optionLabel(option) {
  return option.code
    ? `${option.code} - ${option.label}`
    : option.label;
}

function optionalValue(value) {
  return value || null;
}

function ErpResponsibleMappingForm({
  departments,
  error,
  isSubmitting,
  mapping,
  modules,
  onClose,
  onSubmit,
  priorities,
  responsiblePeople,
  sites,
  voucherTypes,
  workTypes,
}) {
  const [form, setForm] = useState(() =>
    mapping
      ? {
          erp_module: mapping.erp_module ?? "",
          voucher_type:
            mapping.voucher_type ?? "",
          department: mapping.department ?? "",
          site: mapping.site ?? "",
          work_type: mapping.work_type ?? "",
          priority: mapping.priority ?? "",
          responsible_person:
            mapping.responsible_person ?? "",
          display_order:
            mapping.display_order ?? 0,
          is_active: mapping.is_active ?? true,
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
      eyebrow="Responsible Mapping"
      title={
        mapping
          ? "Edit Responsible Mapping"
          : "Add Responsible Mapping"
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
            voucher_type: optionalValue(
              form.voucher_type,
            ),
            department: optionalValue(
              form.department,
            ),
            site: optionalValue(form.site),
            work_type: optionalValue(
              form.work_type,
            ),
            priority: optionalValue(
              form.priority,
            ),
            display_order: Number(
              form.display_order || 0,
            ),
          });
        }}
      >
        <div className="form-grid">
          <label className="form-field">
            <span>ERP Module</span>
            <select
              value={form.erp_module}
              onChange={(event) =>
                setField(
                  "erp_module",
                  event.target.value,
                )
              }
              required
            >
              <option value="" disabled hidden>
                Select module
              </option>
              {modules.map((module) => (
                <option
                  key={module.id}
                  value={module.id}
                >
                  {optionLabel(module)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Work Assignee</span>
            <select
              value={form.responsible_person}
              onChange={(event) =>
                setField(
                  "responsible_person",
                  event.target.value,
                )
              }
              required
            >
              <option value="" disabled hidden>
                Select responsible person
              </option>
              {responsiblePeople.map((user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Voucher Type</span>
            <select
              value={form.voucher_type}
              onChange={(event) =>
                setField(
                  "voucher_type",
                  event.target.value,
                )
              }
            >
              <option value="">Any voucher</option>
              {voucherTypes.map((voucher) => (
                <option
                  key={voucher.id}
                  value={voucher.id}
                >
                  {optionLabel(voucher)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Work Type</span>
            <select
              value={form.work_type}
              onChange={(event) =>
                setField(
                  "work_type",
                  event.target.value,
                )
              }
            >
              <option value="">Any work type</option>
              {workTypes.map((workType) => (
                <option
                  key={workType.id}
                  value={workType.id}
                >
                  {optionLabel(workType)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Site</span>
            <select
              value={form.site}
              onChange={(event) =>
                setField(
                  "site",
                  event.target.value,
                )
              }
            >
              <option value="">Any site</option>
              {sites.map((site) => (
                <option
                  key={site.id}
                  value={site.id}
                >
                  {optionLabel(site)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Department</span>
            <select
              value={form.department}
              onChange={(event) =>
                setField(
                  "department",
                  event.target.value,
                )
              }
            >
              <option value="">
                Any department
              </option>
              {departments.map((department) => (
                <option
                  key={department.id}
                  value={department.id}
                >
                  {optionLabel(department)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Priority</span>
            <select
              value={form.priority}
              onChange={(event) =>
                setField(
                  "priority",
                  event.target.value,
                )
              }
            >
              <option value="">Any priority</option>
              {priorities.map((priority) => (
                <option
                  key={priority.id}
                  value={priority.id}
                >
                  {optionLabel(priority)}
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
          <span>Active responsible mapping</span>
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
              : "Save Mapping"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function ErpResponsibleMappingPage() {
  const [filters, setFilters] = useState({
    search: "",
    erp_module: "",
    voucher_type: "",
    department: "",
    site: "",
    work_type: "",
    priority: "",
    responsible_person: "",
    is_active: "",
    ordering: "display_order",
    page: 1,
  });
  const [editingMapping, setEditingMapping] =
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
        erp_module: filters.erp_module,
        voucher_type: filters.voucher_type,
        department: filters.department,
        site: filters.site,
        work_type: filters.work_type,
        priority: filters.priority,
        responsible_person:
          filters.responsible_person,
        is_active: filters.is_active,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const mappingsQuery =
    useErpResponsiblePersonMappings(queryParams);
  const modulesQuery =
    useErpModulesDropdown();
  const voucherTypesQuery =
    useErpVoucherTypesDropdown();
  const departmentsQuery =
    useDepartmentsDropdown();
  const sitesQuery = useSitesDropdown();
  const workTypesQuery =
    useErpWorkTypesDropdown();
  const prioritiesQuery =
    useErpPrioritiesDropdown();
  const responsiblePeopleQuery =
    useUsersDropdown({
      role: USER_ROLES.RESPONSIBLE_PERSON,
    });
  const exportQuery =
    useErpResponsiblePersonMappingExport(
      exportParams,
    );
  const createMapping =
    useCreateErpResponsiblePersonMapping();
  const updateMapping =
    useUpdateErpResponsiblePersonMapping();
  const activateMapping =
    useActivateErpResponsiblePersonMapping();
  const deactivateMapping =
    useDeactivateErpResponsiblePersonMapping();

  const mappings =
    mappingsQuery.data?.items ?? [];
  const pagination =
    mappingsQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingMapping) {
      await updateMapping.mutateAsync({
        id: editingMapping.id,
        payload,
      });
    } else {
      await createMapping.mutateAsync(payload);
    }

    setEditingMapping(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "erp-responsible-mappings.csv",
      result.data ?? [],
      [
        {
          key: "erp_module_code",
          label: "ERP Module",
        },
        {
          key: "voucher_code",
          label: "Voucher",
        },
        {
          key: "site_code",
          label: "Site",
        },
        {
          key: "department_code",
          label: "Department",
        },
        {
          key: "work_type_code",
          label: "Work Type",
        },
        {
          key: "priority_code",
          label: "Priority",
        },
        {
          key: "responsible_person",
          label: "Work Assignee ID",
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
          <h1>Work Assignee Mapping</h1>
          <p>
            Route approved ERP correction work to
            responsible users by module and context.
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
              setEditingMapping(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Mapping
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
              placeholder="Search routing rules"
            />
          </label>
          <label className="filter-control">
            <span>Module</span>
            <select
              value={filters.erp_module}
              onChange={(event) =>
                setFilter(
                  "erp_module",
                  event.target.value,
                )
              }
            >
              <option value="">All modules</option>
              {(modulesQuery.data ?? []).map(
                (module) => (
                  <option
                    key={module.id}
                    value={module.id}
                  >
                    {module.code}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="filter-control">
            <span>Voucher</span>
            <select
              value={filters.voucher_type}
              onChange={(event) =>
                setFilter(
                  "voucher_type",
                  event.target.value,
                )
              }
            >
              <option value="">All vouchers</option>
              {(voucherTypesQuery.data ?? []).map(
                (voucher) => (
                  <option
                    key={voucher.id}
                    value={voucher.id}
                  >
                    {voucher.code}
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
        </div>

        {mappingsQuery.isLoading ? (
          <AppLoader label="Loading responsible mappings..." />
        ) : mappingsQuery.isError ? (
          <ErrorState
            title="Responsible mappings unavailable"
            message={
              mappingsQuery.error?.message
            }
            onRetry={mappingsQuery.refetch}
          />
        ) : !mappings.length ? (
          <EmptyState
            title="No responsible mappings found"
            message="Adjust filters or add a routing rule."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Scope</th>
                  <th>Responsible</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td>
                      <strong>
                        {mapping.erp_module_code}
                      </strong>
                      <span className="table-subtext">
                        {mapping.erp_module_name ||
                          "-"}
                      </span>
                    </td>
                    <td>
                      {mapping.voucher_code ||
                        "Any voucher"}
                      <span className="table-subtext">
                        {[
                          mapping.site_code,
                          mapping.department_code,
                          mapping.work_type_code,
                          mapping.priority_code,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "Global"}
                      </span>
                    </td>
                    <td>
                      {mapping
                        .responsible_person_detail
                        ?.full_name ||
                        mapping.responsible_person}
                      <span className="table-subtext">
                        {mapping
                          .responsible_person_detail
                          ?.employee_id || "-"}
                      </span>
                    </td>
                    <td>{mapping.display_order}</td>
                    <td>
                      <StatusChip
                        active={
                          mapping.is_active
                        }
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingMapping(
                              mapping,
                            );
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit responsible mapping"
                          title="Edit mapping"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            mapping.is_active
                              ? deactivateMapping.mutate(
                                  mapping.id,
                                )
                              : activateMapping.mutate(
                                  mapping.id,
                                )
                          }
                          aria-label={
                            mapping.is_active
                              ? "Deactivate responsible mapping"
                              : "Activate responsible mapping"
                          }
                          title={
                            mapping.is_active
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
        <ErpResponsibleMappingForm
          departments={
            departmentsQuery.data ?? []
          }
          error={
            createMapping.error ??
            updateMapping.error
          }
          isSubmitting={
            createMapping.isPending ||
            updateMapping.isPending
          }
          mapping={editingMapping}
          modules={modulesQuery.data ?? []}
          onClose={() => {
            setEditingMapping(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
          priorities={prioritiesQuery.data ?? []}
          responsiblePeople={
            responsiblePeopleQuery.data ?? []
          }
          sites={sitesQuery.data ?? []}
          voucherTypes={
            voucherTypesQuery.data ?? []
          }
          workTypes={workTypesQuery.data ?? []}
        />
      ) : null}
    </div>
  );
}
