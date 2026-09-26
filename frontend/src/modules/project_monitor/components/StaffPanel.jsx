import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  useCreateStaff,
  useDeleteStaff,
  useDeleteStaffOverride,
  useSaveStaffOverride,
  useStaffMembers,
  useStaffOverrides,
  useUpdateStaff,
} from "../../../hooks/useProjectMonitor";
import {
  apiErrorMessage,
  parseNumber,
  todayIso,
} from "../utils/finance";
import {
  formatCurrency,
  formatDate,
} from "../utils/status";

const BLANK = {
  staff_code: "",
  name: "",
  designation: "",
  monthly_salary: "",
  from_date: "",
  to_date: "",
};

function StaffForm({ siteId, editing, onDone }) {
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const [form, setForm] = useState(
    editing
      ? {
          staff_code: editing.staff_code ?? "",
          name: editing.name,
          designation: editing.designation ?? "",
          monthly_salary: editing.monthly_salary,
          from_date: editing.from_date,
          to_date: editing.to_date ?? "",
        }
      : { ...BLANK, from_date: todayIso() },
  );
  const mutation = editing ? updateStaff : createStaff;

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      staff_code: form.staff_code,
      name: form.name,
      designation: form.designation,
      monthly_salary: parseNumber(form.monthly_salary),
      from_date: form.from_date,
      to_date: form.to_date || null,
    };
    try {
      if (editing) {
        await updateStaff.mutateAsync({
          staffId: editing.id,
          payload,
        });
      } else {
        await createStaff.mutateAsync({
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
        <span>Staff code (optional)</span>
        <input
          type="text"
          value={form.staff_code}
          onChange={(event) =>
            setField("staff_code", event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Name</span>
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
        <span>Designation</span>
        <input
          type="text"
          value={form.designation}
          onChange={(event) =>
            setField("designation", event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Monthly salary (₹)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.monthly_salary}
          onChange={(event) =>
            setField("monthly_salary", event.target.value)
          }
          required
        />
      </label>
      <label className="form-field">
        <span>Joined on</span>
        <input
          type="date"
          value={form.from_date}
          onChange={(event) =>
            setField("from_date", event.target.value)
          }
          required
        />
      </label>
      <label className="form-field">
        <span>Last day (blank = still on project)</span>
        <input
          type="date"
          value={form.to_date}
          onChange={(event) =>
            setField("to_date", event.target.value)
          }
        />
      </label>
      <div className="pm-inline-row">
        <button
          type="submit"
          className="button button--primary"
          disabled={mutation.isPending}
        >
          {editing ? "Save changes" : "Add staff member"}
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
        Cost accrues daily as salary ÷ days in that month, from
        the joining day (no part-month reduction). To revise a
        salary, set a last day on the current row and add a new
        row from the revision date - editing the salary in place
        changes past days too.
      </p>
      {mutation.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(mutation.error)}
        </div>
      ) : null}
    </form>
  );
}

function OverrideSection({ siteId, month, staff, canEnter }) {
  const overridesQuery = useStaffOverrides(siteId, month, true);
  const saveOverride = useSaveStaffOverride();
  const deleteOverride = useDeleteStaffOverride();
  const [form, setForm] = useState({
    staff: "",
    date: todayIso(),
    amount: "0",
    note: "",
  });
  const rows = overridesQuery.data ?? [];

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await saveOverride.mutateAsync({
        ...form,
        amount: parseNumber(form.amount) ?? 0,
      });
      setField("note", "");
    } catch {
      // Shown by the inline alert.
    }
  };

  return (
    <div>
      <h3 className="pm-hr-subheading">
        Day cost overrides
      </h3>
      <p className="pm-dpr-toolbar__help">
        Use for a day that should not cost the normal daily
        rate - enter 0 for absent or unpaid.
      </p>

      {canEnter ? (
        <form
          className="form-grid pm-hr-form print-hidden"
          onSubmit={handleSubmit}
        >
          <label className="form-field">
            <span>Staff member</span>
            <select
              value={form.staff}
              onChange={(event) =>
                setField("staff", event.target.value)
              }
              required
            >
              <option value="">Select staff</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
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
            <span>Cost that day (₹)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(event) =>
                setField("amount", event.target.value)
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Note</span>
            <input
              type="text"
              value={form.note}
              onChange={(event) =>
                setField("note", event.target.value)
              }
            />
          </label>
          <div className="pm-inline-row">
            <button
              type="submit"
              className="button button--primary"
              disabled={saveOverride.isPending}
            >
              Save day cost
            </button>
          </div>
          {saveOverride.isError ? (
            <div className="inline-alert inline-alert--error">
              {apiErrorMessage(saveOverride.error)}
            </div>
          ) : null}
        </form>
      ) : null}

      {rows.length === 0 ? (
        <p className="pm-timeline-empty">
          No overrides this month.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table pm-hr-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Staff member</th>
                <th className="pm-num">Cost that day</th>
                <th>Note</th>
                {canEnter ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.date)}</td>
                  <td>{row.staff_name}</td>
                  <td className="pm-num">
                    {formatCurrency(row.amount)}
                  </td>
                  <td>{row.note || "-"}</td>
                  {canEnter ? (
                    <td>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        aria-label="Clear override"
                        title="Back to the normal daily rate"
                        onClick={() =>
                          deleteOverride.mutate(row.id)
                        }
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
  );
}

/** Staff register (salaries) and their day-cost overrides. */
export function StaffPanel({ siteId, month, canEnter }) {
  const staffQuery = useStaffMembers(siteId, true);
  const deleteStaff = useDeleteStaff();
  const [formTarget, setFormTarget] = useState(null);
  const staff = staffQuery.data ?? [];

  return (
    <div className="pm-stack">
      {canEnter ? (
        formTarget ? (
          <StaffForm
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
              <Plus size={14} /> Add staff member
            </button>
          </div>
        )
      ) : null}

      {deleteStaff.isError ? (
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(deleteStaff.error)}
        </div>
      ) : null}

      {staff.length === 0 ? (
        <p className="pm-timeline-empty">
          No staff recorded for this site yet.
        </p>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-report__table pm-hr-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Designation</th>
                <th className="pm-num">Monthly salary</th>
                <th className="pm-num">Daily rate today</th>
                <th>Joined</th>
                <th>Last day</th>
                <th>Status</th>
                {canEnter ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <td>{member.staff_code || "-"}</td>
                  <td>{member.name}</td>
                  <td>{member.designation || "-"}</td>
                  <td className="pm-num">
                    {formatCurrency(member.monthly_salary)}
                  </td>
                  <td className="pm-num">
                    {member.on_payroll_today
                      ? formatCurrency(member.daily_rate_today)
                      : "-"}
                  </td>
                  <td>{formatDate(member.from_date)}</td>
                  <td>{formatDate(member.to_date)}</td>
                  <td>
                    {member.on_payroll_today
                      ? "On project"
                      : "Not on payroll"}
                  </td>
                  {canEnter ? (
                    <td>
                      <div className="pm-hr-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Edit ${member.name}`}
                        title="Edit"
                        onClick={() => setFormTarget(member)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        aria-label={`Delete ${member.name}`}
                        title="Delete"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete ${member.name}? Their cost is removed from every day, past ones included. To stop cost from a date, set a last day instead.`,
                            )
                          ) {
                            deleteStaff.mutate(member.id);
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

      {staff.length ? (
        <OverrideSection
          siteId={siteId}
          month={month}
          staff={staff}
          canEnter={canEnter}
        />
      ) : null}
    </div>
  );
}
