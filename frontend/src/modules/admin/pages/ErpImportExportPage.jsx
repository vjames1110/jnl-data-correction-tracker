import { useMemo, useRef, useState } from "react";
import {
  Download,
  FileDown,
  FileUp,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";

import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { USER_ROLES } from "../../../constants/roles";
import {
  useDepartmentsDropdown,
  useSitesDropdown,
  useUsersDropdown,
} from "../../../hooks/useOrganization";
import {
  useErpModuleExport,
  useErpModulesDropdown,
  useErpPrioritiesDropdown,
  useErpPriorityExport,
  useErpReasonCategoriesDropdown,
  useErpReasonCategoryExport,
  useErpRequestFieldConfigurationExport,
  useErpResponsiblePersonMappingExport,
  useErpVoucherTypeExport,
  useErpVoucherTypesDropdown,
  useErpWorkTypeExport,
  useErpWorkTypesDropdown,
  useImportErpMasters,
} from "../../../hooks/useErp";
import { downloadCsv } from "../utils/organizationUtils";

const RESOURCE_CONFIGS = {
  modules: {
    label: "ERP Modules",
    filename: "erp-modules.csv",
    columns: [
      "module_name",
      "description",
      "display_order",
      "is_active",
    ],
  },
  voucher_types: {
    label: "Voucher Types",
    filename: "erp-voucher-types.csv",
    columns: [
      "voucher_name",
      "erp_module_code",
      "department_code",
      "requires_voucher_number",
      "requires_voucher_date",
      "requires_amount",
      "requires_quantity",
      "is_active",
    ],
  },
  work_types: {
    label: "Work Types",
    filename: "erp-work-types.csv",
    columns: [
      "work_type_name",
      "description",
      "requires_approval",
      "is_active",
    ],
  },
  reason_categories: {
    label: "Reason Categories",
    filename: "erp-reason-categories.csv",
    columns: [
      "reason_name",
      "description",
      "display_order",
      "is_active",
    ],
  },
  priorities: {
    label: "Priorities",
    filename: "erp-priorities.csv",
    columns: [
      "priority_name",
      "sla_duration_hours",
      "escalation_duration_hours",
      "display_order",
      "is_active",
    ],
  },
  responsible_mappings: {
    label: "Responsible Mappings",
    filename: "erp-responsible-mappings.csv",
    columns: [
      "erp_module_code",
      "responsible_employee_id",
      "voucher_code",
      "department_code",
      "site_code",
      "work_type_code",
      "priority_code",
      "display_order",
      "is_active",
    ],
  },
  field_configurations: {
    label: "Field Configurations",
    filename: "erp-field-configurations.csv",
    columns: [
      "field_label",
      "field_state",
      "erp_module_code",
      "voucher_code",
      "work_type_code",
      "priority_code",
      "help_text",
      "display_order",
      "is_active",
    ],
  },
};

const RESOURCE_OPTIONS = Object.entries(
  RESOURCE_CONFIGS,
).map(([value, config]) => ({
  value,
  label: config.label,
}));

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(
        new Error("Unable to read selected file."),
      );
    reader.readAsText(file);
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !inQuotes
    ) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value.trim());
      if (
        row.some((cell) => cell !== "")
      ) {
        rows.push(row);
      }
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value.trim());
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) =>
    header.trim(),
  );

  return rows.slice(1).map((cells) =>
    Object.fromEntries(
      headers.map((header, index) => [
        header,
        cells[index] ?? "",
      ]),
    ),
  );
}

function toBoolean(value, fallback = false) {
  if (value === "" || value === undefined) {
    return fallback;
  }

  return ["true", "yes", "1", "active"].includes(
    String(value).trim().toLowerCase(),
  );
}

function toNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue)
    ? numberValue
    : fallback;
}

function findByCode(items, code) {
  if (!code) {
    return "";
  }

  const normalizedCode = String(code)
    .trim()
    .toLowerCase();

  return (
    items.find(
      (item) =>
        String(item.id).toLowerCase() ===
          normalizedCode ||
        String(item.code || "")
          .trim()
          .toLowerCase() === normalizedCode ||
        String(item.employee_id || "")
          .trim()
          .toLowerCase() === normalizedCode,
    )?.id || ""
  );
}

function compactPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) =>
        value !== "" &&
        value !== null &&
        value !== undefined,
    ),
  );
}

