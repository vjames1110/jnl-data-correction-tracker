import { useMemo, useState } from "react";
import {
  ClipboardCheck,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  Filter,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { AppLoader } from "../../../components/common/AppLoader";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { USER_ROLES } from "../../../constants/roles";
import {
  useActivateSite,
  useCompaniesDropdown,
  useCreateSite,
  useDeactivateSite,
  useDownloadSiteTemplate,
  useExportSiteFailedRows,
  useImportSites,
  usePreviewSiteImport,
  useSiteExport,
  useSites,
  useUpdateSite,
  useUsersDropdown,
} from "../../../hooks/useOrganization";

const emptyForm = {
  company: "",
  site_code: "",
  site_name: "",
  project_name: "",
  state: "",
  district: "",
  address: "",
  start_date: "",
  end_date: "",
  site_director: "",
  site_hod: "",
  cost_centre: "",
  erp_site_code: "",
  is_active: true,
};

function mergeUsers(...userGroups) {
  const uniqueUsers = new Map();

  userGroups.flat().forEach((user) => {
    if (user?.id) {
      uniqueUsers.set(user.id, user);
    }
  });

  return Array.from(uniqueUsers.values());
}

function buildParams(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) =>
        value !== "" &&
        value !== null &&
        value !== undefined,
    ),
  );
}

function normalizePayload(form) {
  return {
    ...form,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    site_director:
      form.site_director || null,
    site_hod: form.site_hod || null,
  };
}

