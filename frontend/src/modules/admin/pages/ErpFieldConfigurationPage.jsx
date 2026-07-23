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
  useActivateErpRequestFieldConfiguration,
  useCreateErpRequestFieldConfiguration,
  useDeactivateErpRequestFieldConfiguration,
  useErpModulesDropdown,
  useErpPrioritiesDropdown,
  useErpRequestFieldConfigurationExport,
  useErpRequestFieldConfigurations,
  useErpVoucherTypesDropdown,
  useErpWorkTypesDropdown,
  useUpdateErpRequestFieldConfiguration,
} from "../../../hooks/useErp";
import {
  ManagementPanel,
  StatusChip,
} from "../components/OrganizationControls";
import {
  buildParams,
  downloadCsv,
} from "../utils/organizationUtils";

const FIELD_STATES = [
  {
    value: "REQUIRED",
    label: "Required",
  },
  {
    value: "OPTIONAL",
    label: "Optional",
  },
  {
    value: "HIDDEN",
    label: "Hidden",
  },
];

const emptyForm = {
  field_key: "",
  field_label: "",
  field_state: "OPTIONAL",
  erp_module: "",
  voucher_type: "",
  work_type: "",
  priority: "",
  help_text: "",
  display_order: 0,
  is_active: true,
};

function optionLabel(option) {
  return option.code
    ? `${option.code} - ${option.label}`
    : option.label;
}

function optionalValue(value) {
  return value || null;
}

function FieldStateChip({ state }) {
  const className =
    state === "REQUIRED"
      ? "status-chip status-chip--warning"
      : state === "HIDDEN"
        ? "status-chip status-chip--error"
        : "status-chip status-chip--success";

  return <span className={className}>{state}</span>;
}

