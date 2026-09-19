import {
  Download,
  FileDown,
  Pencil,
  Plus,
  Power,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useCreateRdsoSpanLibraryEntry,
  useDeleteRdsoSpanLibraryEntry,
  useRdsoSpanLibrary,
  useUpdateRdsoSpanLibraryEntry,
} from "../../../hooks/useProjectMonitor";
import { ImportResultsPanel } from "../components/ImportResultsPanel";
import {
  ManagementPanel,
  StatusChip,
} from "../components/OrganizationControls";
import {
  parseCsv,
  readTextFile,
  toBoolean,
  toNumber,
} from "../utils/csvImport";
import { downloadCsv } from "../utils/organizationUtils";

const CSV_COLUMNS = [
  { key: "span_length_m", label: "Span Length (m)" },
  { key: "girder_type", label: "Girder Type" },
  { key: "drawing_no", label: "Drawing No" },
  {
    key: "qty_per_span_mt",
    label: "Qty Per Span (MT)",
  },
  { key: "display_order", label: "Display Order" },
  { key: "is_active", label: "Active" },
];

const SAMPLE_ROW = {
  span_length_m: "12.2",
  girder_type: "Steel plate girder",
  drawing_no: "RDSO/B-1234",
  qty_per_span_mt: "18.5",
  display_order: "1",
  is_active: "true",
};

const BLANK_FORM = {
  span_length_m: "",
  girder_type: "",
  drawing_no: "",
  qty_per_span_mt: "0",
  display_order: "0",
  is_active: true,
};

function extractErrorMessage(error) {
  const errors = error?.response?.data?.errors;
  if (!errors) {
    return error?.message || "Something went wrong.";
  }
  return Object.values(errors)
    .flat()
    .map(String)
    .join(" ");
}

function normalizeImportRow(row) {
  return {
    span_length_m: String(
      row["Span Length (m)"] ?? "",
    ).trim(),
    girder_type: String(
      row["Girder Type"] ?? "",
    ).trim(),
    drawing_no: String(
      row["Drawing No"] ?? "",
    ).trim(),
    qty_per_span_mt: String(
      toNumber(row["Qty Per Span (MT)"], 0),
    ),
    display_order: Number(
      toNumber(row["Display Order"], 0),
    ),
    is_active: toBoolean(row.Active, true),
  };
}

function sameSpan(entry, row) {
  return (
    Number(entry.span_length_m) ===
      Number(row.span_length_m) &&
    entry.girder_type.trim().toLowerCase() ===
      row.girder_type.toLowerCase()
  );
}

function SpanEntryForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
  error,
}) {
  const [form, setForm] = useState(
    initial || BLANK_FORM,
  );

  const setField = (key, value) =>
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      span_length_m: form.span_length_m,
      girder_type: form.girder_type,
      drawing_no: form.drawing_no,
      qty_per_span_mt: form.qty_per_span_mt || "0",
      display_order: Number(form.display_order) || 0,
      is_active: form.is_active,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="form-field">
          <span>Span length (m)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.span_length_m}
            onChange={(event) =>
              setField(
                "span_length_m",
                event.target.value,
              )
            }
            required
          />
        </label>
        <label className="form-field">
          <span>Girder type</span>
          <input
            type="text"
            value={form.girder_type}
            onChange={(event) =>
              setField(
                "girder_type",
                event.target.value,
              )
            }
            placeholder="e.g. Steel plate girder"
            required
          />
        </label>
        <label className="form-field">
          <span>Drawing no.</span>
          <input
            type="text"
            value={form.drawing_no}
            onChange={(event) =>
              setField(
                "drawing_no",
                event.target.value,
              )
            }
          />
        </label>
        <label className="form-field">
          <span>Qty per span (MT)</span>
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.qty_per_span_mt}
            onChange={(event) =>
              setField(
                "qty_per_span_mt",
                event.target.value,
              )
            }
          />
        </label>
        <label className="form-field">
          <span>Display order</span>
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
          Active
        </label>
      </div>

      <div className="management-panel__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={isPending}
        >
          Save
        </button>
        <button
          type="button"
          className="button button--tertiary"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
      {error ? (
        <div className="inline-alert inline-alert--error">
          {error}
        </div>
      ) : null}
    </form>
  );
}

/**
 * Admin master for the RDSO standard-span library that the "Add
 * girder job" span picker offers - list/add/edit/deactivate/delete
 * plus CSV template, import and export (import updates a row that
 * already has the same span length + girder type, otherwise adds it).
 */
