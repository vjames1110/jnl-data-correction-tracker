import {
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  Download,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { AppLoader } from "../../../components/common/AppLoader";
import { formatDateTime } from "../../../utils/dateFormat";
import { ErrorState } from "../../../components/common/ErrorState";
import { OfflineQueueBanner } from "../../../components/common/OfflineQueueBanner";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { AttachmentLink } from "../../../components/common/AttachmentLink";
import {
  isApprovalRole,
  isStoreRole,
  USER_ROLES,
} from "../../../constants/roles";
import { useAuth } from "../../../hooks/useAuth";
import { useOfflineQueue } from "../../../hooks/useOfflineQueue";
import { useSitesDropdown } from "../../../hooks/useOrganization";
import {
  useApproveReconciliationPeriod,
  useCreateReconciliationAttachment,
  useCreateReconciliationEntry,
  useCreateReconciliationMiscUsage,
  useCreateReconciliationOutputEntry,
  useDeleteReconciliationAttachment,
  useDeleteReconciliationMiscUsage,
  useDeleteReconciliationOutputEntry,
  useReconciliationAttachments,
  useReconciliationCurrentPeriod,
  useReconciliationEntries,
  useReconciliationItemCategories,
  useReconciliationItems,
  useReconciliationMiscUsage,
  useReconciliationOutputEntries,
  useReconciliationSiteItemConfigs,
  useRejectReconciliationPeriod,
  useReopenReconciliationPeriod,
  useReturnReconciliationPeriod,
  useSubmitReconciliationPeriod,
  useUpdateReconciliationEntry,
  useUpdateReconciliationMiscUsage,
  useUpdateReconciliationPeriod,
} from "../../../hooks/useReconciliation";
import { offlineOutbox } from "../../../services/offlineOutbox";
import { isNetworkError } from "../../../services/offlineSync";
import { varianceCellClass } from "../../../utils/formatters";
import { MiscUsageCard } from "../components/MiscUsageCard";
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

// Raw-material stock is one entry per material per month - the item
// id alone identifies its entry. (Production output is what varies
// by grade; a material's theoretical consumption is summed across
// every grade produced.)
function entryKey(itemId) {
  return `${itemId}`;
}

function LocationCell({ section, rack }) {
  if (!section && !rack) {
    return "-";
  }
  return [section, rack]
    .filter(Boolean)
    .join(" / ");
}

function QuantityFields({
  isNormBased,
  form,
  setField,
}) {
  if (isNormBased) {
    return (
      <div className="entry-compact-col">
        <label className="entry-compact-field">
          <span>Opening</span>
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
        </label>
        <label className="entry-compact-field">
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
            className="entry-row-input"
          />
        </label>
        <label className="entry-compact-field">
          <span>Closing</span>
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
        </label>
      </div>
    );
  }

  return (
    <div className="entry-compact-col">
      <label className="entry-compact-field">
        <span>Book</span>
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
      </label>
      <label className="entry-compact-field">
        <span>Physical</span>
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
      </label>
    </div>
  );
}

function QuantityDisplay({
  isNormBased,
  entry,
}) {
  if (isNormBased) {
    return (
      <div className="entry-compact-col">
        <span>
          Opening: {entry?.opening_stock ?? "-"}
        </span>
        <span>
          Receipts: {entry?.receipts ?? "-"}
        </span>
        <span>
          Closing: {entry?.closing_stock ?? "-"}
        </span>
        {Number(entry?.miscellaneous_quantity) >
        0 ? (
          <span>
            Misc. use:{" "}
            {entry.miscellaneous_quantity}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="entry-compact-col">
      <span>
        Book: {entry?.book_stock ?? "-"}
      </span>
      <span>
        Physical:{" "}
        {entry?.physical_count ?? "-"}
      </span>
    </div>
  );
}

function ResultDisplay({ entry }) {
  return (
    <div className="entry-compact-col">
      <span>
        Actual: {entry?.actual_quantity ?? "-"}
      </span>
      <span>
        Theoretical/Book:{" "}
        {entry?.theoretical_or_book_quantity ??
          "-"}
      </span>
      <span
        className={varianceCellClass(
          entry?.variance_quantity,
        )}
      >
        Variance:{" "}
        {entry?.variance_quantity ?? "-"}
      </span>
    </div>
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
        <div className="entry-compact-col">
          <label className="entry-compact-field">
            <span>Section</span>
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
          </label>
          <label className="entry-compact-field">
            <span>Rack</span>
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
          </label>
        </div>
      </td>
      <td>
        <QuantityFields
          isNormBased={isNormBased}
          form={form}
          setField={setField}
        />
      </td>
      <td>
        <ResultDisplay entry={entry} />
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
      <td>
        <LocationCell
          section={entry.section}
          rack={entry.rack}
        />
      </td>
      <td>
        <QuantityDisplay
          isNormBased={isNormBased}
          entry={entry}
        />
      </td>
      <td>
        <ResultDisplay entry={entry} />
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

function EntriesTable({
  rows,
  isEditable,
  saving,
  onSave,
  emptyMessage,
}) {
  const columnCount = 6 + (isEditable ? 1 : 0);

  return (
    <div className="data-table-wrapper">
      <table className="data-table reco-entries-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>UOM</th>
            <th>Location</th>
            <th>Quantities</th>
            <th>Result</th>
            <th>Status</th>
            {isEditable ? <th>Edit</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, entry, queued }) => (
            <SavedEntryRow
              key={`${item.id}-${
                entry?.updated_at ?? "pending"
              }`}
              item={item}
              entry={entry}
              queued={queued}
              editable={isEditable}
              saving={saving}
              onSave={(payload) =>
                onSave(item, payload)
              }
            />
          ))}
          {!rows.length ? (
            <tr>
              <td
                colSpan={columnCount}
                className="table-empty-state"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
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
        Every item here already has an entry this
        period.
      </p>
    );
  }

  return (
    <form
      className="entry-form-row"
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

// Approve/Return/Reject right from the read-only "View Entries"
// page a Director opens from their Approval Inbox - the same
// mutations InboxRow uses, so a reviewer doesn't have to leave,
// remember the numbers, then go back to the inbox to act on them.
function DirectorApprovalPanel({ period }) {
  const [comment, setComment] = useState("");
  const approve = useApproveReconciliationPeriod();
  const reject = useRejectReconciliationPeriod();
  const returnForCorrection =
    useReturnReconciliationPeriod();

  const isPending =
    approve.isPending ||
    reject.isPending ||
    returnForCorrection.isPending;
  const error =
    approve.error ??
    reject.error ??
    returnForCorrection.error;

  return (
    <div className="director-approval-panel print-hidden">
      {error ? (
        <div className="inline-alert inline-alert--error">
          {error?.message}
        </div>
      ) : null}
      <label className="form-field">
        <span>
          Comment (required for Return / Reject)
        </span>
        <textarea
          rows={2}
          value={comment}
          onChange={(event) =>
            setComment(event.target.value)
          }
          placeholder="Add a comment..."
        />
      </label>
      <div className="management-panel__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={isPending}
          onClick={() =>
            approve.mutate({
              id: period.id,
              comment,
            })
          }
        >
          <CheckCircle2 size={15} />
          Approve
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={isPending || !comment.trim()}
          onClick={() =>
            returnForCorrection.mutate({
              id: period.id,
              comment,
            })
          }
        >
          <RotateCcw size={15} />
          Return For Correction
        </button>
        <button
          type="button"
          className="button button--tertiary"
          disabled={isPending || !comment.trim()}
          onClick={() =>
            reject.mutate({
              id: period.id,
              comment,
            })
          }
        >
          <XCircle size={15} />
          Reject
        </button>
      </div>
    </div>
  );
}

function OutputEntryForm({
  categories,
  onSubmit,
  submitting,
}) {
  const [form, setForm] = useState({
    category: "",
    grade_label: "",
    output_quantity: "",
  });

  const selectedCategory = categories.find(
    (category) => category.id === form.category,
  );
  const availableGrades =
    selectedCategory?.grades ?? [];

  return (
    <form
      className="site-toolbar"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          !form.category ||
          !form.grade_label ||
          !form.output_quantity
        ) {
          return;
        }
        onSubmit(form);
        setForm({
          category: "",
          grade_label: "",
          output_quantity: "",
        });
      }}
    >
      <label className="filter-control">
        <span>Product</span>
        <select
          value={form.category}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              category: event.target.value,
              // A different product's grade list rarely overlaps
              // with the last one picked - reset rather than risk
              // submitting a grade that belongs to the old product.
              grade_label: "",
            }))
          }
          required
        >
          <option value="" disabled hidden>
            Select product
          </option>
          {categories.map((category) => (
            <option
              key={category.id}
              value={category.id}
            >
              {category.category_name}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-control">
        <span>Grade</span>
        <select
          value={form.grade_label}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              grade_label: event.target.value,
            }))
          }
          disabled={!availableGrades.length}
          required
        >
          <option value="" disabled hidden>
            {!selectedCategory
              ? "Select a product first"
              : availableGrades.length
                ? "Select grade"
                : "No grades configured"}
          </option>
          {availableGrades.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
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
      {selectedCategory &&
      !availableGrades.length ? (
        <p
          className="table-subtext"
          style={{ gridColumn: "1 / -1" }}
        >
          {selectedCategory.category_name} has no
          grades configured yet - add some in
          Item Category Management before logging
          output for it.
        </p>
      ) : null}
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
                        <AttachmentLink
                          attachment={attachment}
                        />
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
  const [pendingByKey, setPendingByKey] =
    useState(new Map());
  // Miscellaneous-use changes made offline, by item id - shown
  // (marked Queued) until the outbox syncs them.
  const [pendingMisc, setPendingMisc] = useState(
    new Map(),
  );
  const offlineQueue = useOfflineQueue({
    onSynced: () => {
      setPendingByKey(new Map());
      setPendingMisc(new Map());
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
  const categoriesQuery =
    useReconciliationItemCategories({
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
  const miscUsageQuery =
    useReconciliationMiscUsage(
      period ? { period: period.id } : undefined,
    );
  // Two sites can produce the same grade with genuinely different
  // materials (e.g. Site A's M20 uses Loose Cement, Site B's uses
  // Cement OPC) - both items sit in the same category, but only one
  // applies at each site. A Site Override is what marks an item as
  // "this site actually uses this one", so its mere existence for an
  // item at this site is read as an eligibility signal, independent
  // of the rate/mix ratio it happens to carry.
  const siteItemConfigsQuery =
    useReconciliationSiteItemConfigs(
      selectedSite
        ? {
            site: selectedSite,
            is_active: true,
            page_size: 500,
          }
        : undefined,
      { enabled: Boolean(selectedSite) },
    );

  const createEntry = useCreateReconciliationEntry();
  const updateEntry = useUpdateReconciliationEntry();
  const createOutputEntry =
    useCreateReconciliationOutputEntry();
  const deleteOutputEntry =
    useDeleteReconciliationOutputEntry();
  const createMiscUsage =
    useCreateReconciliationMiscUsage();
  const updateMiscUsage =
    useUpdateReconciliationMiscUsage();
  const deleteMiscUsage =
    useDeleteReconciliationMiscUsage();
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
  const categories = useMemo(
    () => categoriesQuery.data?.items ?? [],
    [categoriesQuery.data],
  );
  const entries = useMemo(
    () => entriesQuery.data ?? [],
    [entriesQuery.data],
  );
  const outputEntries =
    outputEntriesQuery.data ?? [];
  // Every item that this site has an active Site Override for, of
  // any grade or period - read as "this site actually uses this
  // item", not as a rate lookup (the resolved rate/mix is computed
  // server-side regardless). Empty until a site is selected.
  const siteConfiguredItemIds = useMemo(
    () =>
      new Set(
        (
          siteItemConfigsQuery.data?.items ?? []
        ).map((config) => config.item),
      ),
    [siteItemConfigsQuery.data],
  );
  // The Production Output form only ever offers categories flagged
  // as a production type (e.g. Concrete). Every norm-based item is a
  // recipe material entered once per month in the Recipe Materials
  // card; direct-count items are entered in Other Items.
  const productionTypeCategories = categories.filter(
    (category) => category.is_production_output,
  );

  // One entry per material per month - the item id alone keys it.
  const entryByKey = useMemo(() => {
    const map = new Map();
    entries.forEach((entry) => {
      map.set(entryKey(entry.item), entry);
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

  const enteredKeys = useMemo(() => {
    const set = new Set(
      entries.map((entry) =>
        entryKey(entry.item),
      ),
    );
    pendingByKey.forEach((_, key) =>
      set.add(key),
    );
    return set;
  }, [entries, pendingByKey]);

  const itemsAvailableToAdd = useMemo(
    () =>
      items.filter(
        (item) =>
          !enteredKeys.has(entryKey(item.id)),
      ),
    [items, enteredKeys],
  );

  // Norm-based materials, entered once per month in the Recipe
  // Materials card. Opt-in site scoping: once this site has an
  // active Site Override for at least one material, the list narrows
  // to only its configured materials; a site that hasn't configured
  // anything yet sees every norm-based item.
  const siteMaterials = useMemo(() => {
    const allMaterials = items.filter(
      (item) =>
        item.reconciliation_type ===
        "NORM_BASED",
    );
    const siteConfigured = allMaterials.some(
      (item) =>
        siteConfiguredItemIds.has(item.id),
    );
    return siteConfigured
      ? allMaterials.filter((item) =>
          siteConfiguredItemIds.has(item.id),
        )
      : allMaterials;
  }, [items, siteConfiguredItemIds]);
  const materialsAvailableToAdd = useMemo(
    () =>
      siteMaterials.filter(
        (item) =>
          !enteredKeys.has(entryKey(item.id)),
      ),
    [siteMaterials, enteredKeys],
  );

  // Miscellaneous use: server rows, with anything still waiting in
  // the offline outbox laid over them.
  const miscRows = useMemo(() => {
    const server = miscUsageQuery.data ?? [];
    const rows = [];
    server.forEach((row) => {
      const pending = pendingMisc.get(row.item);
      if (pending?.kind === "delete") {
        return;
      }
      rows.push({
        ...row,
        quantity:
          pending?.kind === "update"
            ? pending.quantity
            : row.quantity,
        queued: Boolean(pending),
      });
    });
    pendingMisc.forEach((pending, itemId) => {
      if (
        pending.kind !== "create" ||
        server.some((row) => row.item === itemId)
      ) {
        return;
      }
      const item = itemById.get(itemId);
      if (!item) {
        return;
      }
      rows.push({
        id: `queued-${itemId}`,
        item: itemId,
        item_code: item.item_code,
        item_name: item.item_name,
        uom: item.uom,
        quantity: pending.quantity,
        queued: true,
      });
    });
    return rows.sort((a, b) =>
      a.item_name.localeCompare(b.item_name),
    );
  }, [miscUsageQuery.data, pendingMisc, itemById]);
  const miscMaterialsAvailable = useMemo(
    () =>
      siteMaterials.filter(
        (item) =>
          !miscRows.some(
            (row) => row.item === item.id,
          ),
      ),
    [siteMaterials, miscRows],
  );

  const otherAvailableToAdd = useMemo(
    () =>
      itemsAvailableToAdd.filter(
        (item) =>
          item.reconciliation_type !==
          "NORM_BASED",
      ),
    [itemsAvailableToAdd],
  );
  const hasOtherItems = items.some(
    (item) =>
      item.reconciliation_type !== "NORM_BASED",
  );

  // One row per material entry that actually exists (server-saved
  // or still offline-queued) - sourced from the entries themselves
  // (which already carry their own item_code/name/uom) rather than
  // the active items list, so a since-deactivated item's submitted
  // entry still shows up correctly.
  const entriesForDisplay = useMemo(() => {
    const rows = entries.map((serverEntry) => {
      const key = entryKey(serverEntry.item);
      const pending = pendingByKey.get(key);
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

    pendingByKey.forEach((pending, key) => {
      if (entryByKey.has(key)) {
        return;
      }
      const item = itemById.get(pending.itemId);
      if (!item) {
        return;
      }
      rows.push({
        item,
        entry: {
          ...pending.payload,
          item: pending.itemId,
        },
        queued: true,
      });
    });

    return rows;
  }, [
    entries,
    pendingByKey,
    itemById,
    entryByKey,
  ]);

  // Recipe materials (norm-based) vs. direct-count "Other Items".
  const materialEntriesForDisplay = useMemo(
    () =>
      entriesForDisplay.filter(
        ({ item }) =>
          item.reconciliation_type ===
          "NORM_BASED",
      ),
    [entriesForDisplay],
  );
  const otherEntriesForDisplay = useMemo(
    () =>
      entriesForDisplay.filter(
        ({ item }) =>
          item.reconciliation_type !==
          "NORM_BASED",
      ),
    [entriesForDisplay],
  );

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
    const key = entryKey(item.id);
    const existing = entryByKey.get(key);

    if (existing) {
      const queuedAction = offlineOutbox.enqueue({
        type: "updateEntry",
        entityId: existing.id,
        payload,
        dedupeKey: `update-entry-${existing.id}`,
        label: `${item.item_code} (update)`,
      });
      offlineQueue.refreshQueueCount();
      setPendingByKey((current) => {
        const next = new Map(current);
        next.set(key, {
          payload,
          actionId: queuedAction.id,
          isCreate: false,
          itemId: item.id,
        });
        return next;
      });
      return;
    }

    const existingPending = pendingByKey.get(key);
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
    setPendingByKey((current) => {
      const next = new Map(current);
      next.set(key, {
        payload: { ...payload },
        actionId: queuedAction.id,
        isCreate: true,
        clientId,
        itemId: item.id,
      });
      return next;
    });
  };

  const clearPending = (key) => {
    setPendingByKey((current) => {
      if (!current.has(key)) {
        return current;
      }
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  };

  const handleSaveEntry = async (item, payload) => {
    if (!offlineQueue.isOnline) {
      queueEntrySave(item, payload);
      return;
    }

    const key = entryKey(item.id);
    const existing = entryByKey.get(key);
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
      clearPending(key);
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

  // Miscellaneous use. Each handler resolves to whether the change
  // was accepted (saved, or safely queued offline) so the card keeps
  // what the person typed when the server rejects it - the reason
  // is shown from the mutation's own error.
  const setMiscPending = (itemId, value) =>
    setPendingMisc((current) => {
      const next = new Map(current);
      if (value) {
        next.set(itemId, value);
      } else {
        next.delete(itemId);
      }
      return next;
    });

  const queueMiscCreate = (itemId, quantity) => {
    const item = itemById.get(itemId);
    const action = offlineOutbox.enqueue({
      type: "createMiscUsage",
      payload: {
        id: offlineOutbox.generateId(),
        period: period.id,
        item: itemId,
        quantity,
      },
      dedupeKey: `create-misc-${period.id}-${itemId}`,
      label: `${item?.item_code ?? "Item"} (misc use)`,
    });
    offlineQueue.refreshQueueCount();
    setMiscPending(itemId, {
      kind: "create",
      quantity,
      actionId: action.id,
    });
  };

  const resetMiscErrors = () => {
    createMiscUsage.reset();
    updateMiscUsage.reset();
    deleteMiscUsage.reset();
  };

  const handleAddMiscUsage = async ({
    item,
    quantity,
  }) => {
    resetMiscErrors();
    if (!offlineQueue.isOnline) {
      queueMiscCreate(item, quantity);
      return true;
    }
    try {
      await createMiscUsage.mutateAsync({
        period: period.id,
        item,
        quantity,
      });
      return true;
    } catch (error) {
      if (isNetworkError(error)) {
        queueMiscCreate(item, quantity);
        return true;
      }
      return false;
    }
  };

  const handleUpdateMiscUsage = async (
    row,
    quantity,
  ) => {
    resetMiscErrors();
    const stillQueuedCreate =
      String(row.id).startsWith("queued-");
    const queueUpdate = () => {
      if (stillQueuedCreate) {
        queueMiscCreate(row.item, quantity);
        return;
      }
      const action = offlineOutbox.enqueue({
        type: "updateMiscUsage",
        entityId: row.id,
        payload: { quantity },
        dedupeKey: `update-misc-${row.id}`,
        label: `${row.item_code} (misc use update)`,
      });
      offlineQueue.refreshQueueCount();
      setMiscPending(row.item, {
        kind: "update",
        quantity,
        actionId: action.id,
      });
    };

    if (!offlineQueue.isOnline || stillQueuedCreate) {
      queueUpdate();
      return true;
    }
    try {
      await updateMiscUsage.mutateAsync({
        id: row.id,
        payload: { quantity },
      });
      return true;
    } catch (error) {
      if (isNetworkError(error)) {
        queueUpdate();
        return true;
      }
      return false;
    }
  };

  const handleDeleteMiscUsage = async (row) => {
    resetMiscErrors();
    if (String(row.id).startsWith("queued-")) {
      // Never reached the server - just drop it from the outbox.
      const pending = pendingMisc.get(row.item);
      if (pending?.actionId) {
        offlineOutbox.remove(pending.actionId);
        offlineQueue.refreshQueueCount();
      }
      setMiscPending(row.item, null);
      return;
    }

    const queueDelete = () => {
      const action = offlineOutbox.enqueue({
        type: "deleteMiscUsage",
        entityId: row.id,
        dedupeKey: `delete-misc-${row.id}`,
        label: `${row.item_code} (delete misc use)`,
      });
      offlineQueue.refreshQueueCount();
      setMiscPending(row.item, {
        kind: "delete",
        actionId: action.id,
      });
    };

    if (!offlineQueue.isOnline) {
      queueDelete();
      return;
    }
    try {
      await deleteMiscUsage.mutateAsync(row.id);
    } catch (error) {
      if (isNetworkError(error)) {
        queueDelete();
      }
    }
  };

  const miscError = [
    createMiscUsage,
    updateMiscUsage,
    deleteMiscUsage,
  ].find((mutation) => mutation.isError)?.error
    ?.message;

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

      const existing = entryByKey.get(
        entryKey(item.id, ""),
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
            Production Reconciliation
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
                {formatDateTime(
                  period.__offlineCachedAt,
                )}
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
              {isApprovalRole(user?.role) &&
              period.status ===
                "PENDING_APPROVAL" ? (
                <DirectorApprovalPanel
                  period={period}
                />
              ) : null}
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

          <SurfaceCard className="print-hidden">
            <div className="surface-card__header">
              <h2>Production Output</h2>
            </div>
            <div className="surface-card__body">
              {productionTypeCategories.length ? (
                <>
                  {isEditable ? (
                    <OutputEntryForm
                      categories={
                        productionTypeCategories
                      }
                      submitting={
                        createOutputEntry.isPending
                      }
                      onSubmit={
                        handleCreateOutputEntry
                      }
                    />
                  ) : null}
                  <p className="table-subtext">
                    Log how much of each product was
                    produced, grade by grade. Each
                    material's theoretical
                    consumption is the sum across
                    every grade produced.
                  </p>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product</th>
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
                                {
                                  output.category_name
                                }
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
                                    className="icon-button icon-button--danger"
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
                              colSpan={
                                isEditable ? 4 : 3
                              }
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
                </>
              ) : (
                <p className="table-subtext">
                  No category is marked as a
                  production type yet - ask an
                  administrator to flag one (e.g.
                  Concrete) in Item Category
                  Management before this section
                  can be used.
                </p>
              )}
            </div>
          </SurfaceCard>

          {productionTypeCategories.length ? (
            <MiscUsageCard
              rows={miscRows}
              materials={miscMaterialsAvailable}
              isEditable={isEditable}
              submitting={
                createMiscUsage.isPending ||
                updateMiscUsage.isPending ||
                deleteMiscUsage.isPending
              }
              error={miscError}
              onAdd={handleAddMiscUsage}
              onUpdate={handleUpdateMiscUsage}
              onDelete={handleDeleteMiscUsage}
            />
          ) : null}

          {productionTypeCategories.length ? (
            <SurfaceCard className="print-hidden">
              <div className="surface-card__header">
                <h2>Recipe Materials</h2>
              </div>
              <div className="surface-card__body">
                <p className="table-subtext">
                  Enter each material's opening,
                  receipts and closing stock{" "}
                  <strong>once for the month</strong>
                  . Theoretical consumption is
                  calculated from the production
                  output above, summed across every
                  grade the material is used for.
                </p>
                {isEditable ? (
                  <AddEntryForm
                    availableItems={
                      materialsAvailableToAdd
                    }
                    submitting={
                      createEntry.isPending ||
                      updateEntry.isPending
                    }
                    onSubmit={handleSaveEntry}
                  />
                ) : null}
                <EntriesTable
                  rows={materialEntriesForDisplay}
                  isEditable={isEditable}
                  saving={
                    createEntry.isPending ||
                    updateEntry.isPending
                  }
                  onSave={handleSaveEntry}
                  emptyMessage={
                    isEditable
                      ? "No materials recorded yet - add one above."
                      : "No materials were recorded for this period."
                  }
                />
              </div>
            </SurfaceCard>
          ) : null}

          {hasOtherItems ? (
            <SurfaceCard className="print-hidden">
              <div className="surface-card__header">
                <h2>Other Items</h2>
                {isEditable ? (
                  <label className="button button--secondary">
                    <Upload size={15} />
                    Upload Book Stock CSV
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={
                        handleCsvUpload
                      }
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
              <div className="surface-card__body">
                <p className="table-subtext">
                  Direct-count items (book vs.
                  physical) with no recipe of their
                  own - entered directly rather
                  than derived from production
                  output.
                </p>
                {isEditable ? (
                  <AddEntryForm
                    availableItems={
                      otherAvailableToAdd
                    }
                    submitting={
                      createEntry.isPending ||
                      updateEntry.isPending
                    }
                    onSubmit={handleSaveEntry}
                  />
                ) : null}
                <EntriesTable
                  rows={otherEntriesForDisplay}
                  isEditable={isEditable}
                  saving={
                    createEntry.isPending ||
                    updateEntry.isPending
                  }
                  onSave={handleSaveEntry}
                  emptyMessage={
                    isEditable
                      ? "No items recorded yet - add one above."
                      : "No items were recorded for this period."
                  }
                />
              </div>
            </SurfaceCard>
          ) : null}

          <SurfaceCard className="print-hidden">
            <div className="surface-card__header">
              <h2>Reconciliation Entries</h2>
            </div>
            <p className="table-subtext">
              A read-only summary of every entry
              recorded this period - add or edit
              from Recipe Materials or Other Items
              above.
            </p>
            <EntriesTable
              rows={entriesForDisplay}
              isEditable={isEditable}
              saving={
                createEntry.isPending ||
                updateEntry.isPending
              }
              onSave={handleSaveEntry}
              emptyMessage={
                isEditable
                  ? "No entries added yet."
                  : "No entries were recorded for this period."
              }
            />
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
