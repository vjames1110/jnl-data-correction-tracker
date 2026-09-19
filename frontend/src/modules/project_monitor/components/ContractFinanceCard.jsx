import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { useUpdateDprContract } from "../../../hooks/useProjectMonitor";
import {
  apiErrorMessage,
  parseNumber,
} from "../utils/finance";
import {
  formatCurrency,
  formatDate,
} from "../utils/status";

const BLANK = {
  contract_no: "",
  varied_value: "",
  opening_billed_value: "",
  opening_bill_no: "",
  opening_bill_date: "",
};

/**
 * The finance facts that live on the Site rather than in the DPR:
 * LOA number, value as varied, and what was already billed before RA
 * bills were recorded here (so the running total starts right).
 */
export function ContractFinanceCard({
  siteId,
  contract,
  canEnter,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(BLANK);
  const updateContract = useUpdateDprContract(siteId);

  const startEditing = () => {
    setForm({
      contract_no: contract.contract_no ?? "",
      varied_value: contract.varied_value ?? "",
      opening_billed_value:
        contract.opening_billed_value ?? "",
      opening_bill_no: contract.opening_bill_no ?? "",
      opening_bill_date: contract.opening_bill_date ?? "",
    });
    setIsOpen(true);
    setIsEditing(true);
  };

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async (event) => {
    event.preventDefault();
    try {
      await updateContract.mutateAsync({
        contract_no: form.contract_no,
        varied_value: parseNumber(form.varied_value),
        opening_billed_value:
          parseNumber(form.opening_billed_value) ?? 0,
        opening_bill_no: form.opening_bill_no,
        opening_bill_date: form.opening_bill_date || null,
      });
      setIsEditing(false);
    } catch {
      // The inline alert below shows the error.
    }
  };

  const cards = [
    ["Contract / LOA no.", contract.contract_no || "-"],
    ["Original value", formatCurrency(contract.original_value)],
    [
      "Value as varied",
      contract.varied_value === null
        ? "Same as original"
        : formatCurrency(contract.varied_value),
    ],
    [
      "Billed before this system",
      formatCurrency(contract.opening_billed_value),
    ],
    [
      "Last bill before this system",
      contract.opening_bill_no
        ? `${contract.opening_bill_no} · ${formatDate(contract.opening_bill_date)}`
        : "-",
    ],
  ];

  return (
    <SurfaceCard className="print-hidden">
      <div
        className={`surface-card__header ${isOpen ? "" : "pm-collapse-header--closed"}`}
      >
        <button
          type="button"
          className="pm-collapse-toggle"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
          <h2>Contract &amp; billing details</h2>
        </button>
        {!isOpen ? (
          <span className="sub pm-collapse-summary">
            {contract.contract_no
              ? `LOA ${contract.contract_no}`
              : "LOA not set"}{" "}
            · Billed before this system{" "}
            {formatCurrency(contract.opening_billed_value)}
          </span>
        ) : canEnter && !isEditing ? (
          <button
            type="button"
            className="button button--tertiary button--sm"
            onClick={startEditing}
          >
            Edit
          </button>
        ) : null}
      </div>

      {!isOpen ? null : isEditing ? (
        <form
          className="form-grid"
          onSubmit={handleSave}
        >
          <label className="form-field">
            <span>Contract / LOA no.</span>
            <input
              type="text"
              value={form.contract_no}
              onChange={(event) =>
                setField("contract_no", event.target.value)
              }
            />
          </label>
          <label className="form-field">
            <span>Value as varied (₹)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.varied_value}
              onChange={(event) =>
                setField(
                  "varied_value",
                  event.target.value,
                )
              }
              placeholder="Leave blank if unchanged"
            />
          </label>
          <label className="form-field">
            <span>Billed before this system (₹, gross)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.opening_billed_value}
              onChange={(event) =>
                setField(
                  "opening_billed_value",
                  event.target.value,
                )
              }
            />
          </label>
          <label className="form-field">
            <span>Last bill no. before this system</span>
            <input
              type="text"
              value={form.opening_bill_no}
              onChange={(event) =>
                setField(
                  "opening_bill_no",
                  event.target.value,
                )
              }
            />
          </label>
          <label className="form-field">
            <span>Last bill date before this system</span>
            <input
              type="date"
              value={form.opening_bill_date}
              onChange={(event) =>
                setField(
                  "opening_bill_date",
                  event.target.value,
                )
              }
            />
          </label>
          <div className="pm-inline-row">
            <button
              type="submit"
              className="button button--primary"
              disabled={updateContract.isPending}
            >
              Save
            </button>
            <button
              type="button"
              className="button button--tertiary"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
          {updateContract.isError ? (
            <div className="inline-alert inline-alert--error">
              {apiErrorMessage(updateContract.error)}
            </div>
          ) : null}
        </form>
      ) : (
        <dl className="pm-detail-cards">
          {cards.map(([label, value]) => (
            <div className="pm-detail-card" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </SurfaceCard>
  );
}
