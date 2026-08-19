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
  useActivateErpReasonCategory,
  useCreateErpReasonCategory,
  useDeactivateErpReasonCategory,
  useErpReasonCategories,
  useErpReasonCategoryExport,
  useErpVoucherTypesDropdown,
  useUpdateErpReasonCategory,
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
  reason_code: "",
  reason_name: "",
  description: "",
  display_order: 0,
  voucher_types: [],
  is_active: true,
};

function selectedOptions(options) {
  return Array.from(options)
    .filter((option) => option.selected)
    .map((option) => option.value);
}

function ErpReasonCategoryForm({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  reasonCategory,
  voucherTypes,
}) {
  const [form, setForm] = useState(() =>
    reasonCategory
      ? {
          reason_code:
            reasonCategory.reason_code ?? "",
          reason_name:
            reasonCategory.reason_name ?? "",
          description:
            reasonCategory.description ?? "",
          display_order:
            reasonCategory.display_order ?? 0,
          voucher_types:
            reasonCategory.voucher_types?.map(
              String,
            ) ?? [],
          is_active:
            reasonCategory.is_active ?? true,
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
      eyebrow="Reason Category Master"
      title={
        reasonCategory
          ? "Edit Reason Category"
          : "Add Reason Category"
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
          {reasonCategory ? (
            <label className="form-field">
              <span>Reason Code</span>
              <input
                value={form.reason_code}
                readOnly
              />
            </label>
          ) : null}
          <label className="form-field">
            <span>Reason Name</span>
            <input
              value={form.reason_name}
              onChange={(event) =>
                setField(
                  "reason_name",
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
          <span>Applicable Voucher Types</span>
          <select
            multiple
            value={form.voucher_types}
            onChange={(event) =>
              setField(
                "voucher_types",
                selectedOptions(
                  event.target.options,
                ),
              )
            }
            size={Math.min(
              Math.max(voucherTypes.length, 3),
              7,
            )}
          >
            {voucherTypes.map((voucherType) => (
              <option
                key={voucherType.id}
                value={voucherType.id}
              >
                {voucherType.code} -{" "}
                {voucherType.label}
              </option>
            ))}
          </select>
          <span className="assignment-panel__hint">
            Leave nothing selected to make this
            reason available for every voucher
            type.
          </span>
        </label>

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
            <span>Active reason category</span>
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
              : "Save Reason"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function ErpReasonCategoryManagementPage() {
  const [filters, setFilters] = useState({
    search: "",
    is_active: "",
    ordering: "display_order",
    page: 1,
  });
  const [
    editingReasonCategory,
    setEditingReasonCategory,
  ] = useState(null);
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

  const reasonCategoriesQuery =
    useErpReasonCategories(queryParams);
  const voucherTypesQuery =
    useErpVoucherTypesDropdown();
  const exportQuery =
    useErpReasonCategoryExport(exportParams);
  const createReasonCategory =
    useCreateErpReasonCategory();
  const updateReasonCategory =
    useUpdateErpReasonCategory();
  const activateReasonCategory =
    useActivateErpReasonCategory();
  const deactivateReasonCategory =
    useDeactivateErpReasonCategory();

  const reasonCategories =
    reasonCategoriesQuery.data?.items ?? [];
  const pagination =
    reasonCategoriesQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingReasonCategory) {
      await updateReasonCategory.mutateAsync({
        id: editingReasonCategory.id,
        payload,
      });
    } else {
      await createReasonCategory.mutateAsync(
        payload,
      );
    }

    setEditingReasonCategory(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "erp-reason-categories.csv",
      result.data ?? [],
      [
        {
          key: "reason_code",
          label: "Reason Code",
        },
        {
          key: "reason_name",
          label: "Reason Name",
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
          <h1>Reason Category Management</h1>
          <p>
            Maintain standard reason buckets for
            ERP correction requests.
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
              setEditingReasonCategory(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Reason
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
              placeholder="Search reasons"
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
              <option value="reason_name">
                Reason name
              </option>
              <option value="reason_code">
                Reason code
              </option>
            </select>
          </label>
        </div>

        {reasonCategoriesQuery.isLoading ? (
          <AppLoader label="Loading reasons..." />
        ) : reasonCategoriesQuery.isError ? (
          <ErrorState
            title="Reason categories unavailable"
            message={
              reasonCategoriesQuery.error?.message
            }
            onRetry={reasonCategoriesQuery.refetch}
          />
        ) : !reasonCategories.length ? (
          <EmptyState
            title="No reason categories found"
            message="Adjust filters or add a reason category."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Reason</th>
                  <th>Voucher Types</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reasonCategories.map((reason) => (
                  <tr key={reason.id}>
                    <td>{reason.reason_code}</td>
                    <td>
                      <strong>
                        {reason.reason_name}
                      </strong>
                      <span className="table-subtext">
                        {reason.description || "-"}
                      </span>
                    </td>
                    <td>
                      {reason.voucher_type_details
                        ?.length
                        ? reason.voucher_type_details
                            .map(
                              (voucherType) =>
                                voucherType.code,
                            )
                            .join(", ")
                        : "All"}
                    </td>
                    <td>{reason.display_order}</td>
                    <td>
                      <StatusChip
                        active={reason.is_active}
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingReasonCategory(
                              reason,
                            );
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit reason category"
                          title="Edit reason category"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            reason.is_active
                              ? deactivateReasonCategory.mutate(
                                  reason.id,
                                )
                              : activateReasonCategory.mutate(
                                  reason.id,
                                )
                          }
                          aria-label={
                            reason.is_active
                              ? "Deactivate reason category"
                              : "Activate reason category"
                          }
                          title={
                            reason.is_active
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
        <ErpReasonCategoryForm
          error={
            createReasonCategory.error ??
            updateReasonCategory.error
          }
          isSubmitting={
            createReasonCategory.isPending ||
            updateReasonCategory.isPending
          }
          onClose={() => {
            setEditingReasonCategory(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
          reasonCategory={editingReasonCategory}
          voucherTypes={
            voucherTypesQuery.data ?? []
          }
        />
      ) : null}
    </div>
  );
}
