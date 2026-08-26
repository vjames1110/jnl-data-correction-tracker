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
import { useSitesDropdown } from "../../../hooks/useOrganization";
import {
  useActivateReconciliationSiteItemConfig,
  useCreateReconciliationSiteItemConfig,
  useDeactivateReconciliationSiteItemConfig,
  useReconciliationItems,
  useReconciliationSiteItemConfigExport,
  useReconciliationSiteItemConfigs,
  useUpdateReconciliationSiteItemConfig,
} from "../../../hooks/useReconciliation";
import {
  ManagementPanel,
  StatusChip,
} from "../components/OrganizationControls";
import {
  buildParams,
  downloadCsv,
} from "../utils/organizationUtils";

const emptyForm = {
  site: "",
  item: "",
  grade_label: "",
  rate: "",
  mix_ratio: "",
  effective_from: "",
  notes: "",
  is_active: true,
};

function SiteItemConfigForm({
  config,
  error,
  isSubmitting,
  items,
  onClose,
  onSubmit,
  sites,
}) {
  const [form, setForm] = useState(() =>
    config
      ? {
          site: config.site ?? "",
          item: config.item ?? "",
          grade_label:
            config.grade_label ?? "",
          rate: config.rate ?? "",
          mix_ratio: config.mix_ratio ?? "",
          effective_from:
            config.effective_from ?? "",
          notes: config.notes ?? "",
          is_active: config.is_active ?? true,
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

  return (
    <ManagementPanel
      eyebrow="Site Override Rate / Mix"
      title={
        config
          ? "Edit Site Override"
          : "Add Site Override"
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
              disabled={Boolean(config)}
              required
            >
              <option value="" disabled hidden>
                Select site
              </option>
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
              disabled={Boolean(config)}
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
        </div>

        {isNormBased ? (
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
              disabled={Boolean(config)}
              placeholder="Leave blank to apply to every grade, or set e.g. M20"
            />
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
          <span>
            Active (locks this site to its own
            figures)
          </span>
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
              : "Save Override"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function StoreSiteItemConfigManagementPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    search: "",
    site: "",
    is_active: "",
    ordering: "-effective_from",
    page: 1,
  });
  const [editingConfig, setEditingConfig] =
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
        is_active: filters.is_active,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const configsQuery =
    useReconciliationSiteItemConfigs(
      queryParams,
    );
  const itemsQuery = useReconciliationItems({
    page_size: 500,
    is_active: true,
  });
  const sitesQuery = useSitesDropdown();
  const exportQuery =
    useReconciliationSiteItemConfigExport(
      exportParams,
    );
  const createConfig =
    useCreateReconciliationSiteItemConfig();
  const updateConfig =
    useUpdateReconciliationSiteItemConfig();
  const activateConfig =
    useActivateReconciliationSiteItemConfig();
  const deactivateConfig =
    useDeactivateReconciliationSiteItemConfig();

  const configs = configsQuery.data?.items ?? [];
  const items = itemsQuery.data?.items ?? [];
  const sites = sitesQuery.data ?? [];
  const pagination =
    configsQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingConfig) {
      await updateConfig.mutateAsync({
        id: editingConfig.id,
        payload,
      });
    } else {
      await createConfig.mutateAsync(payload);
    }

    setEditingConfig(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "store-site-item-configs.csv",
      result.data ?? [],
      [
        { key: "site_code", label: "Site" },
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
          <h1>Site Rate &amp; Mix Overrides</h1>
          <p>
            Site-level tier of the inheritance
            model. An active override locks that
            site to its own figures until
            deactivated.
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
              setEditingConfig(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Override
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
              placeholder="Search by item or site"
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
              {sites.map((site) => (
                <option
                  key={site.id}
                  value={site.id}
                >
                  {site.code}
                </option>
              ))}
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

        {configsQuery.isLoading ? (
          <AppLoader label="Loading overrides..." />
        ) : configsQuery.isError ? (
          <ErrorState
            title="Site overrides unavailable"
            message={
              configsQuery.error?.message
            }
            onRetry={configsQuery.refetch}
          />
        ) : !configs.length ? (
          <EmptyState
            title="No site overrides found"
            message="Adjust filters or add a site override."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Site</th>
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
                {configs.map((config) => (
                  <tr key={config.id}>
                    <td>
                      {config.site_code}
                      <span className="table-subtext">
                        {config.site_name}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {config.item_code}
                      </strong>
                      <span className="table-subtext">
                        {config.item_name}
                      </span>
                    </td>
                    <td>
                      {config.grade_label ||
                        "All grades"}
                    </td>
                    <td>{config.rate}</td>
                    <td>
                      {config.mix_ratio ?? "-"}
                    </td>
                    <td>
                      {config.effective_from}
                    </td>
                    <td>
                      <StatusChip
                        active={
                          config.is_active
                        }
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingConfig(
                              config,
                            );
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit site override"
                          title="Edit site override"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            config.is_active
                              ? deactivateConfig.mutate(
                                  config.id,
                                )
                              : activateConfig.mutate(
                                  config.id,
                                )
                          }
                          aria-label={
                            config.is_active
                              ? "Deactivate site override"
                              : "Activate site override"
                          }
                          title={
                            config.is_active
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
        <SiteItemConfigForm
          config={editingConfig}
          error={
            createConfig.error ??
            updateConfig.error
          }
          isSubmitting={
            createConfig.isPending ||
            updateConfig.isPending
          }
          items={items}
          onClose={() => {
            setEditingConfig(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
          sites={sites}
        />
      ) : null}
    </div>
  );
}
