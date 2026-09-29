import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";

import {
  useItemLinks,
  useSaveItemLink,
} from "../../../hooks/useProjectMonitor";
import { apiErrorMessage, parseNumber } from "../utils/finance";
import {
  formatCurrency,
  formatDate,
  formatRate,
} from "../utils/status";

const quantity = (value) =>
  Number(value ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 3,
  });

const formatPercent = (value) =>
  value === null || value === undefined
    ? "-"
    : `${Number(value) > 0 ? "+" : ""}${Number(value).toLocaleString(
        "en-IN",
        { maximumFractionDigits: 2 },
      )}%`;

function RateChip({ label, unit, rate }) {
  return (
    <span
      className={
        rate?.rate
          ? "status-chip status-chip--success"
          : "status-chip status-chip--warning"
      }
    >
      {rate?.rate
        ? `${label}: ${formatCurrency(rate.rate)} / ${unit} (from ${formatDate(rate.effective_from)})`
        : `${label}: no rate set`}
    </span>
  );
}

function StateChip({ row }) {
  if (row.missing_rate) {
    return (
      <span className="status-chip status-chip--warning">
        Needs a rate
      </span>
    );
  }
  if (!row.linked) {
    return (
      <span className="status-chip">No material use</span>
    );
  }
  return (
    <span className="status-chip status-chip--success">
      Linked
    </span>
  );
}

