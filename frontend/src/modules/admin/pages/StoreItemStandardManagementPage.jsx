import {
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Download,
  FileDown,
  Pencil,
  Plus,
  Power,
  Search,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { reconciliationOverviewPath } from "../../../constants/roles";
import { useAuth } from "../../../hooks/useAuth";
import { useCsvImportControl } from "../../../hooks/useCsvImportControl";
import {
  useActivateReconciliationItemStandard,
  useCreateReconciliationItemStandard,
  useDeactivateReconciliationItemStandard,
  useReconciliationItemCategories,
  useReconciliationItemStandardExport,
  useReconciliationItemStandards,
  useReconciliationItems,
  useUpdateReconciliationItemStandard,
} from "../../../hooks/useReconciliation";
import { ImportResultsPanel } from "../components/ImportResultsPanel";
import {
  ManagementPanel,
  StatusChip,
} from "../components/OrganizationControls";
import {
  compactPayload,
  toBoolean,
} from "../utils/csvImport";
import {
  buildParams,
  downloadCsv,
} from "../utils/organizationUtils";

const IMPORT_COLUMNS = [
  "item_code",
  "grade_label",
  "rate",
  "mix_ratio",
  "effective_from",
  "notes",
  "is_active",
];
const IMPORT_SAMPLE_ROW = {
  item_code: "CEM",
  grade_label: "",
  rate: "6500",
  mix_ratio: "0.30",
  effective_from: "2026-01-01",
  notes: "",
  is_active: "true",
};
const IMPORT_NOTE =
  "item_code must match an existing Item's code (see its Export). Leave grade_label blank for the company-wide fallback, or set it (e.g. M20) for a grade-specific rate/mix. Leave mix_ratio blank for Direct Count items - it's required for Norm Based items. effective_from is YYYY-MM-DD.";

function findItemIdByCode(items, code) {
  if (!code) {
    return "";
  }

  const normalizedCode = String(code)
    .trim()
    .toLowerCase();

  return (
    items.find(
      (item) =>
        String(item.item_code || "")
          .trim()
          .toLowerCase() === normalizedCode,
    )?.id || ""
  );
}

const emptyForm = {
  item: "",
  grade_label: "",
  rate: "",
  mix_ratio: "",
  effective_from: "",
  notes: "",
  is_active: true,
};

function ItemStandardForm({
  categoriesById,
  error,
  isSubmitting,
  items,
  onClose,
  onSubmit,
  standard,
}) {
  const [form, setForm] = useState(() =>
    standard
      ? {
          item: standard.item ?? "",
          grade_label:
            standard.grade_label ?? "",
          rate: standard.rate ?? "",
          mix_ratio: standard.mix_ratio ?? "",
          effective_from:
            standard.effective_from ?? "",
          notes: standard.notes ?? "",
          is_active:
            standard.is_active ?? true,
        }
      : emptyForm,
  );

  const setField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const selectedItem = items.find(
    (item) => item.id === form.item,
  );
  const isNormBased =
    selectedItem?.reconciliation_type ===
    "NORM_BASED";
  const selectedCategory = selectedItem
    ? categoriesById.get(selectedItem.category)
    : null;
  const availableGrades =
    selectedCategory?.grades ?? [];

  return (
    <ManagementPanel
      eyebrow="Company Default Rate / Mix"
      title={
        standard
          ? "Edit Company Default"
          : "Add Company Default"
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
            mix_ratio: isNormBased
              ? form.mix_ratio
              : null,
          });
        }}
      >
        <label className="form-field">
          <span>Item</span>
          <select
            value={form.item}
            onChange={(event) =>
              setField(
                "item",
                event.target.value,
              )
            }
            disabled={Boolean(standard)}
            required
          >
            <option value="" disabled hidden>
              Select item
            </option>
            {items.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.item_code} -{" "}
                {item.item_name}
              </option>
            ))}
          </select>
        </label>

        {isNormBased &&
        availableGrades.length ? (
          <label className="form-field">
            <span>Grade (optional)</span>
            <select
              value={form.grade_label}
              onChange={(event) =>
                setField(
                  "grade_label",
                  event.target.value,
                )
              }
              disabled={Boolean(standard)}
            >
              <option value="">
                Every grade (company-wide)
              </option>
              {availableGrades.map((grade) => (
                <option
                  key={grade}
                  value={grade}
                >
                  {grade}
                </option>
              ))}
            </select>
          </label>
        ) : isNormBased ? (
          <label className="form-field">
            <span>Grade (optional)</span>
            <input
              value={form.grade_label}
              onChange={(event) =>
                setField(
                  "grade_label",
                  event.target.value,
                )
              }
              disabled={Boolean(standard)}
              placeholder="Leave blank to apply to every grade, or set e.g. M20"
            />
            <span className="table-subtext">
              {selectedCategory
                ? `${selectedCategory.category_name} has no grades configured yet - add some in Item Category Management for a controlled dropdown here.`
                : ""}
            </span>
          </label>
        ) : null}

        <div className="form-grid">
          <label className="form-field">
            <span>Rate</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.rate}
              onChange={(event) =>
                setField(
                  "rate",
                  event.target.value,
                )
              }
              required
            />
          </label>
          {isNormBased ? (
            <label className="form-field">
              <span>Mix Ratio</span>
              <input
                type="number"
                step="0.000001"
                min="0"
                value={form.mix_ratio}
                onChange={(event) =>
                  setField(
                    "mix_ratio",
                    event.target.value,
                  )
                }
                required={isNormBased}
              />
            </label>
          ) : null}
        </div>

        <label className="form-field">
          <span>Effective From</span>
          <input
            type="date"
            value={form.effective_from}
            onChange={(event) =>
              setField(
                "effective_from",
                event.target.value,
              )
            }
            required
          />
        </label>

        <label className="form-field">
          <span>Notes</span>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(event) =>
              setField(
                "notes",
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
          <span>Active</span>
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
              : "Save Default"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function StoreItemStandardManagementPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    search: "",
    is_active: "",
    ordering: "-effective_from",
    page: 1,
  });
  const [editingStandard, setEditingStandard] =
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

  const standardsQuery =
    useReconciliationItemStandards(queryParams);
  const itemsQuery = useReconciliationItems({
    page_size: 500,
    is_active: true,
  });
  const categoriesQuery =
    useReconciliationItemCategories({
      page_size: 500,
      is_active: true,
    });
  const exportQuery =
    useReconciliationItemStandardExport(
      exportParams,
    );
  const createStandard =
    useCreateReconciliationItemStandard();
  const updateStandard =
    useUpdateReconciliationItemStandard();
  const activateStandard =
    useActivateReconciliationItemStandard();
  const deactivateStandard =
    useDeactivateReconciliationItemStandard();

  const standards =
    standardsQuery.data?.items ?? [];
  const items = itemsQuery.data?.items ?? [];
  // Lets the form show/enforce each item's own category's
  // configured grade list instead of a free-text Grade field.
  const categoriesById = useMemo(
    () =>
      new Map(
        (categoriesQuery.data?.items ?? []).map(
          (category) => [category.id, category],
        ),
      ),
    [categoriesQuery.data],
  );
  const csvFileInputRef = useRef(null);
  const csvImport = useCsvImportControl({
    resource: "item_standards",
    fileInputRef: csvFileInputRef,
    normalizeRow: (row) =>
      compactPayload({
        item: findItemIdByCode(
          items,
          row.item_code,
        ),
        grade_label: row.grade_label,
        rate: row.rate,
        mix_ratio: row.mix_ratio || null,
        effective_from: row.effective_from,
        notes: row.notes,
        is_active: toBoolean(
          row.is_active,
          true,
        ),
      }),
  });
  const pagination =
    standardsQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingStandard) {
      await updateStandard.mutateAsync({
        id: editingStandard.id,
        payload,
      });
    } else {
      await createStandard.mutateAsync(payload);
    }

    setEditingStandard(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "store-item-standards.csv",
      result.data ?? [],
      [
        { key: "item_code", label: "Item Code" },
        { key: "item_name", label: "Item Name" },
        {
          key: "grade_label",
          label: "Grade",
        },
        { key: "rate", label: "Rate" },
        {
          key: "mix_ratio",
          label: "Mix Ratio",
        },
        {
          key: "effective_from",
          label: "Effective From",
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
          <h1>
            Company Default Rate &amp; Mix
          </h1>
          <p>
            Company-wide default tier of the
            three-tier rate/mix inheritance model.
            Sites without their own override use
            these figures.
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
            onClick={() =>
              downloadCsv(
                "template-store-item-standards.csv",
                [IMPORT_SAMPLE_ROW],
                IMPORT_COLUMNS.map((column) => ({
                  key: column,
                  label: column,
                })),
              )
            }
          >
            <FileDown size={17} />
            Template
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={csvImport.triggerFileDialog}
            disabled={csvImport.isPending}
          >
            <Upload size={17} />
            {csvImport.isPending
              ? "Importing..."
              : "Import CSV"}
          </button>
          <input
            ref={csvFileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={
              csvImport.handleFileChange
            }
            style={{ display: "none" }}
          />
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
              setEditingStandard(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Default
          </button>
        </div>
      </div>

      <p className="table-subtext">
        {IMPORT_NOTE}
      </p>
      <ImportResultsPanel
        error={csvImport.error}
        results={csvImport.results}
      />

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
              placeholder="Search by item"
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
        </div>

        {standardsQuery.isLoading ? (
          <AppLoader label="Loading defaults..." />
        ) : standardsQuery.isError ? (
          <ErrorState
            title="Company defaults unavailable"
            message={
              standardsQuery.error?.message
            }
            onRetry={standardsQuery.refetch}
          />
        ) : !standards.length ? (
          <EmptyState
            title="No company defaults found"
            message="Add a company-wide rate/mix default."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Grade</th>
                  <th>Rate</th>
                  <th>Mix Ratio</th>
                  <th>Effective From</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {standards.map((standard) => (
                  <tr key={standard.id}>
                    <td>
                      <strong>
                        {standard.item_code}
                      </strong>
                      <span className="table-subtext">
                        {standard.item_name}
                      </span>
                    </td>
                    <td>
                      {standard.grade_label ||
                        "All grades"}
                    </td>
                    <td>{standard.rate}</td>
                    <td>
                      {standard.mix_ratio ?? "-"}
                    </td>
                    <td>
                      {standard.effective_from}
                    </td>
                    <td>
                      <StatusChip
                        active={
                          standard.is_active
                        }
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingStandard(
                              standard,
                            );
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit company default"
                          title="Edit company default"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            standard.is_active
                              ? deactivateStandard.mutate(
                                  standard.id,
                                )
                              : activateStandard.mutate(
                                  standard.id,
                                )
                          }
                          aria-label={
                            standard.is_active
                              ? "Deactivate default"
                              : "Activate default"
                          }
                          title={
                            standard.is_active
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
        <ItemStandardForm
          categoriesById={categoriesById}
          error={
            createStandard.error ??
            updateStandard.error
          }
          isSubmitting={
            createStandard.isPending ||
            updateStandard.isPending
          }
          items={items}
          onClose={() => {
            setEditingStandard(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
          standard={editingStandard}
        />
      ) : null}
    </div>
  );
}
