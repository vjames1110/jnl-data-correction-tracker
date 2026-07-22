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
  normalizeDatePayload,
} from "../utils/organizationUtils";
import {
  useActivateDirectorMapping,
  useCreateDirectorMapping,
  useDeactivateDirectorMapping,
  useDirectorMappingExport,
  useDirectorMappings,
  useSitesDropdown,
  useUpdateDirectorMapping,
  useUsersDropdown,
} from "../../../hooks/useOrganization";

const emptyForm = {
  director: "",
  sites: [],
  authority_type: "PRIMARY",
  effective_from: "",
  effective_to: "",
  is_active: true,
};

function DirectorMappingForm({
  sites,
  users,
  mapping,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() =>
    mapping
      ? {
          director: mapping.director ?? "",
          sites: mapping.site
            ? [mapping.site]
            : [],
          authority_type:
            mapping.authority_type ?? "PRIMARY",
          effective_from:
            mapping.effective_from ?? "",
          effective_to:
            mapping.effective_to ?? "",
          is_active:
            mapping.is_active ?? true,
        }
      : emptyForm,
  );
  const [localError, setLocalError] =
    useState("");

  const setField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateSelectedSites = (options) => {
    setField(
      "sites",
      Array.from(options)
        .filter((option) => option.selected)
        .map((option) => option.value),
    );
  };

  const validateAndSubmit = () => {
    if (!form.sites.length) {
      setLocalError(
        "Select at least one site.",
      );
      return;
    }

    if (
      form.effective_from &&
      form.effective_to &&
      form.effective_to < form.effective_from
    ) {
      setLocalError(
        "Effective-to date cannot be before effective-from date.",
      );
      return;
    }

    setLocalError("");
    onSubmit(
      normalizeDatePayload(
        {
          ...form,
          department: null,
          effective_to:
            form.effective_to || null,
        },
        ["effective_to"],
      ),
    );
  };

  return (
    <ManagementPanel
      eyebrow="Director Mapping"
      title={
        mapping
          ? "Edit Director Mapping"
          : "Add Director Mapping"
      }
      onClose={onClose}
    >
      {localError || error ? (
        <div className="inline-alert inline-alert--error">
          <strong>
            {localError || error.message}
          </strong>
        </div>
      ) : null}

      <form
        className="site-form"
        onSubmit={(event) => {
          event.preventDefault();
          validateAndSubmit();
        }}
      >
        <label className="form-field">
          <span>Director</span>
          <select
            value={form.director}
            onChange={(event) =>
              setField(
                "director",
                event.target.value,
              )
            }
            required
          >
            <option value="" disabled hidden>
              Select director
            </option>
            {users.map((user) => (
              <option
                key={user.id}
                value={user.id}
              >
                {user.label}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Sites</span>
          <select
            multiple
            value={form.sites}
            onChange={(event) =>
              updateSelectedSites(
                event.target.options,
              )
            }
            size={Math.min(
              Math.max(sites.length, 3),
              7,
            )}
            required
          >
            {sites.map((site) => (
              <option
                key={site.id}
                value={site.id}
              >
                {site.code} - {site.label}
              </option>
            ))}
          </select>
        </label>

        <div className="form-grid">
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
            <span>Effective To</span>
            <input
              type="date"
              value={form.effective_to}
              onChange={(event) =>
                setField(
                  "effective_to",
                  event.target.value,
                )
              }
            />
          </label>
        </div>

        <label className="form-field">
          <span>Authority</span>
          <select
            value={form.authority_type}
            onChange={(event) =>
              setField(
                "authority_type",
                event.target.value,
              )
            }
          >
            <option value="PRIMARY">
              Primary
            </option>
            <option value="BACKUP">
              Backup
            </option>
          </select>
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
          <span>Active mapping</span>
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

export function DirectorMappingPage() {
  const [filters, setFilters] = useState({
    search: "",
    site: "",
    authority_type: "",
    is_active: "",
    ordering: "-effective_from",
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
        site: filters.site,
        authority_type:
          filters.authority_type,
        is_active: filters.is_active,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const mappingsQuery =
    useDirectorMappings(queryParams);
  const sitesQuery = useSitesDropdown();
  const usersQuery = useUsersDropdown({
    designation: "director",
  });
  const exportQuery =
    useDirectorMappingExport(exportParams);
  const createMapping =
    useCreateDirectorMapping();
  const updateMapping =
    useUpdateDirectorMapping();
  const activateMapping =
    useActivateDirectorMapping();
  const deactivateMapping =
    useDeactivateDirectorMapping();

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
    const {
      sites: selectedSites,
      ...mappingPayload
    } = payload;

    if (editingMapping) {
      await updateMapping.mutateAsync({
        id: editingMapping.id,
        payload: {
          ...mappingPayload,
          site: selectedSites[0],
        },
      });
    } else {
      await Promise.all(
        selectedSites.map((site) =>
          createMapping.mutateAsync({
            ...mappingPayload,
            site,
          }),
        ),
      );
    }

    setEditingMapping(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "organization-director-mappings.csv",
      result.data ?? [],
      [
        {
          key: "director",
          label: "Director",
        },
        {
          key: "site_name",
          label: "Site",
        },
        {
          key: "authority_type",
          label: "Authority",
        },
        {
          key: "effective_from",
          label: "Effective From",
        },
        {
          key: "effective_to",
          label: "Effective To",
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
          <h1>Director Mapping</h1>
          <p>
            Maintain primary and backup
            approval authority by site.
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
              placeholder="Search directors or mappings"
            />
          </label>
          <label className="filter-control">
            <span>Site</span>
            <select
              value={filters.site}
              onChange={(event) =>
                setFilter(
                  "site",
                  event.target.value,
                )
              }
            >
              <option value="">All sites</option>
              {(sitesQuery.data ?? []).map(
                (site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.code}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="filter-control">
            <span>Authority</span>
            <select
              value={filters.authority_type}
              onChange={(event) =>
                setFilter(
                  "authority_type",
                  event.target.value,
                )
              }
            >
              <option value="">All</option>
              <option value="PRIMARY">
                Primary
              </option>
              <option value="BACKUP">
                Backup
              </option>
            </select>
          </label>
        </div>

        {mappingsQuery.isLoading ? (
          <AppLoader label="Loading director mappings..." />
        ) : mappingsQuery.isError ? (
          <ErrorState
            title="Director mappings unavailable"
            message={
              mappingsQuery.error?.message
            }
            onRetry={mappingsQuery.refetch}
          />
        ) : !mappings.length ? (
          <EmptyState
            title="No director mappings found"
            message="Adjust filters or add a mapping."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Director</th>
                  <th>Site</th>
                  <th>Authority</th>
                  <th>Effective</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td>
                      {mapping.director_detail
                        ?.full_name ||
                        mapping.director}
                      <span className="table-subtext">
                        {mapping.director_detail
                          ?.employee_id || "-"}
                      </span>
                    </td>
                    <td>
                      {mapping.site_code || "-"}
                    </td>
                    <td>
                      {mapping.authority_type}
                    </td>
                    <td>
                      {mapping.effective_from}
                      <span className="table-subtext">
                        {mapping.effective_to ||
                          "Open ended"}
                      </span>
                    </td>
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
                          aria-label="Edit director mapping"
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
                              ? "Deactivate director mapping"
                              : "Activate director mapping"
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
        <DirectorMappingForm
          sites={sitesQuery.data ?? []}
          users={usersQuery.data ?? []}
          mapping={editingMapping}
          error={
            createMapping.error ??
            updateMapping.error
          }
          isSubmitting={
            createMapping.isPending ||
            updateMapping.isPending
          }
          onClose={() => {
            setEditingMapping(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
