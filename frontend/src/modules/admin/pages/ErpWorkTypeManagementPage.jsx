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
  useActivateErpWorkType,
  useCreateErpWorkType,
  useDeactivateErpWorkType,
  useErpWorkTypeExport,
  useErpWorkTypes,
  useUpdateErpWorkType,
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
  work_type_code: "",
  work_type_name: "",
  description: "",
  requires_approval: true,
  is_active: true,
};

function ApprovalChip({ active }) {
  return (
    <span
      className={
        active
          ? "status-chip status-chip--warning"
          : "status-chip status-chip--success"
      }
    >
      {active ? "Approval" : "Direct"}
    </span>
  );
}

function ErpWorkTypeForm({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  workType,
}) {
  const [form, setForm] = useState(() =>
    workType
      ? {
          work_type_code:
            workType.work_type_code ?? "",
          work_type_name:
            workType.work_type_name ?? "",
          description: workType.description ?? "",
          requires_approval:
            workType.requires_approval ?? true,
          is_active: workType.is_active ?? true,
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
      eyebrow="Work Type Master"
      title={
        workType
          ? "Edit Work Type"
          : "Add Work Type"
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
          onSubmit(form);
        }}
      >
        <div className="form-grid">
          {workType ? (
            <label className="form-field">
              <span>Work Type Code</span>
              <input
                value={form.work_type_code}
                readOnly
              />
            </label>
          ) : null}
          <label className="form-field">
            <span>Work Type Name</span>
            <input
              value={form.work_type_name}
              onChange={(event) =>
                setField(
                  "work_type_name",
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
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={form.requires_approval}
              onChange={(event) =>
                setField(
                  "requires_approval",
                  event.target.checked,
                )
              }
            />
            <span>Requires approval</span>
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
            <span>Active work type</span>
          </label>
        </div>

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
              : "Save Work Type"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function ErpWorkTypeManagementPage() {
  const [filters, setFilters] = useState({
    search: "",
    requires_approval: "",
    is_active: "",
    ordering: "work_type_name",
    page: 1,
  });
  const [editingWorkType, setEditingWorkType] =
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
        requires_approval:
          filters.requires_approval,
        is_active: filters.is_active,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const workTypesQuery =
    useErpWorkTypes(queryParams);
  const exportQuery =
    useErpWorkTypeExport(exportParams);
  const createWorkType = useCreateErpWorkType();
  const updateWorkType = useUpdateErpWorkType();
  const activateWorkType =
    useActivateErpWorkType();
  const deactivateWorkType =
    useDeactivateErpWorkType();

  const workTypes =
    workTypesQuery.data?.items ?? [];
  const pagination =
    workTypesQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingWorkType) {
      await updateWorkType.mutateAsync({
        id: editingWorkType.id,
        payload,
      });
    } else {
      await createWorkType.mutateAsync(payload);
    }

    setEditingWorkType(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "erp-work-types.csv",
      result.data ?? [],
      [
        {
          key: "work_type_code",
          label: "Work Type Code",
        },
        {
          key: "work_type_name",
          label: "Work Type Name",
        },
        {
          key: "description",
          label: "Description",
        },
        {
          key: "requires_approval",
          label: "Requires Approval",
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
          <h1>Work Type Management</h1>
          <p>
            Maintain allowed ERP correction actions
            and approval behavior.
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
              setEditingWorkType(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Work Type
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
              placeholder="Search work types"
            />
          </label>
          <label className="filter-control">
            <span>Approval</span>
            <select
              value={filters.requires_approval}
              onChange={(event) =>
                setFilter(
                  "requires_approval",
                  event.target.value,
                )
              }
            >
              <option value="">All</option>
              <option value="true">Required</option>
              <option value="false">Direct</option>
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
              <option value="work_type_name">
                Work type
              </option>
              <option value="work_type_code">
                Work code
              </option>
              <option value="created_at">
                Created
              </option>
            </select>
          </label>
        </div>

        {workTypesQuery.isLoading ? (
          <AppLoader label="Loading work types..." />
        ) : workTypesQuery.isError ? (
          <ErrorState
            title="Work types unavailable"
            message={
              workTypesQuery.error?.message
            }
            onRetry={workTypesQuery.refetch}
          />
        ) : !workTypes.length ? (
          <EmptyState
            title="No work types found"
            message="Adjust filters or add a work type."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Work Type</th>
                  <th>Approval</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workTypes.map((workType) => (
                  <tr key={workType.id}>
                    <td>
                      {workType.work_type_code}
                    </td>
                    <td>
                      <strong>
                        {workType.work_type_name}
                      </strong>
                      <span className="table-subtext">
                        {workType.description || "-"}
                      </span>
                    </td>
                    <td>
                      <ApprovalChip
                        active={
                          workType.requires_approval
                        }
                      />
                    </td>
                    <td>
                      <StatusChip
                        active={workType.is_active}
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingWorkType(
                              workType,
                            );
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit work type"
                          title="Edit work type"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            workType.is_active
                              ? deactivateWorkType.mutate(
                                  workType.id,
                                )
                              : activateWorkType.mutate(
                                  workType.id,
                                )
                          }
                          aria-label={
                            workType.is_active
                              ? "Deactivate work type"
                              : "Activate work type"
                          }
                          title={
                            workType.is_active
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
        <ErpWorkTypeForm
          error={
            createWorkType.error ??
            updateWorkType.error
          }
          isSubmitting={
            createWorkType.isPending ||
            updateWorkType.isPending
          }
          onClose={() => {
            setEditingWorkType(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
          workType={editingWorkType}
        />
      ) : null}
    </div>
  );
}
