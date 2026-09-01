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
  useActivateReconciliationItemCategory,
  useCreateReconciliationItemCategory,
  useDeactivateReconciliationItemCategory,
  useReconciliationItemCategories,
  useReconciliationItemCategoryExport,
  useUpdateReconciliationItemCategory,
} from "../../../hooks/useReconciliation";
import { ImportResultsPanel } from "../components/ImportResultsPanel";
import {
  ManagementPanel,
  StatusChip,
} from "../components/OrganizationControls";
import {
  compactPayload,
  toBoolean,
  toNumber,
} from "../utils/csvImport";
import {
  buildParams,
  downloadCsv,
} from "../utils/organizationUtils";

const IMPORT_COLUMNS = [
  "category_name",
  "is_production_output",
  "description",
  "display_order",
  "is_active",
];
const IMPORT_SAMPLE_ROW = {
  category_name: "Concrete Materials",
  is_production_output: "false",
  description: "Cement, aggregates, sand",
  display_order: "1",
  is_active: "true",
};

function normalizeCategoryImportRow(row) {
  return compactPayload({
    category_name: row.category_name,
    is_production_output: toBoolean(
      row.is_production_output,
      false,
    ),
    description: row.description,
    display_order: toNumber(
      row.display_order,
    ),
    is_active: toBoolean(row.is_active, true),
  });
}

const emptyForm = {
  category_code: "",
  category_name: "",
  is_production_output: false,
  grades: [],
  description: "",
  display_order: 0,
  is_active: true,
};

