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
  useActivateDesignation,
  useCreateDesignation,
  useDeactivateDesignation,
  useDesignationExport,
  useDesignations,
  useUpdateDesignation,
} from "../../../hooks/useOrganization";

const emptyForm = {
  designation_code: "",
  designation_name: "",
  level: 0,
  is_active: true,
};

function DesignationForm({
  designation,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() =>
    designation
      ? {
          designation_code:
            designation.designation_code ?? "",
          designation_name:
            designation.designation_name ?? "",
          level: designation.level ?? 0,
          is_active:
            designation.is_active ?? true,
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
      eyebrow="Designation Master"
      title={
        designation
          ? "Edit Designation"
          : "Add Designation"
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
            level: Number(form.level || 0),
          });
        }}
      >
        <div className="form-grid">
          {designation ? (
            <label className="form-field">
              <span>Designation Code</span>
              <input
                value={form.designation_code}
                readOnly
              />
            </label>
          ) : null}
          <label className="form-field">
            <span>Designation Name</span>
            <input
              value={form.designation_name}
              onChange={(event) =>
                setField(
                  "designation_name",
                  event.target.value,
                )
              }
              required
            />
          </label>
        </div>

        <label className="form-field">
          <span>Level</span>
          <input
            type="number"
            min="0"
            value={form.level}
            onChange={(event) =>
              setField(
                "level",
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
          <span>Active designation</span>
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
              : "Save Designation"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function DesignationManagementPage() {
  const [filters, setFilters] = useState({
    search: "",
    level: "",
    is_active: "",
    ordering: "level",
    page: 1,
  });
  const [editingDesignation, setEditingDesignation] =
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
        level: filters.level,
        is_active: filters.is_active,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const designationsQuery =
    useDesignations(queryParams);
  const exportQuery =
    useDesignationExport(exportParams);
  const createDesignation =
    useCreateDesignation();
  const updateDesignation =
    useUpdateDesignation();
  const activateDesignation =
    useActivateDesignation();
  const deactivateDesignation =
    useDeactivateDesignation();

  const designations =
    designationsQuery.data?.items ?? [];
  const pagination =
    designationsQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingDesignation) {
      await updateDesignation.mutateAsync({
        id: editingDesignation.id,
        payload,
      });
    } else {
      await createDesignation.mutateAsync(
        payload,
      );
    }

    setEditingDesignation(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "organization-designations.csv",
      result.data ?? [],
      [
        {
          key: "designation_code",
          label: "Designation Code",
        },
        {
          key: "designation_name",
          label: "Designation Name",
        },
        {
          key: "level",
          label: "Level",
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
          <h1>Designation Management</h1>
          <p>
            Maintain reusable designation codes
            and role titles.
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
              setEditingDesignation(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Designation
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
              placeholder="Search designation codes or names"
            />
          </label>
          <label className="filter-control">
            <span>Level</span>
            <input
              type="number"
              min="0"
              value={filters.level}
              onChange={(event) =>
                setFilter(
                  "level",
                  event.target.value,
                )
              }
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

        {designationsQuery.isLoading ? (
          <AppLoader label="Loading designations..." />
        ) : designationsQuery.isError ? (
          <ErrorState
            title="Designations unavailable"
            message={
              designationsQuery.error?.message
            }
            onRetry={designationsQuery.refetch}
          />
        ) : !designations.length ? (
          <EmptyState
            title="No designations found"
            message="Adjust filters or add a designation."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Designation</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {designations.map((designation) => (
                  <tr key={designation.id}>
                    <td>
                      {
                        designation.designation_code
                      }
                    </td>
                    <td>
                      {
                        designation.designation_name
                      }
                    </td>
                    <td>{designation.level}</td>
                    <td>
                      <StatusChip
                        active={
                          designation.is_active
                        }
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingDesignation(
                              designation,
                            );
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit designation"
                          title="Edit designation"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            designation.is_active
                              ? deactivateDesignation.mutate(
                                  designation.id,
                                )
                              : activateDesignation.mutate(
                                  designation.id,
                                )
                          }
                          aria-label={
                            designation.is_active
                              ? "Deactivate designation"
                              : "Activate designation"
                          }
                          title={
                            designation.is_active
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
        <DesignationForm
          designation={editingDesignation}
          error={
            createDesignation.error ??
            updateDesignation.error
          }
          isSubmitting={
            createDesignation.isPending ||
            updateDesignation.isPending
          }
          onClose={() => {
            setEditingDesignation(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
