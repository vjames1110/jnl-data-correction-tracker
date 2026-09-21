import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  useCreateRaBill,
  useDeleteRaBill,
  useRaBills,
  useUpdateRaBill,
} from "../../../hooks/useProjectMonitor";
import {
  apiErrorMessage,
  parseNumber,
  todayIso,
} from "../utils/finance";
import {
  formatCurrency,
  formatDate,
  formatQty,
} from "../utils/status";

function AddBillForm({ siteId, items, onDone }) {
  const createBill = useCreateRaBill();
  const [kind, setKind] = useState("ITEMS");
  const [amount, setAmount] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(todayIso());
  const [received, setReceived] = useState("");
  const [receivedOn, setReceivedOn] = useState("");
  const [remarks, setRemarks] = useState("");
  const [quantities, setQuantities] = useState({});

  const activeItems = items.filter((item) => item.is_active);
  const isAmountBill = kind === "AMOUNT";

  const handleSubmit = async (event) => {
    event.preventDefault();
    const lines = isAmountBill
      ? []
      : Object.entries(quantities)
          .map(([item, qty]) => ({
            item,
            qty: parseNumber(qty) ?? 0,
          }))
          .filter((line) => line.qty > 0);
    try {
      await createBill.mutateAsync({
        site: siteId,
        bill_no: billNo,
        bill_date: billDate,
        kind,
        ...(isAmountBill
          ? { amount: parseNumber(amount) }
          : { lines }),
        // Blank on an amount bill = the whole amount, received on
        // the bill date (the server fills both in).
        received_amount: parseNumber(received),
        received_on: receivedOn || null,
        remarks,
      });
      onDone();
    } catch {
      // Shown by the inline alert.
    }
  };

  return (
    <form
      className="pm-bill-form print-hidden"
      onSubmit={handleSubmit}
    >
      <div
        className="pm-workspace"
        role="radiogroup"
        aria-label="Kind of bill"
      >
        {[
          ["ITEMS", "Item bill"],
          ["AMOUNT", "Amount against project value"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            className={
              kind === value
                ? "pm-workspace__item pm-workspace__item--active"
                : "pm-workspace__item"
            }
            onClick={() => setKind(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="pm-dpr-toolbar__help">
        {isAmountBill
          ? "A lump sum against the total project value, not tied to any item or quantity. It reduces the balance value and is recorded as received on the bill date."
          : "Bill the quantities executed against the contract items."}
      </p>

      <div className="form-grid">
        <label className="form-field">
          <span>Bill no.</span>
          <input
            type="text"
            value={billNo}
            onChange={(event) =>
              setBillNo(event.target.value)
            }
            required
          />
        </label>
        <label className="form-field">
          <span>Bill date</span>
          <input
            type="date"
            value={billDate}
            onChange={(event) =>
              setBillDate(event.target.value)
            }
            required
          />
        </label>
        {isAmountBill ? (
          <label className="form-field">
            <span>Bill amount (₹)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value)
              }
              required
            />
          </label>
        ) : null}
        <label className="form-field">
          <span>
            {isAmountBill
              ? "Amount received (₹)"
              : "Amount received (₹, optional)"}
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={received}
            onChange={(event) =>
              setReceived(event.target.value)
            }
            placeholder={isAmountBill ? amount : ""}
          />
        </label>
        <label className="form-field">
          <span>Received on</span>
          <input
            type="date"
            value={receivedOn}
            onChange={(event) =>
              setReceivedOn(event.target.value)
            }
            placeholder={isAmountBill ? billDate : ""}
          />
        </label>
        <label
          className="form-field"
          style={{ gridColumn: "1 / -1" }}
        >
          <span>Remarks</span>
          <input
            type="text"
            value={remarks}
            onChange={(event) =>
              setRemarks(event.target.value)
            }
          />
        </label>
      </div>

      {isAmountBill ? null : (
        <>
      <h3>Quantities billed in this bill</h3>
      <div className="pm-table-wrap">
        <table className="pm-report__table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Executed</th>
              <th>Already billed</th>
              <th>Unbilled</th>
              <th>Qty in this bill</th>
            </tr>
          </thead>
          <tbody>
            {activeItems.map((item) => (
              <tr key={item.id}>
                <td className="pm-report__col-task">
                  {item.item_no ? `${item.item_no} - ` : ""}
                  {item.description}
                </td>
                <td>{formatQty(item.executed_qty)}</td>
                <td>{formatQty(item.billed_qty)}</td>
                <td>
                  {formatQty(
                    Number(item.executed_qty) -
                      Number(item.billed_qty),
                  )}
                </td>
                <td>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    className="pm-bill-form__qty"
                    aria-label={`Quantity of ${item.description} in this bill`}
                    value={quantities[item.id] ?? ""}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}

      <div className="pm-inline-row">
        <button
          type="submit"
          className="button button--primary"
          disabled={createBill.isPending}
        >
          Add bill
        </button>
        <button
          type="button"
          className="button button--tertiary"
          onClick={onDone}
        >
          Cancel
        </button>
      </div>
      {createBill.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(createBill.error)}
        </div>
      ) : null}
    </form>
  );
}

function ReceiptEditor({ bill, onDone }) {
  const updateBill = useUpdateRaBill();
  const [amount, setAmount] = useState(
    bill.received_amount ?? "",
  );
  const [date, setDate] = useState(bill.received_on ?? "");

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await updateBill.mutateAsync({
        billId: bill.id,
        payload: {
          received_amount: parseNumber(amount),
          received_on: date || null,
        },
      });
      onDone();
    } catch {
      // Shown below.
    }
  };

  return (
    <form
      className="pm-inline-row"
      onSubmit={handleSubmit}
    >
      <label className="form-field">
        <span>Received (₹)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label className="form-field">
        <span>On</span>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <button
        type="submit"
        className="button button--primary"
        disabled={updateBill.isPending}
      >
        Save
      </button>
      <button
        type="button"
        className="button button--tertiary"
        onClick={onDone}
      >
        Cancel
      </button>
      {updateBill.isError ? (
        <span className="pm-due-tracker__overdue">
          {apiErrorMessage(updateBill.error)}
        </span>
      ) : null}
    </form>
  );
}

/**
 * RA bills and payments. An item bill's gross is computed on the
 * server from the rate each line was billed at; an amount bill is a
 * lump sum against the total project value with no items. Outstanding
 * is gross minus what has been received. Bills raised before this
 * system are summarised by the "billed before" line, not entered one
 * by one.
 */
export function RaBillsPanel({ siteId, items, canEnter }) {
  const billsQuery = useRaBills(siteId, true);
  const deleteBill = useDeleteRaBill();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const data = billsQuery.data;

  return (
    <div>
      <div className="surface-card__header">
        <h2>RA bills &amp; payments received</h2>
        {canEnter && !isAdding ? (
          <button
            type="button"
            className="button button--primary"
            onClick={() => setIsAdding(true)}
          >
            <Plus size={16} /> Add bill
          </button>
        ) : null}
      </div>

      {isAdding ? (
        <AddBillForm
          siteId={siteId}
          items={items}
          onDone={() => setIsAdding(false)}
        />
      ) : null}

      {data?.opening?.billed_value &&
      Number(data.opening.billed_value) > 0 ? (
        <p className="sub">
          Billed before this system:{" "}
          <strong>
            {formatCurrency(data.opening.billed_value)}
          </strong>
          {data.opening.bill_no
            ? ` (last bill ${data.opening.bill_no}, ${formatDate(data.opening.bill_date)})`
            : ""}
        </p>
      ) : null}

      {deleteBill.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(deleteBill.error)}
        </div>
      ) : null}

      {!data || data.bills.length === 0 ? (
        <p className="pm-timeline-empty">
          No RA bills recorded here yet.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table">
            <thead>
              <tr>
                <th>Bill no.</th>
                <th>Date</th>
                <th>Items billed</th>
                <th>Gross value</th>
                <th>Received</th>
                <th>Outstanding</th>
                <th>Remarks</th>
                {canEnter ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {data.bills.map((bill) => (
                <tr key={bill.id}>
                  <td>{bill.bill_no}</td>
                  <td>{formatDate(bill.bill_date)}</td>
                  <td className="pm-report__col-remark">
                    {bill.kind === "AMOUNT"
                      ? "Lump sum against project value"
                      : bill.lines
                          .map(
                            (line) =>
                              `${line.item_no || line.description}: ${formatQty(line.qty)}`,
                          )
                          .join(", ")}
                  </td>
                  <td>{formatCurrency(bill.gross)}</td>
                  <td>
                    {editingId === bill.id ? (
                      <ReceiptEditor
                        bill={bill}
                        onDone={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        {bill.received_amount === null
                          ? "-"
                          : formatCurrency(
                              bill.received_amount,
                            )}
                        {bill.received_on ? (
                          <span className="sub">
                            {" "}
                            · {formatDate(bill.received_on)}
                          </span>
                        ) : null}
                        {canEnter ? (
                          <button
                            type="button"
                            className="button button--tertiary button--sm"
                            onClick={() =>
                              setEditingId(bill.id)
                            }
                          >
                            Edit
                          </button>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td
                    className={
                      Number(bill.outstanding) > 0
                        ? "pm-due-tracker__overdue"
                        : ""
                    }
                  >
                    {formatCurrency(bill.outstanding)}
                  </td>
                  <td>{bill.remarks || "-"}</td>
                  {canEnter ? (
                    <td>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              bill.kind === "AMOUNT"
                                ? `Delete bill ${bill.bill_no}? The amount is added back to the balance value and its payment is removed.`
                                : `Delete bill ${bill.bill_no}? Its quantities become unbilled again.`,
                            )
                          ) {
                            deleteBill.mutate(bill.id);
                          }
                        }}
                        aria-label="Delete bill"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              <tr className="pm-dpr-grid__total">
                <td colSpan={3}>Total</td>
                <td>{formatCurrency(data.totals.gross)}</td>
                <td>{formatCurrency(data.totals.received)}</td>
                <td>
                  {formatCurrency(data.totals.outstanding)}
                </td>
                <td colSpan={canEnter ? 2 : 1} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
