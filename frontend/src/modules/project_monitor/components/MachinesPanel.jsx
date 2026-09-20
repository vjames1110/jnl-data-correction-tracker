import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  useCreateMachine,
  useDeleteMachine,
  useMachines,
  useUpdateMachine,
} from "../../../hooks/useProjectMonitor";
import {
  apiErrorMessage,
  parseNumber,
} from "../utils/finance";
import {
  BASIS_LABELS,
  SOURCE_LABELS,
} from "../utils/machinery";
import { formatCurrency } from "../utils/status";


const BLANK = {
  name: "",
  reg_no: "",
  source: "MARKET",
  agency: "",
  hire_basis: "DAY",
  rate: "",
  is_active: true,
};

function MachineForm({ siteId, editing, onDone }) {
  const createMachine = useCreateMachine();
  const updateMachine = useUpdateMachine();
  const [form, setForm] = useState(
    editing
      ? {
          name: editing.name,
          reg_no: editing.reg_no ?? "",
          source: editing.source,
          agency: editing.agency ?? "",
          hire_basis: editing.hire_basis,
          rate: editing.rate,
          is_active: editing.is_active,
        }
      : BLANK,
  );
  const mutation = editing ? updateMachine : createMachine;

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      rate: parseNumber(form.rate) ?? 0,
    };
    try {
      if (editing) {
        await updateMachine.mutateAsync({
          machineId: editing.id,
          payload,
        });
      } else {
        await createMachine.mutateAsync({
          site: siteId,
          ...payload,
        });
      }
      onDone();
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
        <span>Machine</span>
        <input
          type="text"
          value={form.name}
          onChange={(event) =>
            setField("name", event.target.value)
          }
          required
        />
      </label>
      <label className="form-field">
        <span>Registration / ID</span>
        <input
          type="text"
          value={form.reg_no}
          onChange={(event) =>
            setField("reg_no", event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Source</span>
        <select
          value={form.source}
          onChange={(event) =>
            setField("source", event.target.value)
          }
        >
          {Object.entries(SOURCE_LABELS).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
      </label>
      <label className="form-field">
        <span>Agency / owner</span>
        <input
          type="text"
          value={form.agency}
          onChange={(event) =>
            setField("agency", event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Hired</span>
        <select
          value={form.hire_basis}
          onChange={(event) =>
            setField("hire_basis", event.target.value)
          }
        >
          {Object.entries(BASIS_LABELS).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
      </label>
      <label className="form-field">
        <span>Rate (₹)</span>
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
      {editing ? (
        <label className="form-field">
          <span>Status</span>
          <select
            value={form.is_active ? "yes" : "no"}
            onChange={(event) =>
              setField(
                "is_active",
                event.target.value === "yes",
              )
            }
          >
            <option value="yes">Active</option>
            <option value="no">Inactive (no new entries)</option>
          </select>
        </label>
      ) : null}
      <div className="pm-inline-row">
        <button
          type="submit"
          className="button button--primary"
          disabled={mutation.isPending}
        >
          {editing ? "Save changes" : "Add machine"}
        </button>
        {editing ? (
          <button
            type="button"
            className="button button--tertiary"
            onClick={onDone}
          >
            Cancel
          </button>
        ) : null}
      </div>
      <p className="pm-dpr-toolbar__help">
        Hire = rate × days or hours worked. A monthly rate is
        divided by a flat 30 days. The hire is fixed when a day
        is entered, so changing the rate later does not change
        days already recorded.
      </p>
      {mutation.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(mutation.error)}
        </div>
      ) : null}
    </form>
  );
}

/** The site's machine register. */
export function MachinesPanel({ siteId, canEnter }) {
  const machinesQuery = useMachines(siteId, true);
  const deleteMachine = useDeleteMachine();
  const [formTarget, setFormTarget] = useState(null);
  const machines = machinesQuery.data ?? [];

  return (
    <div className="pm-stack">
      {canEnter ? (
        formTarget ? (
          <MachineForm
            key={formTarget === "new" ? "new" : formTarget.id}
            siteId={siteId}
            editing={formTarget === "new" ? null : formTarget}
            onDone={() => setFormTarget(null)}
          />
        ) : (
          <div className="pm-inline-row print-hidden">
            <button
              type="button"
              className="button button--primary button--sm"
              onClick={() => setFormTarget("new")}
            >
              <Plus size={14} /> Add machine
            </button>
          </div>
        )
      ) : null}

      {deleteMachine.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(deleteMachine.error)}
        </div>
      ) : null}

      {machines.some((machine) => machine.needs_review) ? (
        <div className="inline-alert">
          Some machines were created by an upload and have no
          rate yet. Edit them to set the source, hire basis and
          rate - until then their hire is recorded as entered.
        </div>
      ) : null}

      {machines.length === 0 ? (
        <p className="pm-timeline-empty">
          No machines registered for this site yet.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table pm-hr-table">
            <thead>
              <tr>
                <th>Machine</th>
                <th>Reg / ID</th>
                <th>Source</th>
                <th>Agency</th>
                <th>Hired</th>
                <th className="pm-num">Rate</th>
                <th>Status</th>
                {canEnter ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {machines.map((machine) => (
                <tr
                  key={machine.id}
                  className={
                    machine.is_active
                      ? ""
                      : "pm-hr-table__empty"
                  }
                >
                  <td>{machine.name}</td>
                  <td>{machine.reg_no || "-"}</td>
                  <td>{SOURCE_LABELS[machine.source]}</td>
                  <td>{machine.agency || "-"}</td>
                  <td>{BASIS_LABELS[machine.hire_basis]}</td>
                  <td className="pm-num">
                    {formatCurrency(machine.rate)}
                  </td>
                  <td>
                    {machine.needs_review
                      ? "Needs review"
                      : machine.is_active
                        ? "Active"
                        : "Inactive"}
                  </td>
                  {canEnter ? (
                    <td>
                      <div className="pm-hr-actions">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Edit ${machine.name}`}
                          title="Edit"
                          onClick={() =>
                            setFormTarget(machine)
                          }
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button--danger"
                          aria-label={`Delete ${machine.name}`}
                          title="Delete"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete ${machine.name}? Machines with usage or fuel recorded cannot be deleted - mark them inactive instead.`,
                              )
                            ) {
                              deleteMachine.mutate(machine.id);
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
