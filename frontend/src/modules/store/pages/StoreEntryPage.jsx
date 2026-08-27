import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Plus,
  Printer,
  Trash2,
  Upload,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { OfflineQueueBanner } from "../../../components/common/OfflineQueueBanner";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  isStoreRole,
  USER_ROLES,
} from "../../../constants/roles";
import { useAuth } from "../../../hooks/useAuth";
import { useOfflineQueue } from "../../../hooks/useOfflineQueue";
import { useSitesDropdown } from "../../../hooks/useOrganization";
import {
  useCreateReconciliationAttachment,
  useCreateReconciliationEntry,
  useCreateReconciliationOutputEntry,
  useDeleteReconciliationAttachment,
  useDeleteReconciliationOutputEntry,
  useReconciliationAttachments,
  useReconciliationCurrentPeriod,
  useReconciliationEntries,
  useReconciliationItems,
  useReconciliationOutputEntries,
  useReopenReconciliationPeriod,
  useSubmitReconciliationPeriod,
  useUpdateReconciliationEntry,
  useUpdateReconciliationPeriod,
} from "../../../hooks/useReconciliation";
import { offlineOutbox } from "../../../services/offlineOutbox";
import { isNetworkError } from "../../../services/offlineSync";
import { varianceCellClass } from "../../../utils/formatters";
import { ReconciliationStatementSheet } from "../components/ReconciliationStatementSheet";
import {
  buildStatementCsvRows,
  downloadCsvRows,
} from "../components/statementCsv";

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const char = text[index];
    const next = text[index + 1];

    if (
      char === '"' &&
      inQuotes &&
      next === '"'
    ) {
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
      if (row.some((cell) => cell !== "")) {
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

function VarianceStatusChip({ status }) {
  const tone =
    status === "WITHIN_TOLERANCE"
      ? "status-chip--success"
      : status === "WATCH"
        ? "status-chip--warning"
        : status === "OVER_TOLERANCE"
          ? "status-chip--error"
          : "status-chip--warning";
  const label =
    status === "NOT_CALCULATED"
      ? "Pending"
      : status
          .replaceAll("_", " ")
          .toLowerCase()
          .replace(/^./, (char) =>
            char.toUpperCase(),
          );

  return (
    <span className={`status-chip ${tone}`}>
      {label}
    </span>
  );
}

function EntryRow({
  entry,
  item,
  onSave,
  saving,
  queued,
}) {
  const isNormBased =
    item.reconciliation_type === "NORM_BASED";
  const [form, setForm] = useState(() => ({
    opening_stock:
      entry?.opening_stock ?? "",
    receipts: entry?.receipts ?? "",
    closing_stock: entry?.closing_stock ?? "",
    book_stock: entry?.book_stock ?? "",
    physical_count:
      entry?.physical_count ?? "",
    section: entry?.section ?? "",
    rack: entry?.rack ?? "",
  }));

  const setField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = () => {
    const payload = isNormBased
      ? {
          opening_stock:
            form.opening_stock || null,
          receipts: form.receipts || null,
          closing_stock:
            form.closing_stock || null,
        }
      : {
          book_stock:
            form.book_stock || null,
          physical_count:
            form.physical_count || null,
        };
    payload.section = form.section || "";
    payload.rack = form.rack || "";
    onSave(payload);
  };

  return (
    <tr>
      <td>
        <strong>{item.item_code}</strong>
        <span className="table-subtext">
          {item.item_name}
        </span>
      </td>
      <td>{item.uom}</td>
      <td>
        <input
          type="text"
          value={form.section}
          onChange={(event) =>
            setField(
              "section",
              event.target.value,
            )
          }
          placeholder="Optional"
          className="entry-row-input"
        />
      </td>
      <td>
        <input
          type="text"
          value={form.rack}
          onChange={(event) =>
            setField(
              "rack",
              event.target.value,
            )
          }
          placeholder="Optional"
          className="entry-row-input"
        />
      </td>
      {isNormBased ? (
        <>
          <td>
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.opening_stock}
              onChange={(event) =>
                setField(
                  "opening_stock",
                  event.target.value,
                )
              }
              className="entry-row-input"
            />
          </td>
          <td>
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.receipts}
              onChange={(event) =>
                setField(
                  "receipts",
                  event.target.value,
                )
              }
              className="entry-row-input"
            />
          </td>
          <td>
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.closing_stock}
              onChange={(event) =>
                setField(
                  "closing_stock",
                  event.target.value,
                )
              }
              className="entry-row-input"
            />
          </td>
        </>
      ) : (
        <>
          <td>
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.book_stock}
              onChange={(event) =>
                setField(
                  "book_stock",
                  event.target.value,
                )
              }
              className="entry-row-input"
            />
          </td>
          <td>
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.physical_count}
              onChange={(event) =>
                setField(
                  "physical_count",
                  event.target.value,
                )
              }
              className="entry-row-input"
            />
          </td>
          <td className="table-subtext">
            n/a
          </td>
        </>
      )}
      <td>
        {entry?.actual_quantity ?? "-"}
      </td>
      <td>
        {entry?.theoretical_or_book_quantity ??
          "-"}
      </td>
      <td
        className={varianceCellClass(
          entry?.variance_quantity,
        )}
      >
        {entry?.variance_quantity ?? "-"}
      </td>
      <td>
        {queued ? (
          <span
            className="status-chip status-chip--warning"
            title="Saved on this device, waiting to sync"
          >
            Queued
          </span>
        ) : (
          <VarianceStatusChip
            status={entry?.status ?? "NOT_CALCULATED"}
          />
        )}
        {entry?.flags?.length ? (
          <div className="entry-row-flags">
            {entry.flags.map((flag) => (
              <span
                key={flag.id}
                className="entry-row-flag"
                title={flag.message}
              >
                {flag.flag_type_display}
              </span>
            ))}
          </div>
        ) : null}
      </td>
      <td>
        <button
          type="button"
          className="button button--tertiary"
          onClick={handleSave}
          disabled={saving}
        >
          <CheckCircle2 size={15} />
          Save
        </button>
      </td>
    </tr>
  );
}

