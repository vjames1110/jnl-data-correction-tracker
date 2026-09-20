import { Trash2 } from "lucide-react";
import { useState } from "react";

import {
  useCreateFuel,
  useDeleteFuel,
  useDeleteMachineUsage,
  useFuelEntries,
  useMachines,
  useMachineUsage,
  useSaveMachineUsage,
  useUploadMachinery,
} from "../../../hooks/useProjectMonitor";
import { projectMonitorService } from "../../../services/projectMonitorService";
import {
  apiErrorMessage,
  parseNumber,
  todayIso,
} from "../utils/finance";
import { BASIS_LABELS } from "../utils/machinery";
import {
  formatCurrency,
  formatDate,
  formatQty,
} from "../utils/status";
import { FeedUploadControls } from "./FeedUploadControls";

const RESULT_LABELS = {
  usage_created: "machine days added",
  usage_updated: "machine days updated",
  usage_unchanged: "machine days unchanged",
  fuel_created: "fuel rows added",
  fuel_duplicate: "fuel already recorded",
  machines_created: "new machines to review",
  site_not_found: "unknown site code",
  not_permitted: "not permitted",
  invalid: "invalid",
};
const UNIT_WORD = {
  DAY: "days",
  HOUR: "hours",
  MONTH: "days",
};