export function RdsoSpanLibraryPage() {
  const [isFormOpen, setIsFormOpen] =
    useState(false);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState("");
  const [importError, setImportError] =
    useState("");
  const [importResults, setImportResults] =
    useState([]);
  const [isImporting, setIsImporting] =
    useState(false);
  const fileInputRef = useRef(null);

  const libraryQuery = useRdsoSpanLibrary(true);
  const createEntry = useCreateRdsoSpanLibraryEntry();
  const updateEntry = useUpdateRdsoSpanLibraryEntry();
  const deleteEntry = useDeleteRdsoSpanLibraryEntry();

  const entries = libraryQuery.data || [];

  const closeForm = () => {
    setIsFormOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (payload) => {
    setFormError("");
    try {
      if (editing) {
        await updateEntry.mutateAsync({
          entryId: editing.id,
          payload,
        });
      } else {
        await createEntry.mutateAsync(payload);
      }
      closeForm();
    } catch (error) {
      setFormError(extractErrorMessage(error));
    }
  };

  const handleDelete = (entry) => {
    if (
      !window.confirm(
        `Delete the ${entry.span_length_m} m ${entry.girder_type} entry? Existing girder spans keep their own copied values.`,
      )
    ) {
      return;
    }
    deleteEntry.mutate(entry.id);
  };

  const handleExport = () =>
    downloadCsv(
      "rdso-span-library.csv",
      entries,
      CSV_COLUMNS,
    );

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!file) {
      return;
    }

    setImportError("");
    setImportResults([]);
    setIsImporting(true);
    try {
      const rows = parseCsv(
        await readTextFile(file),
      ).map(normalizeImportRow);
      if (!rows.length) {
        setImportError(
          "The CSV file does not contain any data rows.",
        );
        return;
      }

      // Track what the file itself has added so two rows for the
      // same span in one file update rather than duplicate.
      const known = [...entries];
      const results = [];
      for (const row of rows) {
        try {
          if (!row.span_length_m || !row.girder_type) {
            throw new Error(
              "Span length and girder type are required.",
            );
          }
          const match = known.find((entry) =>
            sameSpan(entry, row),
          );
          if (match) {
            const updated =
              await updateEntry.mutateAsync({
                entryId: match.id,
                payload: row,
              });
            known[known.indexOf(match)] = updated;
          } else {
            known.push(
              await createEntry.mutateAsync(row),
            );
          }
          results.push({ status: "created", row });
        } catch (rowError) {
          results.push({
            status: "failed",
            row,
            error: extractErrorMessage(rowError),
          });
        }
      }
      setImportResults(results);
    } catch (readError) {
      setImportError(readError.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>RDSO Span Library</h1>
          <p>
            The standard RDSO girder spans the
            &quot;Add girder job&quot; form offers -
            picking one pre-fills a span&apos;s drawing
            number, length, type and quantity.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() =>
              downloadCsv(
                "template-rdso-span-library.csv",
                [SAMPLE_ROW],
                CSV_COLUMNS,
              )
            }
          >
            <FileDown size={17} />
            Template
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={isImporting}
          >
            <Upload size={17} />
            {isImporting
              ? "Importing..."
              : "Import CSV"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportFile}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="button button--secondary"
            onClick={handleExport}
            disabled={!entries.length}
          >
            <Download size={17} />
            Export
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setEditing(null);
              setFormError("");
              setIsFormOpen(true);
            }}
          >
            <Plus size={16} /> Add span
          </button>
        </div>
      </div>

      <ImportResultsPanel
        error={importError}
        results={importResults}
      />

      {isFormOpen ? (
        <ManagementPanel
          eyebrow="RDSO Span Library"
          title={
            editing
              ? `Edit ${editing.span_length_m} m span`
              : "Add a standard span"
          }
          onClose={closeForm}
          closeOnOutsideClick
        >
          <SpanEntryForm
            initial={
              editing
                ? {
                    span_length_m:
                      editing.span_length_m,
                    girder_type:
                      editing.girder_type,
                    drawing_no: editing.drawing_no,
                    qty_per_span_mt:
                      editing.qty_per_span_mt,
                    display_order:
                      editing.display_order,
                    is_active: editing.is_active,
                  }
                : null
            }
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isPending={
              createEntry.isPending ||
              updateEntry.isPending
            }
            error={formError}
          />
        </ManagementPanel>
      ) : null}

      {libraryQuery.isLoading ? (
        <AppLoader label="Loading span library..." />
      ) : libraryQuery.isError ? (
        <ErrorState
          title="Span library unavailable"
          message={libraryQuery.error?.message}
          onRetry={libraryQuery.refetch}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No standard spans yet"
          message="Add one above, or import a CSV."
        />
      ) : (
        <SurfaceCard>
          <div className="pm-table-wrap">
            <table className="pm-activity-table">
              <thead>
                <tr>
                  <th>Span (m)</th>
                  <th>Girder type</th>
                  <th>Drawing no.</th>
                  <th>Qty / span (MT)</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.span_length_m}</td>
                    <td>{entry.girder_type}</td>
                    <td>{entry.drawing_no || "-"}</td>
                    <td>{entry.qty_per_span_mt}</td>
                    <td>{entry.display_order}</td>
                    <td>
                      <StatusChip
                        active={entry.is_active}
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditing(entry);
                            setFormError("");
                            setIsFormOpen(true);
                          }}
                          aria-label="Edit span"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            updateEntry.mutate({
                              entryId: entry.id,
                              payload: {
                                is_active:
                                  !entry.is_active,
                              },
                            })
                          }
                          aria-label={
                            entry.is_active
                              ? "Deactivate"
                              : "Activate"
                          }
                          title={
                            entry.is_active
                              ? "Deactivate"
                              : "Activate"
                          }
                        >
                          <Power size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button--danger"
                          onClick={() =>
                            handleDelete(entry)
                          }
                          aria-label="Delete span"
                          title="Delete permanently"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