function EditRow({ row, onDone }) {
  const save = useSaveItemLink();
  const [concrete, setConcrete] = useState(
    row.concrete_per_unit,
  );
  const [tmt, setTmt] = useState(row.tmt_kg_per_unit);

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        itemId: row.id,
        concrete_per_unit: parseNumber(concrete) ?? 0,
        tmt_kg_per_unit: parseNumber(tmt) ?? 0,
      });
      onDone();
    } catch {
      // Shown under the table.
    }
  };

  return (
    <tr>
      <td>
        {row.item_no ? `${row.item_no} - ` : ""}
        {row.description}
      </td>
      <td>{row.unit || "-"}</td>
      <td className="pm-num">
        {formatRate(row.authority_rate)}
      </td>
      <td className="pm-num">
        {formatPercent(row.tender_percent)}
      </td>
      <td className="pm-num">
        {formatRate(row.bid_rate)}
      </td>
      <td className="pm-num">
        {formatRate(row.contract_rate)}
      </td>
      <td className="pm-num">
        {quantity(row.executed_qty)}
      </td>
      <td className="pm-num">
        {formatCurrency(row.executed_value)}
      </td>
      <td className="pm-num">
        <input
          type="number"
          step="0.001"
          min="0"
          aria-label={`Concrete per ${row.unit || "unit"} for ${row.description}`}
          value={concrete}
          onChange={(event) => setConcrete(event.target.value)}
        />
      </td>
      <td className="pm-num">
        <input
          type="number"
          step="0.001"
          min="0"
          aria-label={`TMT kg per ${row.unit || "unit"} for ${row.description}`}
          value={tmt}
          onChange={(event) => setTmt(event.target.value)}
        />
      </td>
      <td colSpan={5}>
        <div className="pm-hr-actions">
          <button
            type="button"
            className="button button--primary button--sm"
            onClick={handleSave}
            disabled={save.isPending}
          >
            <Check size={14} /> Save
          </button>
          <button
            type="button"
            className="button button--tertiary button--sm"
            onClick={onDone}
          >
            <X size={14} /> Cancel
          </button>
        </div>
        {save.isError ? (
          <div className="inline-alert inline-alert--error">
            {apiErrorMessage(save.error)}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * Every DPR & Bills item's cost story in one table: the Railway BOQ
 * rates it was won at (authority rate, tender %, bid rate, today's
 * escalated rate), what has actually been executed and its true
 * value, and - by setting how much concrete/TMT one unit uses - the
 * material cost and margin that implies, both per unit and to date.
 * Items themselves are still added in DPR & Bills (that is where
 * quantities are entered against them); this table is where their
 * profitability is read.
 */
export function ItemLinksPanel({ siteId, canEnter }) {
  const linksQuery = useItemLinks(siteId, true);
  const [editingId, setEditingId] = useState(null);
  const data = linksQuery.data;
  const rows = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div className="pm-stack">
      <p className="pm-dpr-toolbar__help">
        Authority rate, tender % and bid rate come from each item's
        BOQ setup in DPR &amp; Bills (Add BOQ item &gt; Rates) - this table
        only reads them. Set how much concrete (cum) and TMT steel
        (kg) one unit of an item uses below and Costing prices that at
        the rates above, against what has actually been executed, so
        you can see whether each item is running at a profit or a
        loss. An item with no material use set costs nothing here (its
        margin is simply its full rate).
      </p>

      {data ? (
        <div className="pm-inline-row">
          <RateChip
            label="Concrete"
            unit="cum"
            rate={data.rates?.CONCRETE}
          />
          <RateChip
            label="TMT"
            unit="MT"
            rate={data.rates?.TMT}
          />
        </div>
      ) : null}

      {summary ? (
        <p className="pm-dpr-toolbar__help">
          {summary.total} items · {summary.linked} linked ·{" "}
          {summary.unlinked} with no material use
          {summary.missing_rate
            ? ` · ${summary.missing_rate} need a rate above`
            : ""}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="pm-timeline-empty">
          {linksQuery.isLoading
            ? "Loading items..."
            : "No DPR items for this project yet - add its contract items in DPR & Bills first."}
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table pm-links-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Unit</th>
                <th className="pm-num">Authority rate</th>
                <th className="pm-num">Tender %</th>
                <th className="pm-num">Bid rate</th>
                <th className="pm-num">Rate today</th>
                <th className="pm-num">Executed qty</th>
                <th className="pm-num">Executed value</th>
                <th className="pm-num">Concrete per unit (cum)</th>
                <th className="pm-num">TMT per unit (kg)</th>
                <th className="pm-num">Material cost per unit</th>
                <th className="pm-num">Material cost to date</th>
                <th className="pm-num">Margin per unit</th>
                <th className="pm-num">Margin to date</th>
                <th>Status</th>
                {canEnter ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                editingId === row.id ? (
                  <EditRow
                    key={row.id}
                    row={row}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <tr key={row.id}>
                    <td>
                      {row.item_no ? `${row.item_no} - ` : ""}
                      {row.description}
                    </td>
                    <td>{row.unit || "-"}</td>
                    <td className="pm-num">
                      {formatRate(row.authority_rate)}
                    </td>
                    <td className="pm-num">
                      {formatPercent(row.tender_percent)}
                    </td>
                    <td className="pm-num">
                      {formatRate(row.bid_rate)}
                    </td>
                    <td className="pm-num">
                      {formatRate(row.contract_rate)}
                    </td>
                    <td className="pm-num">
                      {quantity(row.executed_qty)}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.executed_value)}
                    </td>
                    <td className="pm-num">
                      {row.concrete_per_unit > 0
                        ? quantity(row.concrete_per_unit)
                        : "-"}
                    </td>
                    <td className="pm-num">
                      {row.tmt_kg_per_unit > 0
                        ? quantity(row.tmt_kg_per_unit)
                        : "-"}
                    </td>
                    <td className="pm-num">
                      {row.linked
                        ? formatRate(row.material_cost_per_unit)
                        : "-"}
                    </td>
                    <td className="pm-num">
                      {row.linked
                        ? formatCurrency(row.material_cost_to_date)
                        : "-"}
                    </td>
                    <td
                      className={
                        row.linked && row.margin_per_unit < 0
                          ? "pm-num pm-negative"
                          : "pm-num"
                      }
                    >
                      {row.linked
                        ? `${formatRate(row.margin_per_unit)}${
                            row.margin_percent !== null
                              ? ` (${Number(row.margin_percent).toFixed(1)}%)`
                              : ""
                          }`
                        : "-"}
                    </td>
                    <td
                      className={
                        row.linked && row.margin_to_date < 0
                          ? "pm-num pm-negative"
                          : "pm-num"
                      }
                    >
                      {row.linked
                        ? formatCurrency(row.margin_to_date)
                        : "-"}
                    </td>
                    <td>
                      <StateChip row={row} />
                    </td>
                    {canEnter ? (
                      <td>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Edit material use of ${row.description}`}
                          title="Edit material use"
                          onClick={() => setEditingId(row.id)}
                        >
                          <Pencil size={15} />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {linksQuery.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(linksQuery.error)}
        </div>
      ) : null}
    </div>
  );
}