function ErpFieldConfigurationForm({
  configuration,
  error,
  isSubmitting,
  modules,
  onClose,
  onSubmit,
  priorities,
  voucherTypes,
  workTypes,
}) {
  const [form, setForm] = useState(() =>
    configuration
      ? {
          field_key:
            configuration.field_key ?? "",
          field_label:
            configuration.field_label ?? "",
          field_state:
            configuration.field_state ??
            "OPTIONAL",
          erp_module:
            configuration.erp_module ?? "",
          voucher_type:
            configuration.voucher_type ?? "",
          work_type:
            configuration.work_type ?? "",
          priority:
            configuration.priority ?? "",
          help_text:
            configuration.help_text ?? "",
          display_order:
            configuration.display_order ?? 0,
          is_active:
            configuration.is_active ?? true,
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

  const validateAndSubmit = () => {
    if (form.voucher_type && !form.erp_module) {
      setLocalError(
        "Select ERP module for voucher-specific field configuration.",
      );
      return;
    }

    setLocalError("");
    onSubmit({
      ...form,
      erp_module: optionalValue(form.erp_module),
      voucher_type: optionalValue(
        form.voucher_type,
      ),
      work_type: optionalValue(form.work_type),
      priority: optionalValue(form.priority),
      display_order: Number(
        form.display_order || 0,
      ),
    });
  };

  return (
    <ManagementPanel
      eyebrow="Field Configuration"
      title={
        configuration
          ? "Edit Field Rule"
          : "Add Field Rule"
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
        <div className="form-grid">
          {configuration ? (
            <label className="form-field">
              <span>Field Key</span>
              <input
                value={form.field_key}
                readOnly
              />
            </label>
          ) : null}
          <label className="form-field">
            <span>Field Label</span>
            <input
              value={form.field_label}
              onChange={(event) =>
                setField(
                  "field_label",
                  event.target.value,
                )
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Field State</span>
            <select
              value={form.field_state}
              onChange={(event) =>
                setField(
                  "field_state",
                  event.target.value,
                )
              }
              required
            >
              {FIELD_STATES.map((state) => (
                <option
                  key={state.value}
                  value={state.value}
                >
                  {state.label}
                </option>
              ))}
            </select>
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
            >
              <option value="">Any module</option>
              {modules.map((module) => (
                <option
                  key={module.id}
                  value={module.id}
                >
                  {optionLabel(module)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Voucher Type</span>
            <select
              value={form.voucher_type}
              onChange={(event) =>
                setField(
                  "voucher_type",
                  event.target.value,
                )
              }
            >
              <option value="">Any voucher</option>
              {voucherTypes.map((voucher) => (
                <option
                  key={voucher.id}
                  value={voucher.id}
                >
                  {optionLabel(voucher)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Work Type</span>
            <select
              value={form.work_type}
              onChange={(event) =>
                setField(
                  "work_type",
                  event.target.value,
                )
              }
            >
              <option value="">Any work type</option>
              {workTypes.map((workType) => (
                <option
                  key={workType.id}
                  value={workType.id}
                >
                  {optionLabel(workType)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Priority</span>
            <select
              value={form.priority}
              onChange={(event) =>
                setField(
                  "priority",
                  event.target.value,
                )
              }
            >
              <option value="">Any priority</option>
              {priorities.map((priority) => (
                <option
                  key={priority.id}
                  value={priority.id}
                >
                  {optionLabel(priority)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span>Help Text</span>
          <textarea
            rows={3}
            value={form.help_text}
            onChange={(event) =>
              setField(
                "help_text",
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
            <span>Active field rule</span>
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
              : "Save Field Rule"}
          </button>
        </div>
      </form>
    </ManagementPanel>
  );
}

export function ErpFieldConfigurationPage() {
  const [filters, setFilters] = useState({
    search: "",
    field_state: "",
    erp_module: "",
    voucher_type: "",
    is_active: "",
    ordering: "display_order",
    page: 1,
  });
  const [
    editingConfiguration,
    setEditingConfiguration,
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
        field_state: filters.field_state,
        erp_module: filters.erp_module,
        voucher_type: filters.voucher_type,
        is_active: filters.is_active,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const configurationsQuery =
    useErpRequestFieldConfigurations(
      queryParams,
    );
  const modulesQuery =
    useErpModulesDropdown();
  const voucherTypesQuery =
    useErpVoucherTypesDropdown();
  const workTypesQuery =
    useErpWorkTypesDropdown();
  const prioritiesQuery =
    useErpPrioritiesDropdown();
  const exportQuery =
    useErpRequestFieldConfigurationExport(
      exportParams,
    );
  const createConfiguration =
    useCreateErpRequestFieldConfiguration();
  const updateConfiguration =
    useUpdateErpRequestFieldConfiguration();
  const activateConfiguration =
    useActivateErpRequestFieldConfiguration();
  const deactivateConfiguration =
    useDeactivateErpRequestFieldConfiguration();

  const configurations =
    configurationsQuery.data?.items ?? [];
  const pagination =
    configurationsQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleSubmit = async (payload) => {
    if (editingConfiguration) {
      await updateConfiguration.mutateAsync({
        id: editingConfiguration.id,
        payload,
      });
    } else {
      await createConfiguration.mutateAsync(
        payload,
      );
    }

    setEditingConfiguration(null);
    setIsFormOpen(false);
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "erp-field-configurations.csv",
      result.data ?? [],
      [
        {
          key: "field_key",
          label: "Field Key",
        },
        {
          key: "field_label",
          label: "Field Label",
        },
        {
          key: "field_state",
          label: "Field State",
        },
        {
          key: "erp_module_code",
          label: "ERP Module",
        },
        {
          key: "voucher_code",
          label: "Voucher",
        },
        {
          key: "work_type_code",
          label: "Work Type",
        },
        {
          key: "priority_code",
          label: "Priority",
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
          <h1>Field Configuration</h1>
          <p>
            Configure required, optional and hidden
            request fields by ERP context.
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
              setEditingConfiguration(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add Field Rule
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
              placeholder="Search field rules"
            />
          </label>
          <label className="filter-control">
            <span>State</span>
            <select
              value={filters.field_state}
              onChange={(event) =>
                setFilter(
                  "field_state",
                  event.target.value,
                )
              }
            >
              <option value="">All</option>
              {FIELD_STATES.map((state) => (
                <option
                  key={state.value}
                  value={state.value}
                >
                  {state.label}
                </option>
              ))}
            </select>
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

        {configurationsQuery.isLoading ? (
          <AppLoader label="Loading field configuration..." />
        ) : configurationsQuery.isError ? (
          <ErrorState
            title="Field configuration unavailable"
            message={
              configurationsQuery.error?.message
            }
            onRetry={configurationsQuery.refetch}
          />
        ) : !configurations.length ? (
          <EmptyState
            title="No field rules found"
            message="Adjust filters or add a field rule."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>State</th>
                  <th>Scope</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {configurations.map(
                  (configuration) => (
                    <tr key={configuration.id}>
                      <td>
                        <strong>
                          {
                            configuration.field_label
                          }
                        </strong>
                        <span className="table-subtext">
                          {
                            configuration.field_key
                          }
                        </span>
                      </td>
                      <td>
                        <FieldStateChip
                          state={
                            configuration.field_state
                          }
                        />
                      </td>
                      <td>
                        {configuration.erp_module_code ||
                          "Any module"}
                        <span className="table-subtext">
                          {[
                            configuration.voucher_code,
                            configuration.work_type_code,
                            configuration.priority_code,
                          ]
                            .filter(Boolean)
                            .join(" / ") ||
                            "Global"}
                        </span>
                      </td>
                      <td>
                        {
                          configuration.display_order
                        }
                      </td>
                      <td>
                        <StatusChip
                          active={
                            configuration.is_active
                          }
                        />
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => {
                              setEditingConfiguration(
                                configuration,
                              );
                              setIsFormOpen(true);
                            }}
                            aria-label="Edit field rule"
                            title="Edit field rule"
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() =>
                              configuration.is_active
                                ? deactivateConfiguration.mutate(
                                    configuration.id,
                                  )
                                : activateConfiguration.mutate(
                                    configuration.id,
                                  )
                            }
                            aria-label={
                              configuration.is_active
                                ? "Deactivate field rule"
                                : "Activate field rule"
                            }
                            title={
                              configuration.is_active
                                ? "Deactivate"
                                : "Activate"
                            }
                          >
                            <Power size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
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
        <ErpFieldConfigurationForm
          configuration={editingConfiguration}
          error={
            createConfiguration.error ??
            updateConfiguration.error
          }
          isSubmitting={
            createConfiguration.isPending ||
            updateConfiguration.isPending
          }
          modules={modulesQuery.data ?? []}
          onClose={() => {
            setEditingConfiguration(null);
            setIsFormOpen(false);
          }}
          onSubmit={handleSubmit}
          priorities={prioritiesQuery.data ?? []}
          voucherTypes={
            voucherTypesQuery.data ?? []
          }
          workTypes={workTypesQuery.data ?? []}
        />
      ) : null}
    </div>
  );
}
