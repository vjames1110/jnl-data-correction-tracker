import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  applyPercent,
  bidRate,
  describePercent,
  suggestChildNumber,
} from "../utils/boq";
import { apiErrorMessage } from "../utils/finance";
import { formatRate } from "../utils/status";

const MAX_LEVEL = 3;

const BLANK = {
  item_no: "",
  description: "",
  unit: "",
  scope_qty: "",
  rate: "",
  authority_rate: "",
  tender_percent: "",
  override_percent: false,
  concrete_per_unit: "0",
  tmt_kg_per_unit: "0",
  is_active: true,
  is_heading: false,
  parent: "",
};

const BLANK_SUB_ITEM = {
  item_no: "",
  description: "",
  unit: "",
  scope_qty: "",
  authority_rate: "",
  rate: "",
};

function isDescendant(item, ancestorId, byId) {
  let node = item;
  let guard = 0;
  while (node?.parent_id && guard < 10) {
    if (node.parent_id === ancestorId) {
      return true;
    }
    node = byId.get(node.parent_id);
    guard += 1;
  }
  return false;
}

function startingForm(initial, presetParent, items) {
  if (initial) {
    return {
      item_no: initial.item_no,
      description: initial.description,
      unit: initial.unit,
      scope_qty: initial.scope_qty,
      rate: initial.rate,
      authority_rate: initial.authority_rate ?? "",
      tender_percent: initial.tender_percent ?? "",
      override_percent: initial.tender_percent !== null &&
        initial.tender_percent !== undefined,
      concrete_per_unit: initial.concrete_per_unit,
      tmt_kg_per_unit: initial.tmt_kg_per_unit,
      is_active: initial.is_active,
      is_heading: Boolean(initial.is_heading),
      parent: initial.parent_id ?? "",
    };
  }
  const parent = items.find((item) => item.id === presetParent);
  return {
    ...BLANK,
    parent: parent ? parent.id : "",
    item_no: parent ? suggestChildNumber(parent, items) : "",
  };
}

/**
 * Add / edit one contract (BOQ) item, laid out the way a Railway BOQ
 * reads: the item, where it sits (top level, under a group, or a group
 * itself with its sub-items), its rates and its material use.
 *
 * With an authority rate, the bid rate the contractor is paid at is
 * worked out here exactly as the server does (authority rate x the
 * tender percentage above / below). Editing a rate never changes the
 * value of quantities already recorded - each DPR entry and bill line
 * keeps the rate it was entered at.
 */