function normalizeRows(resource, rows, lookups) {
  return rows.map((row) => {
    if (resource === "modules") {
      return compactPayload({
        module_name: row.module_name,
        description: row.description,
        display_order: toNumber(
          row.display_order,
        ),
        is_active: toBoolean(
          row.is_active,
          true,
        ),
      });
    }

    if (resource === "voucher_types") {
      return compactPayload({
        voucher_name: row.voucher_name,
        erp_module: findByCode(
          lookups.modules,
          row.erp_module_code ||
            row.erp_module,
        ),
        department: findByCode(
          lookups.departments,
          row.department_code ||
            row.department,
        ),
        requires_voucher_number: toBoolean(
          row.requires_voucher_number,
          true,
        ),
        requires_voucher_date: toBoolean(
          row.requires_voucher_date,
          true,
        ),
        requires_amount: toBoolean(
          row.requires_amount,
        ),
        requires_quantity: toBoolean(
          row.requires_quantity,
        ),
        is_active: toBoolean(
          row.is_active,
          true,
        ),
      });
    }

    if (resource === "work_types") {
      return compactPayload({
        work_type_name: row.work_type_name,
        description: row.description,
        requires_approval: toBoolean(
          row.requires_approval,
          true,
        ),
        is_active: toBoolean(
          row.is_active,
          true,
        ),
      });
    }

    if (resource === "reason_categories") {
      return compactPayload({
        reason_name: row.reason_name,
        description: row.description,
        display_order: toNumber(
          row.display_order,
        ),
        is_active: toBoolean(
          row.is_active,
          true,
        ),
      });
    }

    if (resource === "priorities") {
      return compactPayload({
        priority_name: row.priority_name,
        sla_duration_hours: toNumber(
          row.sla_duration_hours,
          24,
        ),
        escalation_duration_hours: toNumber(
          row.escalation_duration_hours,
          12,
        ),
        display_order: toNumber(
          row.display_order,
        ),
        is_active: toBoolean(
          row.is_active,
          true,
        ),
      });
    }

    if (resource === "responsible_mappings") {
      return compactPayload({
        erp_module: findByCode(
          lookups.modules,
          row.erp_module_code ||
            row.erp_module,
        ),
        voucher_type: findByCode(
          lookups.voucherTypes,
          row.voucher_code ||
            row.voucher_type,
        ),
        department: findByCode(
          lookups.departments,
          row.department_code ||
            row.department,
        ),
        site: findByCode(
          lookups.sites,
          row.site_code || row.site,
        ),
        work_type: findByCode(
          lookups.workTypes,
          row.work_type_code ||
            row.work_type,
        ),
        priority: findByCode(
          lookups.priorities,
          row.priority_code ||
            row.priority,
        ),
        responsible_person: findByCode(
          lookups.responsiblePeople,
          row.responsible_employee_id ||
            row.responsible_person,
        ),
        display_order: toNumber(
          row.display_order,
        ),
        is_active: toBoolean(
          row.is_active,
          true,
        ),
      });
    }

    return compactPayload({
      field_label: row.field_label,
      field_state:
        row.field_state || "OPTIONAL",
      erp_module: findByCode(
        lookups.modules,
        row.erp_module_code ||
          row.erp_module,
      ),
      voucher_type: findByCode(
        lookups.voucherTypes,
        row.voucher_code || row.voucher_type,
      ),
      work_type: findByCode(
        lookups.workTypes,
        row.work_type_code || row.work_type,
      ),
      priority: findByCode(
        lookups.priorities,
        row.priority_code || row.priority,
      ),
      help_text: row.help_text,
      display_order: toNumber(
        row.display_order,
      ),
      is_active: toBoolean(
        row.is_active,
        true,
      ),
    });
  });
}