function UsageForm({ machines }) {
  const saveUsage = useSaveMachineUsage();
  const active = machines.filter((machine) => machine.is_active);
  const [form, setForm] = useState({
    machine: "",
    date: todayIso(),
    qty: "",
    hire_amount: "",
    maintenance: "",
    other: "",
    remarks: "",
  });
  const machine = active.find(
    (candidate) => candidate.id === form.machine,
  );

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await saveUsage.mutateAsync({
        machine: form.machine,
        date: form.date,
        qty: parseNumber(form.qty) ?? 0,
        hire_amount: parseNumber(form.hire_amount),
        maintenance: parseNumber(form.maintenance) ?? 0,
        other: parseNumber(form.other) ?? 0,
        remarks: form.remarks,
      });
      setForm((current) => ({
        ...current,
        qty: "",
        hire_amount: "",
        maintenance: "",
        other: "",
        remarks: "",
      }));
    } catch {
      // Shown by the inline alert.
    }
  };

  const expected =
    machine && parseNumber(form.qty)
      ? (machine.hire_basis === "MONTH"
          ? Number(machine.rate) / 30
          : Number(machine.rate)) * parseNumber(form.qty)
      : null;

  return (
    <form
      className="form-grid pm-hr-form print-hidden"
      onSubmit={handleSubmit}
    >
      <label className="form-field">
        <span>Machine</span>
        <select
          value={form.machine}
          onChange={(event) =>
            setField("machine", event.target.value)
          }
          required
        >
          <option value="">Select machine</option>
          {active.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.reg_no ? ` (${option.reg_no})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>Date</span>
        <input
          type="date"
          value={form.date}
          max={todayIso()}
          onChange={(event) =>
            setField("date", event.target.value)
          }
          required
        />
      </label>
      <label className="form-field">
        <span>
          Worked ({machine
            ? UNIT_WORD[machine.hire_basis]
            : "days / hours"})
        </span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.qty}
          onChange={(event) =>
            setField("qty", event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Hire (₹) - blank = from rate</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.hire_amount}
          onChange={(event) =>
            setField("hire_amount", event.target.value)
          }
          placeholder={
            expected !== null ? expected.toFixed(2) : ""
          }
        />
      </label>
      <label className="form-field">
        <span>Maintenance (₹)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.maintenance}
          onChange={(event) =>
            setField("maintenance", event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Other (₹)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.other}
          onChange={(event) =>
            setField("other", event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Remarks</span>
        <input
          type="text"
          value={form.remarks}
          onChange={(event) =>
            setField("remarks", event.target.value)
          }
        />
      </label>
      <div className="pm-inline-row">
        <button
          type="submit"
          className="button button--primary"
          disabled={saveUsage.isPending}
        >
          Save machine day
        </button>
      </div>
      <p className="pm-dpr-toolbar__help">
        One row per machine per day - saving the same machine
        and day again replaces it.
        {machine
          ? ` ${machine.name} is hired ${BASIS_LABELS[machine.hire_basis].toLowerCase()} at ${formatCurrency(machine.rate)}.`
          : ""}
      </p>
      {saveUsage.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(saveUsage.error)}
        </div>
      ) : null}
    </form>
  );
}

function FuelForm({ siteId, machines }) {
  const createFuel = useCreateFuel();
  const [form, setForm] = useState({
    machine: "",
    date: todayIso(),
    litres: "",
    rate: "",
    remarks: "",
  });

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const total =
    (parseNumber(form.litres) ?? 0) *
    (parseNumber(form.rate) ?? 0);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await createFuel.mutateAsync({
        site: siteId,
        machine: form.machine || null,
        date: form.date,
        litres: parseNumber(form.litres),
        rate: parseNumber(form.rate),
        remarks: form.remarks,
      });
      setForm((current) => ({
        ...current,
        litres: "",
        remarks: "",
      }));
    } catch {
      // Shown by the inline alert.
    }
  };

  return (
    <form
      className="form-grid pm-hr-form print-hidden"
      onSubmit={handleSubmit}
    >
      <label className="form-field">
        <span>Fuel for</span>
        <select
          value={form.machine}
          onChange={(event) =>
            setField("machine", event.target.value)
          }
        >
          <option value="">Site fuel (no machine)</option>
          {machines.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>Date</span>
        <input
          type="date"
          value={form.date}
          max={todayIso()}
          onChange={(event) =>
            setField("date", event.target.value)
          }
          required
        />
      </label>
      <label className="form-field">
        <span>Litres</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.litres}
          onChange={(event) =>
            setField("litres", event.target.value)
          }
          required
        />
      </label>
      <label className="form-field">
        <span>Price per litre (₹)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.rate}
          onChange={(event) =>
            setField("rate", event.target.value)
          }
          required
        />
      </label>
      <label className="form-field">
        <span>Remarks</span>
        <input
          type="text"
          value={form.remarks}
          onChange={(event) =>
            setField("remarks", event.target.value)
          }
        />
      </label>
      <div className="pm-inline-row">
        <button
          type="submit"
          className="button button--primary"
          disabled={createFuel.isPending}
        >
          Add fuel{total ? ` (${formatCurrency(total)})` : ""}
        </button>
      </div>
      {createFuel.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(createFuel.error)}
        </div>
      ) : null}
    </form>
  );
}

/** Daily machine usage and fuel: entry forms, upload and registers. */
export function MachineUsagePanel({
  siteId,
  month,
  canEnter,
}) {
  const machinesQuery = useMachines(siteId, true);
  const usageQuery = useMachineUsage(siteId, month, true);
  const fuelQuery = useFuelEntries(siteId, month, true);
  const deleteUsage = useDeleteMachineUsage();
  const deleteFuel = useDeleteFuel();
  const machines = machinesQuery.data ?? [];
  const usage = usageQuery.data ?? [];
  const fuel = fuelQuery.data ?? [];

  return (
    <div className="pm-stack">
      {canEnter ? (
        machines.length === 0 ? (
          <p className="pm-timeline-empty">
            Register the site&apos;s machines first (Machines
            tab), or upload a file - unknown machines are
            created for review.
          </p>
        ) : (
          <>
            <h3 className="pm-hr-subheading">
              Machine day
            </h3>
            <UsageForm machines={machines} />
            <h3 className="pm-hr-subheading">Fuel</h3>
            <FuelForm siteId={siteId} machines={machines} />
          </>
        )
      ) : null}
      {canEnter ? (
        <FeedUploadControls
          siteId={siteId}
          useUpload={useUploadMachinery}
          downloadTemplate={
            projectMonitorService.downloadMachineryTemplate
          }
          templateFilename="machinery-upload-template.xlsx"
          resultLabels={RESULT_LABELS}
          help="Excel (.xlsx) or CSV with Project (site code), Date, Machine, Source (Market/HO), Days-hrs, Hire cost, Fuel litres, Fuel cost, Maintenance, Other and Remarks. Hire cost blank = from the machine's rate; fuel litres need a fuel cost. A machine name nobody registered is created and flagged for review."
        />
      ) : null}

      {deleteUsage.isError || deleteFuel.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(
            deleteUsage.error || deleteFuel.error,
          )}
        </div>
      ) : null}

      <div>
        <h3 className="pm-hr-subheading">
          Machine days this month
        </h3>
        {usage.length === 0 ? (
          <p className="pm-timeline-empty">
            No machine days recorded for this month.
          </p>
        ) : (
          <div className="pm-table-wrap">
            <table className="pm-report__table pm-hr-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Machine</th>
                  <th className="pm-num">Days / hrs</th>
                  <th className="pm-num">Hire</th>
                  <th className="pm-num">Maintenance</th>
                  <th className="pm-num">Other</th>
                  <th>Remarks</th>
                  {canEnter ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {usage.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date)}</td>
                    <td>{row.machine_name}</td>
                    <td className="pm-num">
                      {formatQty(row.qty)}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.hire_amount)}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.maintenance)}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.other)}
                    </td>
                    <td>{row.remarks || "-"}</td>
                    {canEnter ? (
                      <td>
                        <button
                          type="button"
                          className="icon-button icon-button--danger"
                          aria-label="Delete machine day"
                          title="Delete"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete ${row.machine_name} on ${formatDate(row.date)}?`,
                              )
                            ) {
                              deleteUsage.mutate(row.id);
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="pm-hr-subheading">
          Fuel this month
        </h3>
        {fuel.length === 0 ? (
          <p className="pm-timeline-empty">
            No fuel recorded for this month.
          </p>
        ) : (
          <div className="pm-table-wrap">
            <table className="pm-report__table pm-hr-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>For</th>
                  <th className="pm-num">Litres</th>
                  <th className="pm-num">Rate / L</th>
                  <th className="pm-num">Amount</th>
                  <th>Remarks</th>
                  {canEnter ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {fuel.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date)}</td>
                    <td>
                      {row.machine_name || "Site fuel"}
                    </td>
                    <td className="pm-num">
                      {formatQty(row.litres)}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.rate)}
                    </td>
                    <td className="pm-num">
                      {formatCurrency(row.amount)}
                    </td>
                    <td>{row.remarks || "-"}</td>
                    {canEnter ? (
                      <td>
                        <button
                          type="button"
                          className="icon-button icon-button--danger"
                          aria-label="Delete fuel entry"
                          title="Delete"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete this fuel entry (${formatDate(row.date)})?`,
                              )
                            ) {
                              deleteFuel.mutate(row.id);
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