function downloadCsv(filename, rows) {
  const columns = [
    "site_code",
    "site_name",
    "company_name",
    "project_name",
    "state",
    "district",
    "is_active",
    "cost_centre",
    "erp_site_code",
  ];

  const escapeValue = (value) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;

  const csv = [
    columns.join(","),
    ...rows.map((row) =>
      columns
        .map((column) =>
          escapeValue(row[column]),
        )
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatusChip({ active }) {
  return (
    <span
      className={
        active
          ? "status-chip status-chip--success"
          : "status-chip status-chip--error"
      }
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function SiteFormPanel({
  companies,
  directorUsers,
  initialSite,
  isSubmitting,
  error,
  onClose,
  onSubmit,
  pmUsers,
}) {
  const [form, setForm] = useState(() => {
    if (!initialSite) {
      return emptyForm;
    }

    return {
      company: initialSite.company ?? "",
      site_code: initialSite.site_code ?? "",
      site_name: initialSite.site_name ?? "",
      project_name:
        initialSite.project_name ?? "",
      state: initialSite.state ?? "",
      district: initialSite.district ?? "",
      address: initialSite.address ?? "",
      start_date:
        initialSite.start_date ?? "",
      end_date: initialSite.end_date ?? "",
      site_director:
        initialSite.site_director ?? "",
      site_hod: initialSite.site_hod ?? "",
      cost_centre:
        initialSite.cost_centre ?? "",
      erp_site_code:
        initialSite.erp_site_code ?? "",
      is_active:
        initialSite.is_active ?? true,
    };
  });

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <div className="management-panel">
      <div className="management-panel__header">
        <div>
          <span className="page-eyebrow">
            Site Master
          </span>
          <h2>
            {initialSite
              ? "Edit Site"
              : "Add Site"}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close form"
        >
          <X size={18} />
        </button>
      </div>

      {error ? (
        <div className="inline-alert inline-alert--error">
          <strong>{error.message}</strong>
        </div>
      ) : null}

      <form
        className="site-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(normalizePayload(form));
        }}
      >
        <label className="form-field">
          <span>Company</span>
          <select
            value={form.company}
            onChange={(event) =>
              updateField(
                "company",
                event.target.value,
              )
            }
            required
          >
            <option value="" disabled hidden>
              Select company
            </option>
            {companies.map((company) => (
              <option
                key={company.id}
                value={company.id}
              >
                {company.code} - {company.label}
              </option>
            ))}
          </select>
        </label>

        <div className="form-grid">
          <label className="form-field">
            <span>Site Code</span>
            <input
              value={form.site_code}
              onChange={(event) =>
                updateField(
                  "site_code",
                  event.target.value,
                )
              }
              required
            />
          </label>

          <label className="form-field">
            <span>Site Name</span>
            <input
              value={form.site_name}
              onChange={(event) =>
                updateField(
                  "site_name",
                  event.target.value,
                )
              }
              required
            />
          </label>
        </div>

        <label className="form-field">
          <span>Project Name</span>
          <input
            value={form.project_name}
            onChange={(event) =>
              updateField(
                "project_name",
                event.target.value,
              )
            }
          />
        </label>

        <div className="form-grid">
          <label className="form-field">
            <span>State</span>
            <input
              value={form.state}
              onChange={(event) =>
                updateField(
                  "state",
                  event.target.value,
                )
              }
            />
          </label>

          <label className="form-field">
            <span>District</span>
            <input
              value={form.district}
              onChange={(event) =>
                updateField(
                  "district",
                  event.target.value,
                )
              }
            />
          </label>
        </div>

        <label className="form-field">
          <span>Address</span>
          <textarea
            value={form.address}
            onChange={(event) =>
              updateField(
                "address",
                event.target.value,
              )
            }
            rows={3}
          />
        </label>

        <div className="form-grid">
          <label className="form-field">
            <span>Start Date</span>
            <input
              type="date"
              value={form.start_date}
              onChange={(event) =>
                updateField(
                  "start_date",
                  event.target.value,
                )
              }
            />
          </label>

          <label className="form-field">
            <span>End Date</span>
            <input
              type="date"
              value={form.end_date}
              onChange={(event) =>
                updateField(
                  "end_date",
                  event.target.value,
                )
              }
            />
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Director</span>
            <select
              value={form.site_director}
              onChange={(event) =>
                updateField(
                  "site_director",
                  event.target.value,
                )
              }
            >
              <option value="">
                Select director
              </option>
              {directorUsers.map((user) => (
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
            <span>Project Manager</span>
            <select
              value={form.site_hod}
              onChange={(event) =>
                updateField(
                  "site_hod",
                  event.target.value,
                )
              }
            >
              <option value="">
                Select project manager
              </option>
              {pmUsers.map((user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Cost Centre</span>
            <input
              value={form.cost_centre}
              onChange={(event) =>
                updateField(
                  "cost_centre",
                  event.target.value,
                )
              }
            />
          </label>

          <label className="form-field">
            <span>ERP Site Code</span>
            <input
              value={form.erp_site_code}
              onChange={(event) =>
                updateField(
                  "erp_site_code",
                  event.target.value,
                )
              }
            />
          </label>
        </div>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) =>
              updateField(
                "is_active",
                event.target.checked,
              )
            }
          />
          <span>Active site</span>
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
              : "Save Site"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SiteDetailsDrawer({
  site,
  onClose,
}) {
  if (!site) {
    return null;
  }

  const rows = [
    ["Company", site.company_name],
    ["Project", site.project_name],
    ["State", site.state],
    ["District", site.district],
    ["Address", site.address],
    ["Start Date", site.start_date],
    ["End Date", site.end_date],
    ["Cost Centre", site.cost_centre],
    ["ERP Site Code", site.erp_site_code],
    [
      "Site Director",
      site.site_director_detail?.full_name,
    ],
    [
      "Project Manager",
      site.site_hod_detail?.full_name,
    ],
  ];

  return (
    <aside className="details-drawer">
      <div className="details-drawer__header">
        <div>
          <span className="page-eyebrow">
            Site Details
          </span>
          <h2>{site.site_name}</h2>
          <p>{site.site_code}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={18} />
        </button>
      </div>

      <StatusChip active={site.is_active} />

      <dl className="details-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "-"}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function SiteImportPanel({ onClose }) {
  const [selectedFile, setSelectedFile] =
    useState(null);
  const [previewResult, setPreviewResult] =
    useState(null);
  const [importResult, setImportResult] =
    useState(null);
  const downloadTemplate =
    useDownloadSiteTemplate();
  const previewImport =
    usePreviewSiteImport();
  const importSites = useImportSites();
  const exportFailedRows =
    useExportSiteFailedRows();

  const failedRows =
    importResult?.failed_rows ??
    previewResult?.failed_rows ??
    [];
  const summary =
    importResult?.summary ??
    previewResult?.summary ??
    {};
  const error =
    downloadTemplate.error ??
    previewImport.error ??
    importSites.error ??
    exportFailedRows.error;

  const handleTemplateDownload = async (format) => {
    const blob =
      await downloadTemplate.mutateAsync(format);
    downloadBlob(
      `site-import-template.${format}`,
      blob,
    );
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      return;
    }

    setImportResult(null);
    const result =
      await previewImport.mutateAsync(selectedFile);
    setPreviewResult(result);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      return;
    }

    const result =
      await importSites.mutateAsync(selectedFile);
    setImportResult(result);
  };

  const handleFailedRowsDownload = async () => {
    const blob =
      await exportFailedRows.mutateAsync(
        failedRows,
      );
    downloadBlob(
      "site-import-failed-rows.csv",
      blob,
    );
  };

  return (
    <aside className="management-panel">
      <div className="management-panel__header">
        <div>
          <span className="page-eyebrow">
            Bulk Import
          </span>
          <h2>Import Sites</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close site import"
        >
          <X size={18} />
        </button>
      </div>

      {error ? (
        <div className="inline-alert inline-alert--error">
          <strong>{error.message}</strong>
        </div>
      ) : null}

      {importResult ? (
        <div className="inline-alert inline-alert--success">
          <ClipboardCheck size={18} />
          <div>
            <strong>
              Import completed.
            </strong>
            <p>
              Created rows:{" "}
              {summary.created_rows ?? 0}
            </p>
          </div>
        </div>
      ) : null}

      <section className="employee-form-section">
        <h3>Template</h3>
        <div className="import-template-actions">
          <button
            type="button"
            className="button button--secondary"
            disabled={downloadTemplate.isPending}
            onClick={() =>
              handleTemplateDownload("csv")
            }
          >
            <FileDown size={16} />
            CSV Template
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={downloadTemplate.isPending}
            onClick={() =>
              handleTemplateDownload("xlsx")
            }
          >
            <FileSpreadsheet size={16} />
            Excel Template
          </button>
        </div>
      </section>

      <section className="employee-form-section">
        <h3>Upload</h3>
        <label className="file-upload-control">
          <Upload size={18} />
          <span>
            {selectedFile
              ? selectedFile.name
              : "Select CSV or Excel file"}
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xlsm"
            onChange={(event) => {
              setSelectedFile(
                event.target.files?.[0] ?? null,
              );
              setPreviewResult(null);
              setImportResult(null);
            }}
          />
        </label>
        <div className="management-panel__inline-actions">
          <button
            type="button"
            className="button button--secondary"
            disabled={
              !selectedFile ||
              previewImport.isPending
            }
            onClick={handlePreview}
          >
            Preview Validation
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={
              !selectedFile ||
              !previewResult ||
              previewImport.isPending ||
              importSites.isPending
            }
            onClick={handleImport}
          >
            Confirm Import
          </button>
        </div>
      </section>

      {previewResult || importResult ? (
        <section className="employee-form-section">
          <h3>Summary</h3>
          <div className="import-summary-grid">
            <div>
              <span>Total Rows</span>
              <strong>
                {summary.total_rows ?? 0}
              </strong>
            </div>
            <div>
              <span>Valid Rows</span>
              <strong>
                {summary.valid_rows ?? "-"}
              </strong>
            </div>
            <div>
              <span>Created Rows</span>
              <strong>
                {summary.created_rows ?? "-"}
              </strong>
            </div>
            <div>
              <span>Failed Rows</span>
              <strong>
                {summary.failed_rows ?? 0}
              </strong>
            </div>
          </div>
        </section>
      ) : null}

      {failedRows.length ? (
        <section className="employee-form-section">
          <div className="employee-details-section__header">
            <h3>Validation Errors</h3>
            <button
              type="button"
              className="button button--secondary"
              disabled={
                exportFailedRows.isPending
              }
              onClick={handleFailedRowsDownload}
            >
              <Download size={16} />
              Failed Rows
            </button>
          </div>
          <div className="failed-rows-list">
            {failedRows.map((failedRow) => (
              <div
                key={`${failedRow.row_number}-${failedRow.errors?.join("|")}`}
              >
                <strong>
                  Row {failedRow.row_number}
                </strong>
                <span>
                  {failedRow.errors?.join("; ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

export function SiteManagementPage() {
  const [filters, setFilters] = useState({
    search: "",
    company: "",
    state: "",
    is_active: "",
    ordering: "site_name",
    page: 1,
  });
  const [editingSite, setEditingSite] =
    useState(null);
  const [detailsSite, setDetailsSite] =
    useState(null);
  const [isFormOpen, setIsFormOpen] =
    useState(false);
  const [isImportOpen, setIsImportOpen] =
    useState(false);

  const queryParams = useMemo(
    () => buildParams(filters),
    [filters],
  );

  const exportParams = useMemo(
    () =>
      buildParams({
        search: filters.search,
        company: filters.company,
        state: filters.state,
        is_active: filters.is_active,
        ordering: filters.ordering,
      }),
    [filters],
  );

  const sitesQuery = useSites(queryParams);
  const companiesQuery =
    useCompaniesDropdown();
  const directorRoleUsersQuery = useUsersDropdown({
    role: USER_ROLES.DIRECTOR,
  });
  const directorDesignationUsersQuery =
    useUsersDropdown({
    designation: "director",
  });
  const pmUsersQuery = useUsersDropdown();
  const exportQuery =
    useSiteExport(exportParams);
  const createSite = useCreateSite();
  const updateSite = useUpdateSite();
  const activateSite = useActivateSite();
  const deactivateSite =
    useDeactivateSite();

  const sites = sitesQuery.data?.items ?? [];
  const pagination =
    sitesQuery.data?.meta?.pagination;
  const directorUsers = useMemo(
    () =>
      mergeUsers(
        directorRoleUsersQuery.data ?? [],
        directorDesignationUsersQuery.data ??
          [],
      ),
    [
      directorRoleUsersQuery.data,
      directorDesignationUsersQuery.data,
    ],
  );

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const openCreateForm = () => {
    setEditingSite(null);
    setIsFormOpen(true);
  };

  const openEditForm = (site) => {
    setEditingSite(site);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setEditingSite(null);
    setIsFormOpen(false);
  };

  const handleSubmit = async (payload) => {
    if (editingSite) {
      await updateSite.mutateAsync({
        id: editingSite.id,
        payload,
      });
    } else {
      await createSite.mutateAsync(payload);
    }

    closeForm();
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    downloadCsv(
      "organization-sites.csv",
      result.data ?? [],
    );
  };

  const formError =
    createSite.error ?? updateSite.error;

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Organization Masters
          </span>
          <h1>Site Management</h1>
          <p>
            Maintain project sites, location
            details and active status.
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
            onClick={() => setIsImportOpen(true)}
          >
            <Upload size={17} />
            Import
          </button>
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
            onClick={openCreateForm}
          >
            <Plus size={17} />
            Add Site
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
              placeholder="Search sites"
            />
          </label>

          <label className="filter-control">
            <Filter size={16} />
            <select
              value={filters.company}
              onChange={(event) =>
                setFilter(
                  "company",
                  event.target.value,
                )
              }
            >
              <option value="">All companies</option>
              {(companiesQuery.data ?? []).map(
                (company) => (
                  <option
                    key={company.id}
                    value={company.id}
                  >
                    {company.code}
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
              <option value="site_name">
                Site name
              </option>
              <option value="site_code">
                Site code
              </option>
              <option value="state">State</option>
              <option value="-updated_at">
                Recently updated
              </option>
            </select>
          </label>
        </div>

        {sitesQuery.isLoading ? (
          <AppLoader label="Loading sites..." />
        ) : sitesQuery.isError ? (
          <ErrorState
            title="Sites unavailable"
            message={sitesQuery.error?.message}
            onRetry={sitesQuery.refetch}
          />
        ) : !sites.length ? (
          <EmptyState
            title="No sites found"
            message="Adjust filters or add a site."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Site</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>ERP</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.id}>
                    <td>{site.site_code}</td>
                    <td>
                      <strong>
                        {site.site_name}
                      </strong>
                      <span className="table-subtext">
                        {site.project_name || "-"}
                      </span>
                    </td>
                    <td>
                      {site.company_code || "-"}
                    </td>
                    <td>
                      {[site.district, site.state]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </td>
                    <td>
                      <StatusChip
                        active={site.is_active}
                      />
                    </td>
                    <td>
                      {site.erp_site_code || "-"}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            setDetailsSite(site)
                          }
                          aria-label="View site details"
                          title="View details"
                        >
                          <Eye size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            openEditForm(site)
                          }
                          aria-label="Edit site"
                          title="Edit site"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            site.is_active
                              ? deactivateSite.mutate(
                                  site.id,
                                )
                              : activateSite.mutate(
                                  site.id,
                                )
                          }
                          aria-label={
                            site.is_active
                              ? "Deactivate site"
                              : "Activate site"
                          }
                          title={
                            site.is_active
                              ? "Deactivate"
                              : "Activate"
                          }
                        >
                          <Power size={17} />
                        </button>
                        {site.is_active ? (
                          <button
                            type="button"
                            className="button button--tertiary employee-table-action"
                            onClick={() =>
                              deactivateSite.mutate(
                                site.id,
                              )
                            }
                            aria-label="Delete site without removing database record"
                            title="Delete from active list"
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        ) : null}
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
        <SiteFormPanel
          companies={
            companiesQuery.data ?? []
          }
          directorUsers={
            directorUsers
          }
          initialSite={editingSite}
          isSubmitting={
            createSite.isPending ||
            updateSite.isPending
          }
          error={formError}
          onClose={closeForm}
          onSubmit={handleSubmit}
          pmUsers={pmUsersQuery.data ?? []}
        />
      ) : null}

      <SiteDetailsDrawer
        site={detailsSite}
        onClose={() => setDetailsSite(null)}
      />

      {isImportOpen ? (
        <SiteImportPanel
          onClose={() => setIsImportOpen(false)}
        />
      ) : null}
    </div>
  );
}