const BLANK_ENTRY_FORM = {
  opening_stock: "",
  receipts: "",
  closing_stock: "",
  book_stock: "",
  physical_count: "",
  section: "",
  rack: "",
};

function SavedEntryRow({
  item,
  entry,
  onSave,
  saving,
  queued,
  editable,
}) {
  const [isEditing, setIsEditing] =
    useState(false);

  if (isEditing) {
    return (
      <EntryRow
        item={item}
        entry={entry}
        saving={saving}
        queued={queued}
        onSave={async (payload) => {
          await onSave(payload);
          setIsEditing(false);
        }}
      />
    );
  }

  const isNormBased =
    item.reconciliation_type === "NORM_BASED";

  return (
    <tr>
      <td>
        <strong>{item.item_code}</strong>
        <span className="table-subtext">
          {item.item_name}
        </span>
      </td>
      <td>{item.uom}</td>
      <td>{entry.section || "-"}</td>
      <td>{entry.rack || "-"}</td>
      <td>
        {isNormBased
          ? (entry.opening_stock ?? "-")
          : (entry.book_stock ?? "-")}
      </td>
      <td>
        {isNormBased
          ? (entry.receipts ?? "-")
          : (entry.physical_count ?? "-")}
      </td>
      <td>
        {isNormBased
          ? (entry.closing_stock ?? "-")
          : "n/a"}
      </td>
      <td>{entry.actual_quantity ?? "-"}</td>
      <td>
        {entry.theoretical_or_book_quantity ??
          "-"}
      </td>
      <td
        className={varianceCellClass(
          entry.variance_quantity,
        )}
      >
        {entry.variance_quantity ?? "-"}
      </td>
      <td>
        {queued ? (
          <span
            className="status-chip status-chip--warning"
            title="Saved on this device, waiting to sync"
          >
            Queued
          </span>
        ) : (
          <VarianceStatusChip
            status={
              entry.status ?? "NOT_CALCULATED"
            }
          />
        )}
        {entry.flags?.length ? (
          <div className="entry-row-flags">
            {entry.flags.map((flag) => (
              <span
                key={flag.id}
                className="entry-row-flag"
                title={flag.message}
              >
                {flag.flag_type_display}
              </span>
            ))}
          </div>
        ) : null}
      </td>
      {editable ? (
        <td>
          <button
            type="button"
            className="button button--tertiary"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </button>
        </td>
      ) : null}
    </tr>
  );
}

