import { useMemo, useState } from "react";
import {
  Download,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useActivateErpVoucherType,
  useCreateErpVoucherType,
  useDeactivateErpVoucherType,
  useErpModulesDropdown,
  useErpVoucherTypeExport,
  useErpVoucherTypes,
  useUpdateErpVoucherType,
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
  voucher_code: "",
  voucher_name: "",
  erp_module: "",
  department: "",
  requires_voucher_number: true,
  requires_voucher_date: true,
  requires_amount: false,
  requires_quantity: false,
  is_active: true,
};

function RequirementChip({ active, label }) {
  return (
    <span
      className={
        active
          ? "status-chip status-chip--success"
          : "status-chip status-chip--error"
      }
    >
      {label}
    </span>
  );
}

function ErpVoucherTypeForm({
  departments,
  error,
  isSubmitting,
  modules,
  onClose,
  onSubmit,
  voucherType,
}) {
  const [form, setForm] = useState(() =>
    voucherType
      ? {
          voucher_code:
            voucherType.voucher_code ?? "",
          voucher_name:
            voucherType.voucher_name ?? "",
          erp_module:
            voucherType.erp_module ?? "",
          department:
            voucherType.department ?? "",
          requires_voucher_number:
            voucherType.requires_voucher_number ??
            true,
          requires_voucher_date:
            voucherType.requires_voucher_date ??
            true,
          requires_amount:
            voucherType.requires_amount ?? false,
          requires_quantity:
            voucherType.requires_quantity ?? false,
          is_active:
            voucherType.is_active ?? true,
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
      eyebrow="Voucher Type Master"
      title={
        voucherType
          ? "Edit Voucher Type"
          : "Add Voucher Type"
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
            department: form.department || null,
          });
        }}
      >
        <div className="form-grid">
          {voucherType ? (
            <label className="form-field">
              <span>Voucher Code</span>
              <input
                value={form.voucher_code}
                readOnly
              />
            </label>
          ) : null}
          <label className="form-field">
            <span>Voucher Name</span>
            <input
              value={form.voucher_name}
              onChange={(event) =>
                setField(
                  "voucher_name",
                  event.target.value,
                )
              }
              required
            />
          </label>
        </div>

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
                  {module.code} - {module.label}
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
                No department
              </option>
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
        </div>

        <section className="employee-form-section">
          <h3>Required Fields</h3>
          <div className="form-grid">
            {[
              [
                "requires_voucher_number",
                "Voucher number",
              ],
              [
                "requires_voucher_date",
                "Voucher date",
              ],
              ["requires_amount", "Amount"],
              ["requires_quantity", "Quantity"],
            ].map(([field, label]) => (
              <label
                key={field}
                className="toggle-field"
              >
                <input
                  type="checkbox"
                  checked={form[field]}
                  onChange={(event) =>
                    setField(
                      field,
                      event.target.checked,
                    )
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>

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
          <span>Active voucher type</span>
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
              : "Save Voucher Type"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function ErpVoucherTypeManagementPage() {
  const [filters, setFilters] = useState({
    search: "",
    erp_module: "",
    department: "",
    is_active: "",
    ordering: "voucher_name",
    page: 1,
  });
  const [editingVoucherType, setEditingVoucherType] =
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
        department: filters.department,
        is_active: filters.is_active,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const voucherTypesQuery =
    useErpVoucherTypes(queryParams);
  const modulesQuery =
    useErpModulesDropdown();
  const departmentsQuery =
    useDepartmentsDropdown();
  const exportQuery =
    useErpVoucherTypeExport(exportParams);
  const createVoucherType =
    useCreateErpVoucherType();
  const updateVoucherType =
    useUpdateErpVoucherType();
  const activateVoucherType =
    useActivateErpVoucherType();
  const deactivateVoucherType =
    useDeactivateErpVoucherType();

  const voucherTypes =
    voucherTypesQuery.data?.items ?? [];
  const pagination =
    voucherTypesQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingVoucherType) {
      await updateVoucherType.mutateAsync({
        id: editingVoucherType.id,
        payload,
      });
    } else {
      await createVoucherType.mutateAsync(
        payload,
      );
    }

    setEditingVoucherType(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "erp-voucher-types.csv",
      result.data ?? [],
      [
        {
          key: "voucher_code",
          label: "Voucher Code",
        },
        {
          key: "voucher_name",
          label: "Voucher Name",
        },
        {
          key: "erp_module_code",
          label: "ERP Module",
        },
        {
          key: "department_code",
          label: "Department",
        },
        {
          key: "requires_voucher_number",
          label: "Requires Voucher Number",
        },
        {
          key: "requires_voucher_date",
          label: "Requires Voucher Date",
        },
        {
          key: "requires_amount",
          label: "Requires Amount",
        },
        {
          key: "requires_quantity",
          label: "Requires Quantity",
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
          <h1>Voucher Type Management</h1>
          <p>
            Maintain voucher definitions and
            required request fields.
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
              setEditingVoucherType(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Voucher
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
              placeholder="Search vouchers"
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

        {voucherTypesQuery.isLoading ? (
          <AppLoader label="Loading voucher types..." />
        ) : voucherTypesQuery.isError ? (
          <ErrorState
            title="Voucher types unavailable"
            message={
              voucherTypesQuery.error?.message
            }
            onRetry={voucherTypesQuery.refetch}
          />
        ) : !voucherTypes.length ? (
          <EmptyState
            title="No voucher types found"
            message="Adjust filters or add a voucher type."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Voucher</th>
                  <th>Module</th>
                  <th>Department</th>
                  <th>Required Fields</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {voucherTypes.map((voucher) => (
                  <tr key={voucher.id}>
                    <td>{voucher.voucher_code}</td>
                    <td>
                      <strong>
                        {voucher.voucher_name}
                      </strong>
                    </td>
                    <td>
                      {voucher.erp_module_code ||
                        "-"}
                    </td>
                    <td>
                      {voucher.department_code ||
                        "-"}
                    </td>
                    <td>
                      <div className="table-actions">
                        {voucher.requires_voucher_number ? (
                          <RequirementChip label="No." active />
                        ) : null}
                        {voucher.requires_voucher_date ? (
                          <RequirementChip label="Date" active />
                        ) : null}
                        {voucher.requires_amount ? (
                          <RequirementChip label="Amt" active />
                        ) : null}
                        {voucher.requires_quantity ? (
                          <RequirementChip label="Qty" active />
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <StatusChip
                        active={voucher.is_active}
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingVoucherType(
                              voucher,
                            );
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit voucher type"
                          title="Edit voucher type"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            voucher.is_active
                              ? deactivateVoucherType.mutate(
                                  voucher.id,
                                )
                              : activateVoucherType.mutate(
                                  voucher.id,
                                )
                          }
                          aria-label={
                            voucher.is_active
                              ? "Deactivate voucher type"
                              : "Activate voucher type"
                          }
                          title={
                            voucher.is_active
                              ? "Deactivate"
                              : "Activate"
                          }
                        >
                          <Power size={17} />
                        </button>
                        {voucher.is_active ? (
                          <button
                            type="button"
                            className="button button--tertiary employee-table-action"
                            onClick={() =>
                              deactivateVoucherType.mutate(
                                voucher.id,
                              )
                            }
                            aria-label="Delete voucher type without removing database record"
                            title="Delete from active vouchers"
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        ) : null}
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
        <ErpVoucherTypeForm
          departments={
            departmentsQuery.data ?? []
          }
          error={
            createVoucherType.error ??
            updateVoucherType.error
          }
          isSubmitting={
            createVoucherType.isPending ||
            updateVoucherType.isPending
          }
          modules={modulesQuery.data ?? []}
          onClose={() => {
            setEditingVoucherType(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
          voucherType={editingVoucherType}
        />
      ) : null}
    </div>
  );
}