export function DprItemForm({
  initial,
  items = [],
  presetParent = "",
  contractPercent = null,
  escalationPercent = 0,
  onSubmit,
  onCancel,
  isPending,
  error,
}) {
  const [form, setForm] = useState(() =>
    startingForm(initial, presetParent, items),
  );
  const [numberTouched, setNumberTouched] = useState(
    Boolean(initial),
  );
  const [subItems, setSubItems] = useState([]);

  const byId = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const groupChoices = useMemo(
    () =>
      items.filter(
        (item) =>
          item.is_heading &&
          (item.level ?? 1) < MAX_LEVEL &&
          (!initial ||
            (item.id !== initial.id &&
              !isDescendant(item, initial.id, byId))),
      ),
    [items, initial, byId],
  );

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const hasRecordedWork =
    initial &&
    (Number(initial.executed_qty || 0) > 0 ||
      Number(initial.billed_qty || 0) > 0);
  const lockGroupToggle = Boolean(
    initial &&
      (initial.has_children ||
        (!initial.is_heading && hasRecordedWork)),
  );

  const handleParentChange = (value) => {
    setForm((current) => {
      const next = { ...current, parent: value };
      if (!numberTouched) {
        next.item_no = suggestChildNumber(byId.get(value), items);
      }
      return next;
    });
  };

  const updateSubItem = (index, key, value) =>
    setSubItems((current) =>
      current.map((row, position) =>
        position === index ? { ...row, [key]: value } : row,
      ),
    );

  const applied = form.override_percent
    ? form.tender_percent
    : contractPercent;
  const computedBid = bidRate(
    form.authority_rate,
    form.override_percent ? form.tender_percent : null,
    contractPercent,
  );
  const usesAuthority =
    form.authority_rate !== "" && form.authority_rate !== null;
  const todayRate = usesAuthority
    ? computedBid
    : Number(form.rate || 0);
  const escalatedRate =
    todayRate === null || !Number(escalationPercent)
      ? null
      : applyPercent(todayRate, escalationPercent);

  const handleSubmit = (event) => {
    event.preventDefault();
    const position = { parent: form.parent || null };

    if (form.is_heading) {
      onSubmit({
        item_no: form.item_no,
        description: form.description,
        unit: "",
        is_heading: true,
        ...position,
        ...(initial
          ? {
              scope_qty: "0",
              rate: "0",
              authority_rate: null,
              tender_percent: null,
              concrete_per_unit: "0",
              tmt_kg_per_unit: "0",
              is_active: form.is_active,
            }
          : {
              children: subItems
                .filter((row) => row.description.trim())
                .map((row) => ({
                  item_no: row.item_no,
                  description: row.description,
                  unit: row.unit,
                  scope_qty: row.scope_qty || "0",
                  authority_rate: row.authority_rate || null,
                  ...(row.authority_rate
                    ? {}
                    : { rate: row.rate || "0" }),
                })),
            }),
      });
      return;
    }

    onSubmit({
      item_no: form.item_no,
      description: form.description,
      unit: form.unit,
      is_heading: false,
      ...position,
      scope_qty: form.scope_qty || "0",
      rate: usesAuthority
        ? String(computedBid ?? 0)
        : form.rate || "0",
      authority_rate: usesAuthority ? form.authority_rate : null,
      tender_percent:
        usesAuthority && form.override_percent
          ? form.tender_percent || null
          : null,
      concrete_per_unit: form.concrete_per_unit || "0",
      tmt_kg_per_unit: form.tmt_kg_per_unit || "0",
      ...(initial ? { is_active: form.is_active } : {}),
    });
  };

  return (
    <form className="pm-item-form" onSubmit={handleSubmit}>
      <section className="pm-item-form__section">
        <h3>Item</h3>
        <div className="form-grid">
          <label className="form-field">
            <span>Item no.</span>
            <input
              type="text"
              value={form.item_no}
              onChange={(event) => {
                setNumberTouched(true);
                setField("item_no", event.target.value);
              }}
              placeholder="e.g. 4.2"
            />
          </label>
          {form.is_heading ? null : (
            <label className="form-field">
              <span>Unit</span>
              <input
                type="text"
                value={form.unit}
                onChange={(event) =>
                  setField("unit", event.target.value)
                }
                placeholder="e.g. cum"
              />
            </label>
          )}
          <label
            className="form-field"
            style={{ gridColumn: "1 / -1" }}
          >
            <span>Description</span>
            <input
              type="text"
              value={form.description}
              onChange={(event) =>
                setField("description", event.target.value)
              }
              required
            />
          </label>
          {form.is_heading ? null : (
            <label className="form-field">
              <span>Scope quantity</span>
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.scope_qty}
                onChange={(event) =>
                  setField("scope_qty", event.target.value)
                }
              />
            </label>
          )}
        </div>
      </section>

      <section className="pm-item-form__section">
        <h3>Position</h3>
        <div className="form-grid">
          <label className="form-field">
            <span>Sits under</span>
            <select
              value={form.parent}
              onChange={(event) =>
                handleParentChange(event.target.value)
              }
            >
              <option value="">Top level</option>
              {groupChoices.map((group) => (
                <option key={group.id} value={group.id}>
                  {" ".repeat((group.level ?? 1) - 1)}
                  {group.item_no ? `${group.item_no} ` : ""}
                  {group.description}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={form.is_heading}
              disabled={lockGroupToggle}
              onChange={(event) =>
                setField("is_heading", event.target.checked)
              }
            />
            This is a group (heading)
          </label>
        </div>
        <p className="form-help">
          {form.is_heading
            ? "A group has no quantity or rate of its own - it adds up the items under it. Only items take DPR entries and bills."
            : "Pick a group to put this item under it, or leave it at the top level."}
          {lockGroupToggle
            ? initial?.has_children
              ? " This group has items under it, so it must stay a group."
              : " This item already has DPR entries or bills, so it cannot become a group."
            : ""}
        </p>

        {form.is_heading && !initial ? (
          <div className="pm-item-form__subitems">
            <div className="pm-item-form__subitems-head">
              <strong>Sub-items</strong>
              <button
                type="button"
                className="button button--tertiary button--sm"
                onClick={() =>
                  setSubItems((current) => [
                    ...current,
                    { ...BLANK_SUB_ITEM },
                  ])
                }
              >
                <Plus size={14} /> Add sub-item
              </button>
            </div>
            {subItems.length === 0 ? (
              <p className="form-help">
                Add the items that sit under this group now, or
                add them one by one later with the + on the
                group&apos;s row.
              </p>
            ) : (
              <div className="pm-table-wrap">
                <table className="pm-item-form__table">
                  <thead>
                    <tr>
                      <th>Item no.</th>
                      <th>Description</th>
                      <th>Unit</th>
                      <th>Qty</th>
                      <th>Authority rate</th>
                      <th>Rate (₹)</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {subItems.map((row, index) => {
                      const bid = bidRate(
                        row.authority_rate,
                        null,
                        contractPercent,
                      );
                      return (
                        <tr key={index}>
                          <td>
                            <input
                              type="text"
                              aria-label={`Sub-item ${index + 1} number`}
                              value={row.item_no}
                              placeholder={
                                form.item_no
                                  ? `${form.item_no}.${index + 1}`
                                  : ""
                              }
                              onChange={(event) =>
                                updateSubItem(
                                  index,
                                  "item_no",
                                  event.target.value,
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              aria-label={`Sub-item ${index + 1} description`}
                              value={row.description}
                              onChange={(event) =>
                                updateSubItem(
                                  index,
                                  "description",
                                  event.target.value,
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              aria-label={`Sub-item ${index + 1} unit`}
                              value={row.unit}
                              onChange={(event) =>
                                updateSubItem(
                                  index,
                                  "unit",
                                  event.target.value,
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              aria-label={`Sub-item ${index + 1} quantity`}
                              value={row.scope_qty}
                              onChange={(event) =>
                                updateSubItem(
                                  index,
                                  "scope_qty",
                                  event.target.value,
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              aria-label={`Sub-item ${index + 1} authority rate`}
                              value={row.authority_rate}
                              onChange={(event) =>
                                updateSubItem(
                                  index,
                                  "authority_rate",
                                  event.target.value,
                                )
                              }
                            />
                          </td>
                          <td>
                            {row.authority_rate ? (
                              <span
                                className="pm-item-form__calc"
                                title="Worked out from the authority rate"
                              >
                                {bid === null
                                  ? "-"
                                  : formatRate(bid)}
                              </span>
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                aria-label={`Sub-item ${index + 1} rate`}
                                value={row.rate}
                                onChange={(event) =>
                                  updateSubItem(
                                    index,
                                    "rate",
                                    event.target.value,
                                  )
                                }
                              />
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-button icon-button--danger"
                              aria-label={`Remove sub-item ${index + 1}`}
                              onClick={() =>
                                setSubItems((current) =>
                                  current.filter(
                                    (_row, position) =>
                                      position !== index,
                                  ),
                                )
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {form.is_heading ? null : (
        <>
          <section className="pm-item-form__section">
            <h3>Rates</h3>
            <div className="form-grid">
              <label className="form-field">
                <span>Authority rate (₹)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.authority_rate}
                  onChange={(event) =>
                    setField(
                      "authority_rate",
                      event.target.value,
                    )
                  }
                  placeholder="Railway estimated / schedule rate"
                />
              </label>
              {usesAuthority ? (
                <div className="form-field">
                  <span>Tender % over the authority rate</span>
                  <div className="pm-item-form__percent">
                    {form.override_percent ? (
                      <input
                        type="number"
                        step="0.001"
                        min="-100"
                        max="500"
                        aria-label="Tender percentage for this item"
                        value={form.tender_percent}
                        onChange={(event) =>
                          setField(
                            "tender_percent",
                            event.target.value,
                          )
                        }
                        placeholder="+ above / - below"
                      />
                    ) : (
                      <span className="pm-item-form__calc">
                        Contract-wide:{" "}
                        {describePercent(contractPercent)}
                      </span>
                    )}
                    <label className="toggle-field">
                      <input
                        type="checkbox"
                        checked={form.override_percent}
                        onChange={(event) =>
                          setField(
                            "override_percent",
                            event.target.checked,
                          )
                        }
                      />
                      Different % for this item
                    </label>
                  </div>
                </div>
              ) : (
                <label className="form-field">
                  <span>Contract rate (₹)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.rate}
                    onChange={(event) =>
                      setField("rate", event.target.value)
                    }
                  />
                </label>
              )}
            </div>
            {usesAuthority ? (
              <div
                className="pm-item-form__result"
                aria-live="polite"
              >
                <span>Our bid rate</span>
                <strong>
                  {computedBid === null
                    ? "-"
                    : formatRate(computedBid)}
                </strong>
                <small>
                  = authority rate{" "}
                  {formatRate(form.authority_rate)}{" "}
                  {applied === null ||
                  applied === "" ||
                  applied === undefined
                    ? "(no tender percentage set yet)"
                    : `at ${describePercent(applied)}`}
                </small>
              </div>
            ) : (
              <p className="form-help">
                Leave the authority rate blank to type the rate you
                are paid at directly.
              </p>
            )}
            {escalatedRate !== null ? (
              <p className="form-help">
                With the contract escalation of{" "}
                {escalationPercent}% in force today, new entries
                and bills are priced at{" "}
                <strong>{formatRate(escalatedRate)}</strong>.
                Work already recorded keeps its own rate.
              </p>
            ) : null}
          </section>

          <section className="pm-item-form__section">
            <h3>Materials</h3>
            <div className="form-grid">
              <label className="form-field">
                <span>Concrete per unit (cum)</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.concrete_per_unit}
                  onChange={(event) =>
                    setField(
                      "concrete_per_unit",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label className="form-field">
                <span>TMT per unit (kg)</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.tmt_kg_per_unit}
                  onChange={(event) =>
                    setField(
                      "tmt_kg_per_unit",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
            <p className="form-help">
              Concrete and TMT per unit link this item to the
              material rates in Costing (Rates &amp; production) -
              leave 0 if the item consumes neither.
            </p>
          </section>
        </>
      )}

      {initial ? (
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) =>
              setField("is_active", event.target.checked)
            }
          />
          Active (shown in the grid)
        </label>
      ) : null}

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
          {apiErrorMessage(error)}
        </div>
      ) : null}
    </form>
  );
}