export function ErpImportExportPage() {
  const fileInputRef = useRef(null);
  const [resource, setResource] =
    useState("modules");
  const [fileName, setFileName] = useState("");
  const [importResults, setImportResults] =
    useState([]);
  const [importError, setImportError] =
    useState("");

  const modulesQuery =
    useErpModulesDropdown();
  const voucherTypesQuery =
    useErpVoucherTypesDropdown();
  const workTypesQuery =
    useErpWorkTypesDropdown();
  const reasonCategoriesQuery =
    useErpReasonCategoriesDropdown();
  const prioritiesQuery =
    useErpPrioritiesDropdown();
  const sitesQuery = useSitesDropdown();
  const departmentsQuery =
    useDepartmentsDropdown();
  const responsiblePeopleQuery =
    useUsersDropdown({
      role: USER_ROLES.RESPONSIBLE_PERSON,
    });

  const moduleExport =
    useErpModuleExport({});
  const voucherTypeExport =
    useErpVoucherTypeExport({});
  const workTypeExport =
    useErpWorkTypeExport({});
  const reasonCategoryExport =
    useErpReasonCategoryExport({});
  const priorityExport =
    useErpPriorityExport({});
  const mappingExport =
    useErpResponsiblePersonMappingExport({});
  const fieldExport =
    useErpRequestFieldConfigurationExport({});
  const importMasters = useImportErpMasters();

  const exportQueries = useMemo(
    () => ({
      modules: moduleExport,
      voucher_types: voucherTypeExport,
      work_types: workTypeExport,
      reason_categories: reasonCategoryExport,
      priorities: priorityExport,
      responsible_mappings: mappingExport,
      field_configurations: fieldExport,
    }),
    [
      fieldExport,
      mappingExport,
      moduleExport,
      priorityExport,
      reasonCategoryExport,
      voucherTypeExport,
      workTypeExport,
    ],
  );

  const lookups = useMemo(
    () => ({
      modules: modulesQuery.data ?? [],
      voucherTypes:
        voucherTypesQuery.data ?? [],
      workTypes: workTypesQuery.data ?? [],
      reasonCategories:
        reasonCategoriesQuery.data ?? [],
      priorities: prioritiesQuery.data ?? [],
      sites: sitesQuery.data ?? [],
      departments: departmentsQuery.data ?? [],
      responsiblePeople:
        responsiblePeopleQuery.data ?? [],
    }),
    [
      departmentsQuery.data,
      modulesQuery.data,
      prioritiesQuery.data,
      reasonCategoriesQuery.data,
      responsiblePeopleQuery.data,
      sitesQuery.data,
      voucherTypesQuery.data,
      workTypesQuery.data,
    ],
  );

  const config = RESOURCE_CONFIGS[resource];
  const createdCount = importResults.filter(
    (result) => result.status === "created",
  ).length;
  const failedCount =
    importResults.length - createdCount;

  const handleDownloadTemplate = () => {
    downloadCsv(
      `template-${config.filename}`,
      [],
      config.columns.map((column) => ({
        key: column,
        label: column,
      })),
    );
  };

  const handleExportSelected = async () => {
    const result =
      await exportQueries[resource].refetch();
    const rows = result.data ?? [];
    const columns =
      rows.length > 0
        ? Object.keys(rows[0])
        : config.columns;

    downloadCsv(
      config.filename,
      rows,
      columns.map((column) => ({
        key: column,
        label: column,
      })),
    );
  };

  const handleExportAll = async () => {
    for (const option of RESOURCE_OPTIONS) {
      const resourceConfig =
        RESOURCE_CONFIGS[option.value];
      const result =
        await exportQueries[
          option.value
        ].refetch();
      const rows = result.data ?? [];
      const columns =
        rows.length > 0
          ? Object.keys(rows[0])
          : resourceConfig.columns;

      downloadCsv(
        resourceConfig.filename,
        rows,
        columns.map((column) => ({
          key: column,
          label: column,
        })),
      );
    }
  };

  const handleImport = async () => {
    const file =
      fileInputRef.current?.files?.[0];
    if (!file) {
      setImportError("Select a CSV file first.");
      return;
    }

    try {
      setImportError("");
      setImportResults([]);
      const text = await readTextFile(file);
      const parsedRows = parseCsv(text);
      const rows = normalizeRows(
        resource,
        parsedRows,
        lookups,
      );

      if (!rows.length) {
        setImportError(
          "The CSV file does not contain any data rows.",
        );
        return;
      }

      const results =
        await importMasters.mutateAsync({
          resource,
          rows,
        });
      setImportResults(results);
    } catch (error) {
      setImportError(error.message);
    }
  };

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            ERP Masters
          </span>
          <h1>Import and Export</h1>
          <p>
            Move ERP master configuration by CSV
            templates and exports.
          </p>
        </div>

        <Link
          className="button button--tertiary"
          to="/admin/vouchers"
        >
          Overview
        </Link>
      </div>

      <section className="organization-grid">
        <SurfaceCard title="Export">
          <div className="site-form">
            <label className="form-field">
              <span>Master Resource</span>
              <select
                value={resource}
                onChange={(event) => {
                  setResource(
                    event.target.value,
                  );
                  setImportResults([]);
                  setImportError("");
                  setFileName("");
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                {RESOURCE_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="page-actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={handleDownloadTemplate}
              >
                <FileDown size={17} />
                Template
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={handleExportSelected}
                disabled={
                  exportQueries[resource].isFetching
                }
              >
                <Download size={17} />
                Export Selected
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={handleExportAll}
              >
                <Download size={17} />
                Export All
              </button>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Import">
          <div className="site-form">
            <label className="form-field">
              <span>CSV File</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) =>
                  setFileName(
                    event.target.files?.[0]
                      ?.name || "",
                  )
                }
              />
            </label>

            <div className="page-actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                <FileUp size={17} />
                Choose CSV
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={handleImport}
                disabled={importMasters.isPending}
              >
                <Upload size={17} />
                {importMasters.isPending
                  ? "Importing..."
                  : "Import Rows"}
              </button>
            </div>

            {fileName ? (
              <p className="table-subtext">
                Selected: {fileName}
              </p>
            ) : null}
            {importError ? (
              <div className="inline-alert inline-alert--error">
                <strong>{importError}</strong>
              </div>
            ) : null}
          </div>
        </SurfaceCard>
      </section>

      <SurfaceCard title="Template Columns">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Selected Resource</th>
                <th>Columns</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{config.label}</td>
                <td>
                  {config.columns.join(", ")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {importResults.length ? (
        <SurfaceCard title="Import Result">
          <div className="site-toolbar">
            <span>
              Created {createdCount} /{" "}
              {importResults.length}
            </span>
            <span>Failed {failedCount}</span>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Row</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {importResults.map(
                  (result, index) => (
                    <tr
                      key={`${result.status}-${index}`}
                    >
                      <td>{result.status}</td>
                      <td>
                        {JSON.stringify(
                          result.row,
                        )}
                      </td>
                      <td>{result.error || "-"}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