function AddEntryForm({
  availableItems,
  onSubmit,
  submitting,
}) {
  const [itemId, setItemId] = useState("");
  const [form, setForm] = useState(
    BLANK_ENTRY_FORM,
  );

  const selectedItem = availableItems.find(
    (item) => item.id === itemId,
  );
  const isNormBased =
    selectedItem?.reconciliation_type ===
    "NORM_BASED";

  const setField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedItem) {
      return;
    }
    const payload = isNormBased
      ? {
          opening_stock:
            form.opening_stock || null,
          receipts: form.receipts || null,
          closing_stock:
            form.closing_stock || null,
        }
      : {
          book_stock:
            form.book_stock || null,
          physical_count:
            form.physical_count || null,
        };
    payload.section = form.section || "";
    payload.rack = form.rack || "";
    await onSubmit(selectedItem, payload);
    setItemId("");
    setForm(BLANK_ENTRY_FORM);
  };

  if (!availableItems.length) {
    return (
      <p className="table-subtext">
        Every active item already has an entry
        this period.
      </p>
    );
  }

  return (
    <form
      className="site-toolbar"
      onSubmit={handleSubmit}
    >
      <label className="filter-control">
        <span>Item</span>
        <select
          value={itemId}
          onChange={(event) => {
            setItemId(event.target.value);
            setForm(BLANK_ENTRY_FORM);
          }}
          required
        >
          <option value="" disabled hidden>
            Select item
          </option>
          {availableItems.map((item) => (
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

      {selectedItem ? (
        <>
          <label className="filter-control">
            <span>Section (optional)</span>
            <input
              type="text"
              value={form.section}
              onChange={(event) =>
                setField(
                  "section",
                  event.target.value,
                )
              }
            />
          </label>
          <label className="filter-control">
            <span>Rack (optional)</span>
            <input
              type="text"
              value={form.rack}
              onChange={(event) =>
                setField(
                  "rack",
                  event.target.value,
                )
              }
            />
          </label>
          {isNormBased ? (
            <>
              <label className="filter-control">
                <span>Opening Stock</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.opening_stock}
                  onChange={(event) =>
                    setField(
                      "opening_stock",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label className="filter-control">
                <span>Receipts</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.receipts}
                  onChange={(event) =>
                    setField(
                      "receipts",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label className="filter-control">
                <span>Closing Stock</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.closing_stock}
                  onChange={(event) =>
                    setField(
                      "closing_stock",
                      event.target.value,
                    )
                  }
                />
              </label>
            </>
          ) : (
            <>
              <label className="filter-control">
                <span>Book Stock</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.book_stock}
                  onChange={(event) =>
                    setField(
                      "book_stock",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label className="filter-control">
                <span>Physical Count</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.physical_count}
                  onChange={(event) =>
                    setField(
                      "physical_count",
                      event.target.value,
                    )
                  }
                />
              </label>
            </>
          )}
          <button
            type="submit"
            className="button button--primary"
            disabled={submitting}
          >
            <Plus size={15} />
            Add Entry
          </button>
        </>
      ) : null}
    </form>
  );
}

function ApprovalStatusBanner({ period }) {
  const steps = period.approval_steps ?? [];
  const lastDecidedStep = [...steps]
    .filter((step) => step.decided_at)
    .sort(
      (a, b) =>
        new Date(b.decided_at) -
        new Date(a.decided_at),
    )[0];

  if (period.status === "PENDING_APPROVAL") {
    return (
      <div className="inline-alert inline-alert--warning">
        Awaiting approval —{" "}
        {period.current_approver_role}:{" "}
        <strong>
          {period.current_approver_name}
        </strong>
      </div>
    );
  }

  if (period.status === "APPROVED") {
    return (
      <div className="inline-alert inline-alert--success">
        Approved
        {lastDecidedStep
          ? ` by ${lastDecidedStep.approver_name}`
          : ""}
        . Design mix and rates for this period are
        locked and can no longer be edited.
      </div>
    );
  }

  if (period.status === "REJECTED") {
    return (
      <div className="inline-alert inline-alert--error">
        Rejected
        {lastDecidedStep
          ? ` by ${lastDecidedStep.approver_name}`
          : ""}
        {lastDecidedStep?.comment
          ? `: ${lastDecidedStep.comment}`
          : "."}
      </div>
    );
  }

  if (
    period.status === "DRAFT" &&
    lastDecidedStep?.status === "RETURNED"
  ) {
    return (
      <div className="inline-alert inline-alert--warning">
        Returned for correction by{" "}
        {lastDecidedStep.approver_name}
        {lastDecidedStep.comment
          ? `: ${lastDecidedStep.comment}`
          : "."}{" "}
        Fix the entries below and submit again.
      </div>
    );
  }

  return null;
}

function OutputEntryForm({
  items,
  onSubmit,
  submitting,
}) {
  const [form, setForm] = useState({
    item: "",
    grade_label: "",
    output_quantity: "",
  });

  return (
    <form
      className="site-toolbar"
      onSubmit={(event) => {
        event.preventDefault();
        if (!form.item || !form.output_quantity) {
          return;
        }
        onSubmit(form);
        setForm({
          item: "",
          grade_label: "",
          output_quantity: "",
        });
      }}
    >
      <label className="filter-control">
        <span>Item</span>
        <select
          value={form.item}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              item: event.target.value,
            }))
          }
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
      <label className="filter-control">
        <span>Grade (optional)</span>
        <input
          value={form.grade_label}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              grade_label: event.target.value,
            }))
          }
          placeholder="M20, M25..."
        />
      </label>
      <label className="filter-control">
        <span>Output Quantity</span>
        <input
          type="number"
          step="0.001"
          min="0"
          value={form.output_quantity}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              output_quantity:
                event.target.value,
            }))
          }
          required
        />
      </label>
      <button
        type="submit"
        className="button button--primary"
        disabled={submitting}
      >
        <Plus size={15} />
        Add Output
      </button>
    </form>
  );
}

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) {
    return "";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsCard({
  periodId,
  isEditable,
}) {
  const fileInputRef = useRef(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const attachmentsQuery =
    useReconciliationAttachments(periodId);
  const createAttachment =
    useCreateReconciliationAttachment();
  const deleteAttachment =
    useDeleteReconciliationAttachment();
  const attachments =
    attachmentsQuery.data ?? [];

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!file) {
      return;
    }

    try {
      setError("");
      await createAttachment.mutateAsync({
        period: periodId,
        file,
        notes,
      });
      setNotes("");
    } catch (uploadError) {
      setError(
        uploadError.response?.data?.message ||
          uploadError.message,
      );
    }
  };

  if (
    !isEditable &&
    !attachmentsQuery.isLoading &&
    !attachments.length
  ) {
    return null;
  }

  return (
    <SurfaceCard className="print-hidden">
      <div className="surface-card__header">
        <h2>Attachments</h2>
      </div>
      <div className="surface-card__body">
        <p className="table-subtext">
          Physical stock-count photos, signed
          stock sheets, or other supporting
          evidence for this period. PDF, Excel,
          CSV, or image files, up to 10 MB
          {isEditable
            ? " - available while this period is in Draft."
            : "."}
        </p>

        {isEditable ? (
          <div className="site-toolbar">
            <label className="filter-control">
              <span>Notes (optional)</span>
              <input
                type="text"
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="e.g. July stock count"
              />
            </label>
            <button
              type="button"
              className="button button--secondary"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={
                createAttachment.isPending
              }
            >
              <Upload size={15} />
              {createAttachment.isPending
                ? "Uploading..."
                : "Upload File"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xlsm,.xls,.csv,.jpg,.jpeg,.png,.webp,.gif"
              onChange={handleUpload}
              style={{ display: "none" }}
            />
          </div>
        ) : null}

        {error ? (
          <div className="inline-alert inline-alert--error">
            {error}
          </div>
        ) : null}

        {attachmentsQuery.isLoading ? (
          <p className="table-subtext">
            Loading attachments...
          </p>
        ) : attachments.length ? (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Notes</th>
                  <th>Uploaded By</th>
                  <th>Size</th>
                  {isEditable ? (
                    <th>Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {attachments.map(
                  (attachment) => (
                    <tr key={attachment.id}>
                      <td>
                        <a
                          href={
                            attachment.download_url
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {
                            attachment.original_name
                          }
                        </a>
                      </td>
                      <td>
                        {attachment.notes ||
                          "-"}
                      </td>
                      <td>
                        {
                          attachment.uploaded_by_employee_id
                        }
                      </td>
                      <td>
                        {formatFileSize(
                          attachment.size_bytes,
                        )}
                      </td>
                      {isEditable ? (
                        <td>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() =>
                              deleteAttachment.mutate(
                                attachment.id,
                              )
                            }
                            aria-label="Delete attachment"
                            title="Delete attachment"
                          >
                            <Trash2
                              size={15}
                            />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="table-subtext">
            No attachments uploaded yet.
          </p>
        )}
      </div>
    </SurfaceCard>
  );
}

export function StoreEntryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isStoreHo =
    user?.role === USER_ROLES.STORE_HO;
  const [searchParams] = useSearchParams();
  const [pendingByItemId, setPendingByItemId] =
    useState(new Map());
  const offlineQueue = useOfflineQueue({
    onSynced: () => {
      setPendingByItemId(new Map());
      queryClient.invalidateQueries({
        queryKey: ["reconciliation"],
      });
    },
  });
  const [monthValue, setMonthValue] = useState(
    () =>
      searchParams.get("month") ||
      currentMonthValue(),
  );
  const [selectedSite, setSelectedSite] = useState(
    () => searchParams.get("site") || "",
  );
  const csvInputRef = useRef(null);
  const [csvMessage, setCsvMessage] =
    useState("");

  const sitesQuery = useSitesDropdown();

  const periodParams = useMemo(
    () => ({
      month: `${monthValue}-01`,
      ...(selectedSite
        ? { site: selectedSite }
        : {}),
    }),
    [monthValue, selectedSite],
  );

  const periodQuery = useReconciliationCurrentPeriod(
    selectedSite ? periodParams : null,
  );
  const period = periodQuery.data;

  const itemsQuery = useReconciliationItems({
    page_size: 500,
    is_active: true,
  });
  const entriesQuery = useReconciliationEntries(
    period ? { period: period.id } : undefined,
  );
  const outputEntriesQuery =
    useReconciliationOutputEntries(
      period ? { period: period.id } : undefined,
    );

  const createEntry = useCreateReconciliationEntry();
  const updateEntry = useUpdateReconciliationEntry();
  const createOutputEntry =
    useCreateReconciliationOutputEntry();
  const deleteOutputEntry =
    useDeleteReconciliationOutputEntry();
  const submitPeriod =
    useSubmitReconciliationPeriod();
  const reopenPeriod =
    useReopenReconciliationPeriod();
  const updatePeriod =
    useUpdateReconciliationPeriod();

  const items = useMemo(
    () => itemsQuery.data?.items ?? [],
    [itemsQuery.data],
  );
  const entries = useMemo(
    () => entriesQuery.data ?? [],
    [entriesQuery.data],
  );
  const outputEntries =
    outputEntriesQuery.data ?? [];
  const normBasedItems = items.filter(
    (item) =>
      item.reconciliation_type === "NORM_BASED",
  );

  const entryByItemId = useMemo(() => {
    const map = new Map();
    entries.forEach((entry) => {
      map.set(entry.item, entry);
    });
    return map;
  }, [entries]);

  const itemById = useMemo(
    () =>
      new Map(
        items.map((item) => [item.id, item]),
      ),
    [items],
  );

  const enteredItemIds = useMemo(() => {
    const set = new Set(
      entries.map((entry) => entry.item),
    );
    pendingByItemId.forEach((_, itemId) =>
      set.add(itemId),
    );
    return set;
  }, [entries, pendingByItemId]);

  // Items that don't have an entry yet this period - the pool the
  // "add an item" form picks from, so the same item can't be added
  // twice and the list naturally shrinks as entries are added.
  const itemsAvailableToAdd = useMemo(
    () =>
      items.filter(
        (item) => !enteredItemIds.has(item.id),
      ),
    [items, enteredItemIds],
  );

  // One row per item that actually has an entry (server-saved or
  // still offline-queued) - sourced from the entries themselves
  // (which already carry their own item_code/name/uom) rather than
  // the active items list, so a since-deactivated item's submitted
  // entry still shows up correctly.
  const entriesForDisplay = useMemo(() => {
    const rows = entries.map((serverEntry) => {
      const pending = pendingByItemId.get(
        serverEntry.item,
      );
      const entry = pending
        ? {
            ...serverEntry,
            ...pending.payload,
          }
        : serverEntry;
      const item = itemById.get(
        serverEntry.item,
      ) ?? {
        id: serverEntry.item,
        item_code: serverEntry.item_code,
        item_name: serverEntry.item_name,
        uom: serverEntry.uom,
        reconciliation_type:
          serverEntry.reconciliation_type,
      };
      return {
        item,
        entry,
        queued: Boolean(pending),
      };
    });

    pendingByItemId.forEach(
      (pending, itemId) => {
        if (entryByItemId.has(itemId)) {
          return;
        }
        const item = itemById.get(itemId);
        if (!item) {
          return;
        }
        rows.push({
          item,
          entry: pending.payload,
          queued: true,
        });
      },
    );

    return rows;
  }, [
    entries,
    pendingByItemId,
    itemById,
    entryByItemId,
  ]);

  // Director can open this page (read-only) from the approval
  // inbox's "View Entries" link, but only Store HO/Admin/Super
  // Admin ever prepare a period - editing stays gated on role, not
  // just draft status, so Director never sees controls that the
  // backend would reject anyway.
  const canEditPeriod = isStoreRole(user?.role);
  const isEditable =
    canEditPeriod &&
    (!period || period.status === "DRAFT");

  const queueEntrySave = (item, payload) => {
    const existing = entryByItemId.get(item.id);

    if (existing) {
      const queuedAction = offlineOutbox.enqueue({
        type: "updateEntry",
        entityId: existing.id,
        payload,
        dedupeKey: `update-entry-${existing.id}`,
        label: `${item.item_code} (update)`,
      });
      offlineQueue.refreshQueueCount();
      setPendingByItemId((current) => {
        const next = new Map(current);
        next.set(item.id, {
          payload,
          actionId: queuedAction.id,
          isCreate: false,
        });
        return next;
      });
      return;
    }

    const existingPending = pendingByItemId.get(
      item.id,
    );
    const clientId =
      existingPending?.clientId ??
      offlineOutbox.generateId();
    const queuedAction = offlineOutbox.enqueue({
      type: "createEntry",
      payload: {
        id: clientId,
        period: period.id,
        item: item.id,
        ...payload,
      },
      dedupeKey: `create-entry-${period.id}-${item.id}`,
      label: `${item.item_code} (new)`,
    });
    offlineQueue.refreshQueueCount();
    setPendingByItemId((current) => {
      const next = new Map(current);
      next.set(item.id, {
        payload,
        actionId: queuedAction.id,
        isCreate: true,
        clientId,
      });
      return next;
    });
  };

  const clearPending = (itemId) => {
    setPendingByItemId((current) => {
      if (!current.has(itemId)) {
        return current;
      }
      const next = new Map(current);
      next.delete(itemId);
      return next;
    });
  };

  const handleSaveEntry = async (
    item,
    payload,
  ) => {
    if (!offlineQueue.isOnline) {
      queueEntrySave(item, payload);
      return;
    }

    const existing = entryByItemId.get(item.id);
    try {
      if (existing) {
        await updateEntry.mutateAsync({
          id: existing.id,
          payload,
        });
      } else {
        await createEntry.mutateAsync({
          period: period.id,
          item: item.id,
          ...payload,
        });
      }
      clearPending(item.id);
    } catch (error) {
      if (isNetworkError(error)) {
        queueEntrySave(item, payload);
      } else {
        throw error;
      }
    }
  };

  const handleCreateOutputEntry = async (
    form,
  ) => {
    if (!offlineQueue.isOnline) {
      offlineOutbox.enqueue({
        type: "createOutputEntry",
        payload: {
          id: offlineOutbox.generateId(),
          period: period.id,
          ...form,
        },
        label: "Production output",
      });
      offlineQueue.refreshQueueCount();
      return;
    }

    try {
      await createOutputEntry.mutateAsync({
        period: period.id,
        ...form,
      });
    } catch (error) {
      if (isNetworkError(error)) {
        offlineOutbox.enqueue({
          type: "createOutputEntry",
          payload: {
            id: offlineOutbox.generateId(),
            period: period.id,
            ...form,
          },
          label: "Production output",
        });
        offlineQueue.refreshQueueCount();
      } else {
        throw error;
      }
    }
  };

  const handleDeleteOutputEntry = async (
    outputId,
  ) => {
    if (!offlineQueue.isOnline) {
      offlineOutbox.enqueue({
        type: "deleteOutputEntry",
        entityId: outputId,
        dedupeKey: `delete-output-${outputId}`,
        label: "Delete production output",
      });
      offlineQueue.refreshQueueCount();
      return;
    }

    try {
      await deleteOutputEntry.mutateAsync(
        outputId,
      );
    } catch (error) {
      if (isNetworkError(error)) {
        offlineOutbox.enqueue({
          type: "deleteOutputEntry",
          entityId: outputId,
          dedupeKey: `delete-output-${outputId}`,
          label: "Delete production output",
        });
        offlineQueue.refreshQueueCount();
      } else {
        throw error;
      }
    }
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !period) {
      return;
    }

    if (!offlineQueue.isOnline) {
      setCsvMessage(
        "You're offline — CSV import needs a " +
          "live connection. Try again once " +
          "you're back online.",
      );
      if (csvInputRef.current) {
        csvInputRef.current.value = "";
      }
      return;
    }

    const text = await file.text();
    const rows = parseCsv(text);
    const itemByCode = new Map(
      items.map((item) => [
        item.item_code,
        item,
      ]),
    );

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const item = itemByCode.get(
        row.item_code,
      );
      if (
        !item ||
        item.reconciliation_type !==
          "DIRECT_COUNT" ||
        !row.book_stock
      ) {
        skipped += 1;
        continue;
      }

      const existing = entryByItemId.get(
        item.id,
      );
      if (existing) {
        await updateEntry.mutateAsync({
          id: existing.id,
          payload: {
            book_stock: row.book_stock,
          },
        });
      } else {
        await createEntry.mutateAsync({
          period: period.id,
          item: item.id,
          book_stock: row.book_stock,
        });
      }
      updated += 1;
    }

    setCsvMessage(
      `Updated ${updated} item(s) from book ` +
        `stock file` +
        (skipped
          ? `, skipped ${skipped} unmatched row(s).`
          : "."),
    );
    if (csvInputRef.current) {
      csvInputRef.current.value = "";
    }
  };

  if (sitesQuery.isLoading) {
    return (
      <AppLoader label="Loading sites..." />
    );
  }

  return (
    <div className="organization-page">
      <div className="page-heading print-hidden">
        <div>
          <span className="page-eyebrow">
            Store Reconciliation
          </span>
          <h1>Monthly Entry</h1>
          <p>
            Enter opening/receipts/closing for
            norm-based items and book stock /
            physical count for direct-count
            items.
          </p>
        </div>

        <div className="page-actions">
          <label className="filter-control">
            <span>Month</span>
            <input
              type="month"
              value={monthValue}
              onChange={(event) =>
                setMonthValue(
                  event.target.value,
                )
              }
            />
          </label>
          <label className="filter-control">
            <span>Site</span>
            <select
              value={selectedSite}
              onChange={(event) =>
                setSelectedSite(
                  event.target.value,
                )
              }
            >
              <option value="">
                Select site
              </option>
              {(
                sitesQuery.data ?? []
              ).map((site) => (
                <option
                  key={site.id}
                  value={site.id}
                >
                  {site.code} -{" "}
                  {site.label}
                </option>
              ))}
            </select>
          </label>
          {period ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => window.print()}
            >
              <Printer size={15} />
              Print Statement
            </button>
          ) : null}
          {period ? (
            <button
              type="button"
              className="button button--tertiary"
              onClick={() =>
                downloadCsvRows(
                  `${period.site_code}-${period.period_month}-statement.csv`,
                  buildStatementCsvRows({
                    period,
                    entries,
                    outputEntries,
                  }),
                )
              }
            >
              <Download size={15} />
              Export CSV
            </button>
          ) : null}
        </div>
      </div>

      <div className="print-hidden">
        <OfflineQueueBanner
          isOnline={offlineQueue.isOnline}
          queueCount={offlineQueue.queueCount}
          isSyncing={offlineQueue.isSyncing}
          onSyncNow={offlineQueue.syncNow}
        />
        {!offlineQueue.isOnline &&
        period?.__offlineCachedAt ? (
          <div className="inline-alert inline-alert--warning">
            <div>
              <strong>
                Showing a saved copy
              </strong>
              <p>
                You&rsquo;re offline, so this is
                the data last loaded on this
                device (
                {new Date(
                  period.__offlineCachedAt,
                ).toLocaleString()}
                ). It may not reflect changes
                made elsewhere since then.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {!selectedSite ? (
        <SurfaceCard>
          <p>
            Select a site to view or enter its
            monthly reconciliation.
          </p>
        </SurfaceCard>
      ) : periodQuery.isLoading ? (
        <AppLoader label="Loading period..." />
      ) : periodQuery.isError || !period ? (
        <ErrorState
          title="Period unavailable"
          message={
            periodQuery.error?.message
          }
          onRetry={periodQuery.refetch}
        />
      ) : (
        <>
          <SurfaceCard className="print-hidden">
            <div className="surface-card__header">
              <h2>
                {period.site_code} -{" "}
                {period.period_month}
              </h2>
              <span
                className={`status-chip ${
                  {
                    DRAFT: "status-chip--warning",
                    PENDING_APPROVAL:
                      "status-chip--warning",
                    APPROVED:
                      "status-chip--success",
                    REJECTED: "status-chip--error",
                  }[period.status] ??
                  "status-chip--success"
                }`}
              >
                {period.status_display}
              </span>
            </div>
            <div className="surface-card__body">
              <p>
                Entries:{" "}
                <strong>
                  {period.entry_count}
                </strong>{" "}
                | Flags:{" "}
                <strong>
                  {period.flag_count}
                </strong>
              </p>
              {isEditable ? (
                <div className="site-toolbar">
                  <label className="filter-control">
                    <span>
                      Opening stock date
                      (optional)
                    </span>
                    <input
                      type="date"
                      value={
                        period.opening_stock_date ||
                        ""
                      }
                      onChange={(event) =>
                        updatePeriod.mutate({
                          id: period.id,
                          payload: {
                            opening_stock_date:
                              event.target
                                .value || null,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="filter-control">
                    <span>
                      Closing stock date
                      (optional)
                    </span>
                    <input
                      type="date"
                      value={
                        period.closing_stock_date ||
                        ""
                      }
                      onChange={(event) =>
                        updatePeriod.mutate({
                          id: period.id,
                          payload: {
                            closing_stock_date:
                              event.target
                                .value || null,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              ) : period.opening_stock_date ||
                period.closing_stock_date ? (
                <p className="table-subtext">
                  Stock counted:{" "}
                  {period.opening_stock_date ||
                    "-"}{" "}
                  to{" "}
                  {period.closing_stock_date ||
                    "-"}
                </p>
              ) : null}
              <ApprovalStatusBanner
                period={period}
              />
              {isEditable ? (
                <button
                  type="button"
                  className="button button--primary"
                  disabled={
                    submitPeriod.isPending ||
                    !entries.length
                  }
                  onClick={() =>
                    submitPeriod.mutate(
                      period.id,
                    )
                  }
                >
                  Submit Period
                </button>
              ) : (
                <p className="table-subtext">
                  This period has been
                  submitted and is read-only.
                </p>
              )}
              {submitPeriod.isError ? (
                <div className="inline-alert inline-alert--error">
                  {
                    submitPeriod.error
                      ?.message
                  }
                </div>
              ) : null}
              {period.status === "REJECTED" &&
              isStoreHo ? (
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={
                    reopenPeriod.isPending
                  }
                  onClick={() =>
                    reopenPeriod.mutate(
                      period.id,
                    )
                  }
                >
                  Reopen For Correction
                </button>
              ) : null}
              {reopenPeriod.isError ? (
                <div className="inline-alert inline-alert--error">
                  {
                    reopenPeriod.error
                      ?.message
                  }
                </div>
              ) : null}
            </div>
          </SurfaceCard>

          <div className="print-only">
            <ReconciliationStatementSheet
              period={period}
              entries={entries}
              outputEntries={outputEntries}
            />
          </div>

          <AttachmentsCard
            periodId={period.id}
            isEditable={isEditable}
          />

          {normBasedItems.length ? (
            <SurfaceCard className="print-hidden">
              <div className="surface-card__header">
                <h2>Production Output</h2>
              </div>
              <div className="surface-card__body">
                {isEditable ? (
                  <OutputEntryForm
                    items={normBasedItems}
                    submitting={
                      createOutputEntry.isPending
                    }
                    onSubmit={
                      handleCreateOutputEntry
                    }
                  />
                ) : null}
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Grade</th>
                        <th>Quantity</th>
                        {isEditable ? (
                          <th>Actions</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {outputEntries.map(
                        (output) => (
                          <tr key={output.id}>
                            <td>
                              {output.item_code}{" "}
                              - {output.item_name}
                            </td>
                            <td>
                              {output.grade_label ||
                                "-"}
                            </td>
                            <td>
                              {
                                output.output_quantity
                              }
                            </td>
                            {isEditable ? (
                              <td>
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() =>
                                    handleDeleteOutputEntry(
                                      output.id,
                                    )
                                  }
                                  aria-label="Delete output entry"
                                >
                                  <Trash2
                                    size={15}
                                  />
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        ),
                      )}
                      {!outputEntries.length ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="table-empty-state"
                          >
                            No production output
                            recorded yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </SurfaceCard>
          ) : null}

          <SurfaceCard className="print-hidden">
            <div className="surface-card__header">
              <h2>Reconciliation Entries</h2>
              {isEditable ? (
                <label className="button button--secondary">
                  <Upload size={15} />
                  Upload Book Stock CSV
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvUpload}
                    style={{
                      display: "none",
                    }}
                  />
                </label>
              ) : null}
            </div>
            {csvMessage ? (
              <div className="inline-alert">
                {csvMessage}
              </div>
            ) : null}
            {isEditable ? (
              <div className="surface-card__body">
                {items.length ? (
                  <AddEntryForm
                    availableItems={
                      itemsAvailableToAdd
                    }
                    submitting={
                      createEntry.isPending ||
                      updateEntry.isPending
                    }
                    onSubmit={(item, payload) =>
                      handleSaveEntry(
                        item,
                        payload,
                      )
                    }
                  />
                ) : (
                  <p className="table-subtext">
                    No active items configured
                    yet. Ask an administrator to
                    set up the item master.
                  </p>
                )}
              </div>
            ) : null}
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>UOM</th>
                    <th>Section</th>
                    <th>Rack</th>
                    <th>Opening/Book</th>
                    <th>Receipts/Physical</th>
                    <th>Closing</th>
                    <th>Actual</th>
                    <th>Theoretical/Book</th>
                    <th>Variance</th>
                    <th>Status</th>
                    {isEditable ? (
                      <th>Edit</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {entriesForDisplay.map(
                    ({ item, entry, queued }) => (
                      <SavedEntryRow
                        key={`${item.id}-${
                          entry?.updated_at ??
                          "pending"
                        }`}
                        item={item}
                        entry={entry}
                        queued={queued}
                        editable={isEditable}
                        saving={
                          createEntry.isPending ||
                          updateEntry.isPending
                        }
                        onSave={(payload) =>
                          handleSaveEntry(
                            item,
                            payload,
                          )
                        }
                      />
                    ),
                  )}
                  {!entriesForDisplay.length ? (
                    <tr>
                      <td
                        colSpan={
                          isEditable ? 12 : 11
                        }
                        className="table-empty-state"
                      >
                        {isEditable
                          ? "No entries added yet — select an item above to add one."
                          : "No entries were recorded for this period."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
