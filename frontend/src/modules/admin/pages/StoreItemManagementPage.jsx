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
import { reconciliationOverviewPath } from "../../../constants/roles";
import { useAuth } from "../../../hooks/useAuth";
import {
  useActivateReconciliationItem,
  useCreateReconciliationItem,
  useDeactivateReconciliationItem,
  useReconciliationItemCategoriesDropdown,
  useReconciliationItemExport,
  useReconciliationItems,
  useUpdateReconciliationItem,
} from "../../../hooks/useReconciliation";
import {
  ManagementPanel,
  StatusChip,
} from "../components/OrganizationControls";
import {
  buildParams,
  downloadCsv,
} from "../utils/organizationUtils";

const RECONCILIATION_TYPES = [
  {
    value: "NORM_BASED",
    label: "Norm Based (formula / mix ratio)",
  },
  {
    value: "DIRECT_COUNT",
    label: "Direct Count (book vs physical)",
  },
];

const emptyForm = {
  item_code: "",
  item_name: "",
  category: "",
  reconciliation_type: "",
  uom: "",
  erp_item_code: "",
  description: "",
  is_active: true,
};

function ItemForm({
  categories,
  error,
  isSubmitting,
  item,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() =>
    item
      ? {
          item_code: item.item_code ?? "",
          item_name: item.item_name ?? "",
          category: item.category ?? "",
          reconciliation_type:
            item.reconciliation_type ?? "",
          uom: item.uom ?? "",
          erp_item_code:
            item.erp_item_code ?? "",
          description: item.description ?? "",
          is_active: item.is_active ?? true,
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
      eyebrow="Store Item Master"
      title={item ? "Edit Item" : "Add Item"}
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
          {item ? (
            <label className="form-field">
              <span>Item Code</span>
              <input
                value={form.item_code}
                readOnly
              />
            </label>
          ) : null}
          <label className="form-field">
            <span>Item Name</span>
            <input
              value={form.item_name}
              onChange={(event) =>
                setField(
                  "item_name",
                  event.target.value,
                )
              }
              required
            />
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Category</span>
            <select
              value={form.category}
              onChange={(event) =>
                setField(
                  "category",
                  event.target.value,
                )
              }
              required
            >
              <option value="" disabled hidden>
                Select category
              </option>
              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.code} -{" "}
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Reconciliation Type</span>
            <select
              value={form.reconciliation_type}
              onChange={(event) =>
                setField(
                  "reconciliation_type",
                  event.target.value,
                )
              }
              required
            >
              <option value="" disabled hidden>
                Select type
              </option>
              {RECONCILIATION_TYPES.map(
                (type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Unit Of Measure</span>
            <input
              value={form.uom}
              onChange={(event) =>
                setField(
                  "uom",
                  event.target.value,
                )
              }
              placeholder="MT, NOS, LTR..."
              required
            />
          </label>
          <label className="form-field">
            <span>ERP Item Code</span>
            <input
              value={form.erp_item_code}
              onChange={(event) =>
                setField(
                  "erp_item_code",
                  event.target.value,
                )
              }
              placeholder="Optional, for later ERP link"
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
          <span>Active item</span>
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
              : "Save Item"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function StoreItemManagementPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    reconciliation_type: "",
    is_active: "",
    ordering: "item_name",
    page: 1,
  });
  const [editingItem, setEditingItem] =
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
        category: filters.category,
        reconciliation_type:
          filters.reconciliation_type,
        is_active: filters.is_active,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const itemsQuery =
    useReconciliationItems(queryParams);
  const categoriesQuery =
    useReconciliationItemCategoriesDropdown();
  const exportQuery =
    useReconciliationItemExport(exportParams);
  const createItem = useCreateReconciliationItem();
  const updateItem = useUpdateReconciliationItem();
  const activateItem =
    useActivateReconciliationItem();
  const deactivateItem =
    useDeactivateReconciliationItem();

  const items = itemsQuery.data?.items ?? [];
  const pagination =
    itemsQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingItem) {
      await updateItem.mutateAsync({
        id: editingItem.id,
        payload,
      });
    } else {
      await createItem.mutateAsync(payload);
    }

    setEditingItem(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "store-items.csv",
      result.data ?? [],
      [
        { key: "item_code", label: "Item Code" },
        { key: "item_name", label: "Item Name" },
        {
          key: "category_code",
          label: "Category",
        },
        {
          key: "reconciliation_type",
          label: "Reconciliation Type",
        },
        { key: "uom", label: "UOM" },
        {
          key: "erp_item_code",
          label: "ERP Item Code",
        },
        { key: "is_active", label: "Active" },
      ],
    );
  };

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Store Reconciliation
          </span>
          <h1>Item Management</h1>
          <p>
            Maintain the store item master across
            every reconciliation category.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--tertiary"
            to={reconciliationOverviewPath(
              user?.role,
            )}
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
              setEditingItem(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Item
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
              placeholder="Search items"
            />
          </label>
          <label className="filter-control">
            <span>Category</span>
            <select
              value={filters.category}
              onChange={(event) =>
                setFilter(
                  "category",
                  event.target.value,
                )
              }
            >
              <option value="">
                All categories
              </option>
              {(categoriesQuery.data ?? []).map(
                (category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.code}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="filter-control">
            <span>Type</span>
            <select
              value={filters.reconciliation_type}
              onChange={(event) =>
                setFilter(
                  "reconciliation_type",
                  event.target.value,
                )
              }
            >
              <option value="">All types</option>
              {RECONCILIATION_TYPES.map(
                (type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
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

        {itemsQuery.isLoading ? (
          <AppLoader label="Loading items..." />
        ) : itemsQuery.isError ? (
          <ErrorState
            title="Items unavailable"
            message={itemsQuery.error?.message}
            onRetry={itemsQuery.refetch}
          />
        ) : !items.length ? (
          <EmptyState
            title="No items found"
            message="Adjust filters or add an item."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>UOM</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.item_code}</td>
                    <td>
                      <strong>
                        {item.item_name}
                      </strong>
                    </td>
                    <td>
                      {item.category_code || "-"}
                    </td>
                    <td>
                      {
                        item.reconciliation_type_display
                      }
                    </td>
                    <td>{item.uom}</td>
                    <td>
                      <StatusChip
                        active={item.is_active}
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingItem(item);
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit item"
                          title="Edit item"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            item.is_active
                              ? deactivateItem.mutate(
                                  item.id,
                                )
                              : activateItem.mutate(
                                  item.id,
                                )
                          }
                          aria-label={
                            item.is_active
                              ? "Deactivate item"
                              : "Activate item"
                          }
                          title={
                            item.is_active
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
        <ItemForm
          categories={
            categoriesQuery.data ?? []
          }
          error={
            createItem.error ?? updateItem.error
          }
          isSubmitting={
            createItem.isPending ||
            updateItem.isPending
          }
          item={editingItem}
          onClose={() => {
            setEditingItem(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