function GradeChipsField({ grades, onChange }) {
  const [draft, setDraft] = useState("");

  const addGrade = () => {
    const label = draft.trim().toUpperCase();
    if (!label) {
      return;
    }
    if (
      grades.some(
        (grade) => grade.toUpperCase() === label,
      )
    ) {
      setDraft("");
      return;
    }
    onChange([...grades, label]);
    setDraft("");
  };

  return (
    <label className="form-field">
      <span>Grades</span>
      <div className="grade-chip-list">
        {grades.length ? (
          grades.map((grade) => (
            <span
              key={grade}
              className="grade-chip"
            >
              {grade}
              <button
                type="button"
                className="grade-chip__remove"
                onClick={() =>
                  onChange(
                    grades.filter(
                      (existing) =>
                        existing !== grade,
                    ),
                  )
                }
                aria-label={`Remove grade ${grade}`}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="table-subtext">
            No grades added yet.
          </span>
        )}
      </div>
      <div className="grade-chip-input">
        <input
          value={draft}
          onChange={(event) =>
            setDraft(event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addGrade();
            }
          }}
          placeholder="e.g. M20"
        />
        <button
          type="button"
          className="button button--tertiary"
          onClick={addGrade}
        >
          <Plus size={15} />
          Add Grade
        </button>
      </div>
      <p className="table-subtext">
        The valid production grades for this
        category (e.g. M10, M20, M25, M30) -
        powers the Grade dropdown on Production
        Output, Company Defaults, and Site
        Overrides instead of free-typed text.
      </p>
    </label>
  );
}

function ItemCategoryForm({
  category,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() =>
    category
      ? {
          category_code:
            category.category_code ?? "",
          category_name:
            category.category_name ?? "",
          is_production_output:
            category.is_production_output ??
            false,
          grades: category.grades ?? [],
          description:
            category.description ?? "",
          display_order:
            category.display_order ?? 0,
          is_active:
            category.is_active ?? true,
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
      eyebrow="Store Item Category Master"
      title={
        category
          ? "Edit Item Category"
          : "Add Item Category"
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
            grades: form.is_production_output
              ? form.grades
              : [],
            display_order: Number(
              form.display_order || 0,
            ),
          });
        }}
      >
        <div className="form-grid">
          {category ? (
            <label className="form-field">
              <span>Category Code</span>
              <input
                value={form.category_code}
                readOnly
              />
            </label>
          ) : null}
          <label className="form-field">
            <span>Category Name</span>
            <input
              value={form.category_name}
              onChange={(event) =>
                setField(
                  "category_name",
                  event.target.value,
                )
              }
              required
            />
          </label>
        </div>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={
              form.is_production_output
            }
            onChange={(event) =>
              setField(
                "is_production_output",
                event.target.checked,
              )
            }
          />
          <span>
            This is a production type (e.g.
            Concrete) - every item assigned to
            it becomes one of its recipe
            materials, and it becomes
            selectable as a product on
            Production Output. Leave unchecked
            for an ordinary grouping (e.g.
            Steel).
          </span>
        </label>

        {form.is_production_output ? (
          <GradeChipsField
            grades={form.grades}
            onChange={(grades) =>
              setField("grades", grades)
            }
          />
        ) : null}

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
            <span>Active category</span>
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
              : "Save Category"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function StoreItemCategoryManagementPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    search: "",
    is_active: "",
    ordering: "display_order",
    page: 1,
  });
  const [editingCategory, setEditingCategory] =
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

  const categoriesQuery =
    useReconciliationItemCategories(queryParams);
  const exportQuery =
    useReconciliationItemCategoryExport(
      exportParams,
    );
  const createCategory =
    useCreateReconciliationItemCategory();
  const updateCategory =
    useUpdateReconciliationItemCategory();
  const activateCategory =
    useActivateReconciliationItemCategory();
  const deactivateCategory =
    useDeactivateReconciliationItemCategory();
  const csvFileInputRef = useRef(null);
  const csvImport = useCsvImportControl({
    resource: "item_categories",
    normalizeRow: normalizeCategoryImportRow,
    fileInputRef: csvFileInputRef,
  });

  const categories =
    categoriesQuery.data?.items ?? [];
  const pagination =
    categoriesQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingCategory) {
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        payload,
      });
    } else {
      await createCategory.mutateAsync(payload);
    }

    setEditingCategory(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "store-item-categories.csv",
      result.data ?? [],
      [
        {
          key: "category_code",
          label: "Category Code",
        },
        {
          key: "category_name",
          label: "Category Name",
        },
        {
          key: "is_production_output",
          label: "Production Type",
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
            Store Reconciliation
          </span>
          <h1>Item Category Management</h1>
          <p>
            Maintain store item categories used
            across reconciliation masters.
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
                "template-store-item-categories.csv",
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
              setEditingCategory(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Category
          </button>
        </div>
      </div>

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
              placeholder="Search categories"
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

        {categoriesQuery.isLoading ? (
          <AppLoader label="Loading categories..." />
        ) : categoriesQuery.isError ? (
          <ErrorState
            title="Item categories unavailable"
            message={
              categoriesQuery.error?.message
            }
            onRetry={categoriesQuery.refetch}
          />
        ) : !categories.length ? (
          <EmptyState
            title="No item categories found"
            message="Adjust filters or add a category."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      {category.category_code}
                    </td>
                    <td>
                      <strong>
                        {category.category_name}
                      </strong>
                      <span className="table-subtext">
                        {category.description ||
                          "-"}
                      </span>
                    </td>
                    <td>
                      {category.is_production_output ? (
                        <>
                          <span className="status-chip status-chip--warning">
                            Production Type
                          </span>
                          <span className="table-subtext">
                            {category.grades
                              ?.length
                              ? category.grades.join(
                                  ", ",
                                )
                              : "No grades added yet"}
                          </span>
                        </>
                      ) : (
                        <span className="table-subtext">
                          Materials
                        </span>
                      )}
                    </td>
                    <td>
                      {category.display_order}
                    </td>
                    <td>
                      <StatusChip
                        active={
                          category.is_active
                        }
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingCategory(
                              category,
                            );
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit item category"
                          title="Edit item category"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            category.is_active
                              ? deactivateCategory.mutate(
                                  category.id,
                                )
                              : activateCategory.mutate(
                                  category.id,
                                )
                          }
                          aria-label={
                            category.is_active
                              ? "Deactivate item category"
                              : "Activate item category"
                          }
                          title={
                            category.is_active
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
        <ItemCategoryForm
          category={editingCategory}
          error={
            createCategory.error ??
            updateCategory.error
          }
          isSubmitting={
            createCategory.isPending ||
            updateCategory.isPending
          }
          onClose={() => {
            setEditingCategory(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
