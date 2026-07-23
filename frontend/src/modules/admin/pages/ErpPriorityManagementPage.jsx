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
  useActivateErpPriority,
  useCreateErpPriority,
  useDeactivateErpPriority,
  useErpPriorities,
  useErpPriorityExport,
  useUpdateErpPriority,
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
  priority_code: "",
  priority_name: "",
  sla_duration_hours: 24,
  escalation_duration_hours: 12,
  display_order: 0,
  is_active: true,
};

function ErpPriorityForm({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  priority,
}) {
  const [form, setForm] = useState(() =>
    priority
      ? {
          priority_code:
            priority.priority_code ?? "",
          priority_name:
            priority.priority_name ?? "",
          sla_duration_hours:
            priority.sla_duration_hours ?? 24,
          escalation_duration_hours:
            priority.escalation_duration_hours ??
            12,
          display_order:
            priority.display_order ?? 0,
          is_active: priority.is_active ?? true,
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
      eyebrow="Priority Master"
      title={
        priority ? "Edit Priority" : "Add Priority"
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
            sla_duration_hours: Number(
              form.sla_duration_hours || 1,
            ),
            escalation_duration_hours: Number(
              form.escalation_duration_hours ||
                1,
            ),
            display_order: Number(
              form.display_order || 0,
            ),
          });
        }}
      >
        <div className="form-grid">
          {priority ? (
            <label className="form-field">
              <span>Priority Code</span>
              <input
                value={form.priority_code}
                readOnly
              />
            </label>
          ) : null}
          <label className="form-field">
            <span>Priority Name</span>
            <input
              value={form.priority_name}
              onChange={(event) =>
                setField(
                  "priority_name",
                  event.target.value,
                )
              }
              required
            />
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>SLA Hours</span>
            <input
              type="number"
              min="1"
              value={form.sla_duration_hours}
              onChange={(event) =>
                setField(
                  "sla_duration_hours",
                  event.target.value,
                )
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Escalation Hours</span>
            <input
              type="number"
              min="1"
              value={
                form.escalation_duration_hours
              }
              onChange={(event) =>
                setField(
                  "escalation_duration_hours",
                  event.target.value,
                )
              }
              required
            />
          </label>
        </div>

        <div className="form-grid">
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
            <span>Active priority</span>
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
              : "Save Priority"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function ErpPriorityManagementPage() {
  const [filters, setFilters] = useState({
    search: "",
    is_active: "",
    ordering: "display_order",
    page: 1,
  });
  const [editingPriority, setEditingPriority] =
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
        is_active: filters.is_active,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const prioritiesQuery =
    useErpPriorities(queryParams);
  const exportQuery =
    useErpPriorityExport(exportParams);
  const createPriority = useCreateErpPriority();
  const updatePriority = useUpdateErpPriority();
  const activatePriority =
    useActivateErpPriority();
  const deactivatePriority =
    useDeactivateErpPriority();

  const priorities =
    prioritiesQuery.data?.items ?? [];
  const pagination =
    prioritiesQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingPriority) {
      await updatePriority.mutateAsync({
        id: editingPriority.id,
        payload,
      });
    } else {
      await createPriority.mutateAsync(payload);
    }

    setEditingPriority(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "erp-priorities.csv",
      result.data ?? [],
      [
        {
          key: "priority_code",
          label: "Priority Code",
        },
        {
          key: "priority_name",
          label: "Priority Name",
        },
        {
          key: "sla_duration_hours",
          label: "SLA Hours",
        },
        {
          key: "escalation_duration_hours",
          label: "Escalation Hours",
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
          <h1>Priority and SLA Setup</h1>
          <p>
            Maintain request priority levels,
            response SLA and escalation timing.
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
              setEditingPriority(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Priority
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
              placeholder="Search priorities"
            />
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
              <option value="priority_name">
                Priority name
              </option>
              <option value="sla_duration_hours">
                SLA hours
              </option>
            </select>
          </label>
        </div>

        {prioritiesQuery.isLoading ? (
          <AppLoader label="Loading priorities..." />
        ) : prioritiesQuery.isError ? (
          <ErrorState
            title="Priorities unavailable"
            message={
              prioritiesQuery.error?.message
            }
            onRetry={prioritiesQuery.refetch}
          />
        ) : !priorities.length ? (
          <EmptyState
            title="No priorities found"
            message="Adjust filters or add a priority."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Priority</th>
                  <th>SLA</th>
                  <th>Escalation</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {priorities.map((priority) => (
                  <tr key={priority.id}>
                    <td>
                      {priority.priority_code}
                    </td>
                    <td>
                      <strong>
                        {priority.priority_name}
                      </strong>
                    </td>
                    <td>
                      {priority.sla_duration_hours}h
                    </td>
                    <td>
                      {
                        priority.escalation_duration_hours
                      }
                      h
                    </td>
                    <td>{priority.display_order}</td>
                    <td>
                      <StatusChip
                        active={priority.is_active}
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingPriority(
                              priority,
                            );
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit priority"
                          title="Edit priority"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            priority.is_active
                              ? deactivatePriority.mutate(
                                  priority.id,
                                )
                              : activatePriority.mutate(
                                  priority.id,
                                )
                          }
                          aria-label={
                            priority.is_active
                              ? "Deactivate priority"
                              : "Activate priority"
                          }
                          title={
                            priority.is_active
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
        <ErpPriorityForm
          error={
            createPriority.error ??
            updatePriority.error
          }
          isSubmitting={
            createPriority.isPending ||
            updatePriority.isPending
          }
          onClose={() => {
            setEditingPriority(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
          priority={editingPriority}
        />
      ) : null}
    </div>
  );
}
