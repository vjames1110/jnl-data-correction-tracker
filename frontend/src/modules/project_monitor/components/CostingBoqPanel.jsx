import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";

import {
  useCostingBoq,
  useCostingContractSettings,
  useCreateCostingBoqItem,
  useDeleteCostingBoqItem,
  useImportCostingBoq,
  useUpdateCostingBoqItem,
  useUpdateCostingContractSettings,
} from "../../../hooks/useProjectMonitor";
import { projectMonitorService } from "../../../services/projectMonitorService";
import { BulkUploadCard } from "./BulkUploadCard";
import { apiErrorMessage, parseNumber, saveBlob } from "../utils/finance";
import { formatCurrency, formatQty, formatRate } from "../utils/status";

const SETTINGS_BLANK = {
  tender_percent: "",
  authority_escalation_percent: "",
  gst_percent: "",
};

/**
 * The three contract-wide settings this sheet reads: the tender %
 * (shared with DPR & Bills), the departmental escalation on the
 * authority rate, and the default GST %. Changing the tender % or the
 * escalation re-derives every row's bid rate.
 */
function CostingContractSettingsCard({ siteId, canEnter }) {
  const settingsQuery = useCostingContractSettings(siteId);
  const updateSettings = useUpdateCostingContractSettings(siteId);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(SETTINGS_BLANK);
  const [notice, setNotice] = useState("");

  const settings = settingsQuery.data;

  const startEditing = () => {
    setForm({
      tender_percent: settings?.tender_percent ?? "",
      authority_escalation_percent:
        settings?.authority_escalation_percent ?? "",
      gst_percent: settings?.gst_percent ?? "",
    });
    setNotice("");
    setIsEditing(true);
  };

  const setField = (key) => (event) =>
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));

  const handleSave = async (event) => {
    event.preventDefault();
    try {
      const saved = await updateSettings.mutateAsync({
        tender_percent: parseNumber(form.tender_percent),
        authority_escalation_percent: parseNumber(
          form.authority_escalation_percent,
        ),
        gst_percent: parseNumber(form.gst_percent),
      });
      setIsEditing(false);
      setNotice(
        saved.recalculated
          ? `Saved - ${saved.recalculated} item(s) re-priced.`
          : "Saved.",
      );
    } catch {
      // Shown below via updateSettings.isError.
    }
  };

  if (!settings) {
    return null;
  }

  return (
    <div className="pm-boq-settings">
      {isEditing ? (
        <form
          className="pm-boq-slide__row"
          onSubmit={handleSave}
        >
          <label className="form-field">
            <span>Tender % (+ above / - below authority)</span>
            <input
              type="number"
              step="0.001"
              value={form.tender_percent}
              onChange={setField("tender_percent")}
            />
          </label>
          <label className="form-field">
            <span>Departmental escalation %</span>
            <input
              type="number"
              step="0.001"
              value={form.authority_escalation_percent}
              onChange={setField(
                "authority_escalation_percent",
              )}
            />
          </label>
          <label className="form-field">
            <span>GST %</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.gst_percent}
              onChange={setField("gst_percent")}
            />
          </label>
          <div className="pm-boq-slide__actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="button button--tertiary"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
          {updateSettings.isError ? (
            <div className="inline-alert inline-alert--error">
              {apiErrorMessage(updateSettings.error)}
            </div>
          ) : null}
        </form>
      ) : (
        <div className="pm-boq-settings__summary">
          <span>
            <strong>Tender %:</strong>{" "}
            {settings.tender_percent ?? "-"}
          </span>
          <span>
            <strong>Departmental escalation %:</strong>{" "}
            {settings.authority_escalation_percent ?? "-"}
          </span>
          <span>
            <strong>GST %:</strong>{" "}
            {settings.gst_percent ?? "-"}
          </span>
          {canEnter ? (
            <button
              type="button"
              className="button button--tertiary button--sm"
              onClick={startEditing}
            >
              <Pencil size={14} /> Edit
            </button>
          ) : null}
          {notice ? <span className="pm-boq-settings__notice">{notice}</span> : null}
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  item_no: "",
  description: "",
  unit: "",
  qty: "",
  authority_rate: "",
  tender_percent: "",
  rate: "",
  our_cost_rate: "",
  gst_percent: "",
};

function toFormValues(row) {
  return {
    item_no: row.item_no || "",
    description: row.description || "",
    unit: row.unit || "",
    qty: row.qty ?? "",
    authority_rate: row.authority_rate ?? "",
    tender_percent: row.tender_percent ?? "",
    rate: row.bid_rate ?? "",
    our_cost_rate: row.our_cost_rate ?? "",
    gst_percent: row.gst_percent ?? "",
  };
}

function toPayload(values) {
  return {
    item_no: values.item_no.trim(),
    description: values.description.trim(),
    unit: values.unit.trim(),
    qty: parseNumber(values.qty),
    authority_rate: parseNumber(values.authority_rate),
    tender_percent: parseNumber(values.tender_percent),
    rate: parseNumber(values.rate),
    our_cost_rate: parseNumber(values.our_cost_rate),
    gst_percent: parseNumber(values.gst_percent),
  };
}

/**
 * The slide-down form used both to add a row (under nothing, or under
 * a parent row) and to edit one - one experiment specific to this
 * panel, per the confirmed request, rather than a side drawer.
 */
function CostingBoqSlideForm({
  title,
  initial,
  onSave,
  onCancel,
  isPending,
  error,
}) {
  const [values, setValues] = useState(initial);

  const set = (field) => (event) =>
    setValues((current) => ({
      ...current,
      [field]: event.target.value,
    }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!values.description.trim()) {
      return;
    }
    onSave(toPayload(values));
  };

  return (
    <div className="pm-boq-slide">
      <form className="pm-boq-slide__form" onSubmit={handleSubmit}>
        <div className="pm-boq-slide__title">{title}</div>
        <div className="pm-boq-slide__row">
          <label className="form-field">
            <span>Item no</span>
            <input
              type="text"
              value={values.item_no}
              onChange={set("item_no")}
              placeholder="e.g. 1.1"
            />
          </label>
          <label className="form-field pm-boq-slide__desc">
            <span>Description</span>
            <input
              type="text"
              value={values.description}
              onChange={set("description")}
              placeholder="e.g. Supply of cement"
              required
            />
          </label>
          <label className="form-field">
            <span>Unit</span>
            <input
              type="text"
              value={values.unit}
              onChange={set("unit")}
              placeholder="e.g. bag"
            />
          </label>
          <label className="form-field">
            <span>Qty</span>
            <input
              type="number"
              step="0.001"
              min="0"
              value={values.qty}
              onChange={set("qty")}
            />
          </label>
        </div>

        <div className="pm-boq-slide__row">
          <label className="form-field">
            <span>Authority rate</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={values.authority_rate}
              onChange={set("authority_rate")}
              placeholder="Railway / schedule rate"
            />
          </label>
          <label className="form-field">
            <span>Tender % (blank = contract %)</span>
            <input
              type="number"
              step="0.001"
              value={values.tender_percent}
              onChange={set("tender_percent")}
              placeholder="+ above / - below"
            />
          </label>
          <label className="form-field">
            <span>
              Rate{" "}
              {values.authority_rate
                ? "(worked out from authority rate)"
                : "(typed directly)"}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={values.rate}
              onChange={set("rate")}
              disabled={Boolean(values.authority_rate)}
            />
          </label>
          <label className="form-field">
            <span>GST % (blank = contract %)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={values.gst_percent}
              onChange={set("gst_percent")}
            />
          </label>
        </div>

        <div className="pm-boq-slide__row">
          <label className="form-field pm-boq-slide__cost">
            <span>Our cost (per unit)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={values.our_cost_rate}
              onChange={set("our_cost_rate")}
              placeholder="What this actually costs us - ignored once this row has its own materials under it"
            />
          </label>
          <div className="pm-boq-slide__actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={isPending || !values.description.trim()}
            >
              {isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="button button--tertiary"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
        {error ? (
          <div className="inline-alert inline-alert--error">
            {apiErrorMessage(error)}
          </div>
        ) : null}
      </form>
    </div>
  );
}

function ProfitCell({ perUnit, amount }) {
  const negative = amount !== null && Number(amount) < 0;
  return (
    <td className={negative ? "pm-num pm-negative" : "pm-num"}>
      {perUnit !== null ? formatRate(perUnit) : "-"}
      <span className="pm-boq-amount">
        {formatCurrency(amount)}
      </span>
    </td>
  );
}

function CostingBoqRow({
  row,
  canEnter,
  isCollapsed,
  onToggleCollapse,
  onOpenAddChild,
  onOpenEdit,
  onDelete,
}) {
  return (
    <tr>
      <td
        className="pm-boq-desc"
        style={{ paddingLeft: 12 + (row.level - 1) * 20 }}
      >
        {row.has_children ? (
          <button
            type="button"
            className="icon-button pm-boq-toggle"
            onClick={onToggleCollapse}
            aria-label={
              isCollapsed
                ? `Expand ${row.description}`
                : `Collapse ${row.description}`
            }
            aria-expanded={!isCollapsed}
          >
            <ChevronRight
              size={14}
              className={
                isCollapsed
                  ? "pm-boq-toggle__icon"
                  : "pm-boq-toggle__icon pm-boq-toggle__icon--open"
              }
            />
          </button>
        ) : (
          <span className="pm-boq-toggle-spacer" aria-hidden="true" />
        )}
        {row.item_no ? `${row.item_no} - ` : ""}
        {row.description}
      </td>
      <td>{row.unit || "-"}</td>
      <td className="pm-num">
        {row.qty !== null ? formatQty(row.qty) : "-"}
      </td>
      <td className="pm-num">
        {formatRate(row.authority_rate)}
        {row.escalated_authority_rate !== null &&
        row.authority_rate !== null &&
        Number(row.escalated_authority_rate) !==
          Number(row.authority_rate) ? (
          <span className="pm-boq-amount">
            after escalation: {formatRate(row.escalated_authority_rate)}
          </span>
        ) : null}
      </td>
      <td className="pm-num">
        {row.tender_percent !== null
          ? `${Number(row.tender_percent) > 0 ? "+" : ""}${row.tender_percent}%`
          : "-"}
      </td>
      <td className="pm-num">{formatRate(row.bid_rate)}</td>
      <td className="pm-num">{formatCurrency(row.bid_amount)}</td>
      <td className="pm-num">{formatRate(row.our_cost_rate)}</td>
      <td className="pm-num">{formatCurrency(row.cost_amount)}</td>
      <td className="pm-num">
        {row.gst_percent !== null ? `${row.gst_percent}%` : "-"}
      </td>
      <td className="pm-num">
        {formatCurrency(row.bid_amount_incl_gst)}
      </td>
      <ProfitCell
        perUnit={row.profit_per_unit}
        amount={row.profit_amount}
      />
      {canEnter ? (
        <td>
          <div className="table-actions">
            <button
              type="button"
              className="icon-button"
              aria-label={`Add a material under ${row.description}`}
              title="Add a material under this row"
              onClick={onOpenAddChild}
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Edit ${row.description}`}
              onClick={onOpenEdit}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="icon-button icon-button--danger"
              aria-label={`Delete ${row.description}`}
              onClick={onDelete}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      ) : null}
    </tr>
  );
}

const BASE_COLUMN_COUNT = 12;

/**
 * The costing-native BOQ: a static profit/loss sheet (authority rate,
 * bid rate, our cost, GST, profit/loss) that replaces DPR & Bills as
 * where item economics are worked out, now that quantities and
 * billing live in the company ERP instead. Materials are just rows
 * nested under a work item, not a separate mechanism - see
 * ``services.costing_boq`` for the rollup rule.
 */
export function CostingBoqPanel({ siteId, canEnter }) {
  const [openForm, setOpenForm] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const boqQuery = useCostingBoq(siteId);
  const createItem = useCreateCostingBoqItem(siteId);
  const updateItem = useUpdateCostingBoqItem();
  const deleteItem = useDeleteCostingBoqItem();
  const importBoq = useImportCostingBoq(siteId);

  const sheet = boqQuery.data;
  const rows = sheet?.rows ?? [];
  const summary = sheet?.summary;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const columnCount = BASE_COLUMN_COUNT + (canEnter ? 1 : 0);

  const isHidden = (row) => {
    let node = row;
    while (node.parent_id) {
      if (collapsed.has(node.parent_id)) {
        return true;
      }
      node = byId.get(node.parent_id);
      if (!node) {
        return false;
      }
    }
    return false;
  };
  const visibleRows = rows.filter((row) => !isHidden(row));

  const toggleCollapse = (id) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const closeForm = () => setOpenForm(null);

  const handleCreate = (parentId) => (payload) => {
    createItem.mutate(
      { ...payload, parent_id: parentId || undefined },
      { onSuccess: closeForm },
    );
  };

  const handleUpdate = (itemId) => (payload) => {
    updateItem.mutate(
      { itemId, ...payload },
      { onSuccess: closeForm },
    );
  };

  const handleDelete = (row) => {
    if (
      !window.confirm(
        row.has_children
          ? `"${row.description}" has rows under it - delete those first.`
          : `Delete "${row.description}"?`,
      )
    ) {
      return;
    }
    deleteItem.mutate(row.id);
  };

  const handleDownloadTemplate = async () => {
    const blob =
      await projectMonitorService.downloadCostingBoqTemplate();
    saveBlob(blob, "costing-boq-template.xlsx");
  };

  return (
    <div className="pm-stack">
      <CostingContractSettingsCard
        siteId={siteId}
        canEnter={canEnter}
      />

      <div className="pm-boq-toolbar">
        {canEnter ? (
          <button
            type="button"
            className="button button--primary"
            onClick={() =>
              setOpenForm((current) =>
                current?.mode === "add-root" ? null : { mode: "add-root" },
              )
            }
          >
            <Plus size={16} /> Add BOQ item
          </button>
        ) : null}
      </div>

      {openForm?.mode === "add-root" ? (
        <CostingBoqSlideForm
          title="New BOQ item"
          initial={EMPTY_FORM}
          onSave={handleCreate(null)}
          onCancel={closeForm}
          isPending={createItem.isPending}
          error={createItem.isError ? createItem.error : null}
        />
      ) : null}

      {canEnter ? (
        <BulkUploadCard
          title="Bulk import BOQ"
          help="Upload an Excel/CSV with Item no, Description, Unit, Qty and any of Authority rate, Tender %, Bid rate, Our cost and GST %. Rows nest by item number (1, 1.1, 1.1.1). Re-uploading the same file adds nothing."
          templates={[
            { label: "Download template", download: handleDownloadTemplate },
          ]}
          counters={[
            { key: "created", label: "added" },
            { key: "skipped_existing", label: "already existed" },
            {
              key: "skipped_invalid",
              label: "invalid",
              problem: true,
            },
          ]}
          upload={(file) => importBoq.mutateAsync(file)}
        />
      ) : null}

      {boqQuery.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(boqQuery.error)}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="pm-timeline-empty">
          {boqQuery.isLoading
            ? "Loading..."
            : "No BOQ items yet - add the first one above."}
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table pm-boq-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Unit</th>
                <th className="pm-num">Qty</th>
                <th className="pm-num">Authority rate</th>
                <th className="pm-num">Tender %</th>
                <th className="pm-num">Bid rate</th>
                <th className="pm-num">Bid amount</th>
                <th className="pm-num">Our cost rate</th>
                <th className="pm-num">Cost amount</th>
                <th className="pm-num">GST %</th>
                <th className="pm-num">Bid incl. GST</th>
                <th className="pm-num">Profit/loss</th>
                {canEnter ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <Fragment key={row.id}>
                  <CostingBoqRow
                    key={row.id}
                    row={row}
                    canEnter={canEnter}
                    isCollapsed={collapsed.has(row.id)}
                    onToggleCollapse={() => toggleCollapse(row.id)}
                    onOpenAddChild={() =>
                      setOpenForm((current) =>
                        current?.mode === "add-child" &&
                        current.parentId === row.id
                          ? null
                          : { mode: "add-child", parentId: row.id },
                      )
                    }
                    onOpenEdit={() =>
                      setOpenForm((current) =>
                        current?.mode === "edit" &&
                        current.itemId === row.id
                          ? null
                          : { mode: "edit", itemId: row.id },
                      )
                    }
                    onDelete={() => handleDelete(row)}
                  />
                  {openForm?.mode === "add-child" &&
                  openForm.parentId === row.id ? (
                    <tr key={`${row.id}-add`}>
                      <td colSpan={columnCount}>
                        <CostingBoqSlideForm
                          title={`New row under ${row.description}`}
                          initial={EMPTY_FORM}
                          onSave={handleCreate(row.id)}
                          onCancel={closeForm}
                          isPending={createItem.isPending}
                          error={
                            createItem.isError
                              ? createItem.error
                              : null
                          }
                        />
                      </td>
                    </tr>
                  ) : null}
                  {openForm?.mode === "edit" &&
                  openForm.itemId === row.id ? (
                    <tr key={`${row.id}-edit`}>
                      <td colSpan={columnCount}>
                        <CostingBoqSlideForm
                          title={`Edit ${row.description}`}
                          initial={toFormValues(row)}
                          onSave={handleUpdate(row.id)}
                          onCancel={closeForm}
                          isPending={updateItem.isPending}
                          error={
                            updateItem.isError
                              ? updateItem.error
                              : null
                          }
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
            {summary ? (
              <tfoot>
                <tr className="pm-dpr-grid__total">
                  <td colSpan={6}>Contract total</td>
                  <td className="pm-num">
                    {formatCurrency(summary.bid_amount)}
                  </td>
                  <td />
                  <td className="pm-num">
                    {formatCurrency(summary.cost_amount)}
                  </td>
                  <td />
                  <td className="pm-num">
                    {formatCurrency(summary.bid_amount_incl_gst)}
                  </td>
                  <td
                    className={
                      Number(summary.profit_amount) < 0
                        ? "pm-num pm-negative"
                        : "pm-num"
                    }
                  >
                    {formatCurrency(summary.profit_amount)}
                  </td>
                  {canEnter ? <td /> : null}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </div>
  );
}
