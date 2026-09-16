import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { formatQty } from "../utils/status";
import { RollingDiagram } from "./RollingDiagram";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function AddScopePatchInlineForm({
  item,
  onSave,
  onCancel,
  isPending,
}) {
  const isM = item.unit === "M";
  const [fromKm, setFromKm] = useState("");
  const [toKm, setToKm] = useState("");
  const [side, setSide] = useState("BOTH");
  const [qty, setQty] = useState("");
  const [remarks, setRemarks] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      from_chainage_km: fromKm,
      to_chainage_km: toKm,
      side,
      ...(isM
        ? {}
        : { qty: qty || null }),
      remarks,
    });
  };

  return (
    <form
      className="pm-drawer-form"
      onSubmit={handleSubmit}
    >
      <label className="filter-control">
        <span>From (km)</span>
        <input
          type="number"
          step="0.001"
          value={fromKm}
          onChange={(event) =>
            setFromKm(event.target.value)
          }
          required
        />
      </label>
      <label className="filter-control">
        <span>To (km)</span>
        <input
          type="number"
          step="0.001"
          value={toKm}
          onChange={(event) =>
            setToKm(event.target.value)
          }
          required
        />
      </label>
      <label className="filter-control">
        <span>Side</span>
        <select
          value={side}
          onChange={(event) =>
            setSide(event.target.value)
          }
        >
          <option value="BOTH">Both</option>
          <option value="LHS">LHS</option>
          <option value="RHS">RHS</option>
        </select>
      </label>
      {!isM ? (
        <label className="filter-control">
          <span>Qty ({item.unit})</span>
          <input
            type="number"
            step="0.001"
            value={qty}
            onChange={(event) =>
              setQty(event.target.value)
            }
          />
        </label>
      ) : null}
      <label className="filter-control pm-drawer-form__full">
        <span>Remarks</span>
        <input
          type="text"
          value={remarks}
          onChange={(event) =>
            setRemarks(event.target.value)
          }
        />
      </label>
      <div className="pm-inline-row pm-drawer-form__full">
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
    </form>
  );
}

function AddProgressEntryInlineForm({
  item,
  onSave,
  onCancel,
  isPending,
}) {
  const isM = item.unit === "M";
  const [date, setDate] = useState(
    todayIso(),
  );
  const [meetingDate, setMeetingDate] =
    useState(todayIso());
  const [fromKm, setFromKm] = useState("");
  const [toKm, setToKm] = useState("");
  const [side, setSide] = useState("BOTH");
  const [qty, setQty] = useState("");
  const [contractor, setContractor] =
    useState("");
  const [status, setStatus] = useState(
    "IN_PROGRESS",
  );
  const [remarks, setRemarks] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(
      {
        date,
        meeting_date: meetingDate,
        from_chainage_km: fromKm,
        to_chainage_km: toKm,
        side,
        ...(isM
          ? {}
          : { qty: qty || null }),
        contractor,
        status,
        remarks,
      },
      {
        onSuccess: () => {
          setFromKm("");
          setToKm("");
          setQty("");
          setContractor("");
          setRemarks("");
        },
      },
    );
  };

  return (
    <form
      className="pm-drawer-form"
      onSubmit={handleSubmit}
    >
      <label className="filter-control">
        <span>Work date</span>
        <input
          type="date"
          value={date}
          onChange={(event) =>
            setDate(event.target.value)
          }
          required
        />
      </label>
      <label className="filter-control">
        <span>Meeting date</span>
        <input
          type="date"
          value={meetingDate}
          onChange={(event) =>
            setMeetingDate(
              event.target.value,
            )
          }
          required
        />
      </label>
      <label className="filter-control">
        <span>From (km)</span>
        <input
          type="number"
          step="0.001"
          value={fromKm}
          onChange={(event) =>
            setFromKm(event.target.value)
          }
          required
        />
      </label>
      <label className="filter-control">
        <span>To (km)</span>
        <input
          type="number"
          step="0.001"
          value={toKm}
          onChange={(event) =>
            setToKm(event.target.value)
          }
          required
        />
      </label>
      <label className="filter-control">
        <span>Side</span>
        <select
          value={side}
          onChange={(event) =>
            setSide(event.target.value)
          }
        >
          <option value="BOTH">Both</option>
          <option value="LHS">LHS</option>
          <option value="RHS">RHS</option>
        </select>
      </label>
      {!isM ? (
        <label className="filter-control">
          <span>Qty ({item.unit})</span>
          <input
            type="number"
            step="0.001"
            value={qty}
            onChange={(event) =>
              setQty(event.target.value)
            }
          />
        </label>
      ) : null}
      <label className="filter-control">
        <span>Contractor</span>
        <input
          type="text"
          value={contractor}
          onChange={(event) =>
            setContractor(
              event.target.value,
            )
          }
        />
      </label>
      <label className="filter-control">
        <span>Status</span>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
        >
          <option value="IN_PROGRESS">
            Ongoing
          </option>
          <option value="COMPLETE">
            Completed
          </option>
          <option value="HOLD">Hold</option>
        </select>
      </label>
      <label className="filter-control pm-drawer-form__full">
        <span>Remarks</span>
        <input
          type="text"
          value={remarks}
          onChange={(event) =>
            setRemarks(event.target.value)
          }
        />
      </label>
      <p className="pm-timeline-empty pm-drawer-form__full">
        Tip: any portion outside the defined
        scope won't count towards Done.
      </p>
      <div className="pm-inline-row pm-drawer-form__full">
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
    </form>
  );
}

/**
 * One Linear Item's accordion - stats summary, the rolling diagram
 * (``M``-unit items only), and the two "add" forms. Editing/deleting
 * individual scope patches/progress entries happens in the combined
 * Scope/Progress registers at the page level, matching the
 * prototype's own separation.
 */
export function LinearItemPanel({
  item,
  isExpanded,
  onToggle,
  canEdit,
  chainageStart,
  chainageEnd,
  onAddScopePatch,
  addScopePatchStatus,
  onAddProgressEntry,
  addProgressEntryStatus,
  onDeleteItem,
}) {
  const [isScopeFormOpen, setIsScopeFormOpen] =
    useState(false);
  const [
    isProgressFormOpen,
    setIsProgressFormOpen,
  ] = useState(false);

  const isM = item.unit === "M";
  const unitLabel = isM ? "m" : item.unit.toLowerCase();

  return (
    <div className="pm-linear-item">
      <div
        className="pm-linear-item__header"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
        <strong>{item.name}</strong>
        <span className="sub">
          {item.unit}
        </span>
        <span className="pm-linear-item__stats">
          Scope {formatQty(item.stats.scope)}{" "}
          {unitLabel} · Done{" "}
          {formatQty(item.stats.done)}{" "}
          {unitLabel} · Ongoing{" "}
          {formatQty(item.stats.ongoing)}{" "}
          {unitLabel} · Pending{" "}
          {formatQty(item.stats.pending)}{" "}
          {unitLabel}
        </span>
        {canEdit ? (
          <button
            type="button"
            className="icon-button icon-button--danger"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteItem(item.id);
            }}
            aria-label="Delete linear item"
            title="Delete this linear item"
          >
            <Trash2 size={16} />
          </button>
        ) : null}
      </div>

      {isExpanded ? (
        <div className="pm-linear-item__body">
          {isM ? (
            <RollingDiagram
              scopePatches={
                item.scope_patches
              }
              progressEntries={
                item.progress_entries
              }
              chainageStart={chainageStart}
              chainageEnd={chainageEnd}
            />
          ) : null}

          {canEdit ? (
            <div className="pm-inline-row">
              {isScopeFormOpen ? null : (
                <button
                  type="button"
                  className="button button--tertiary"
                  onClick={() =>
                    setIsScopeFormOpen(true)
                  }
                >
                  <Plus size={14} /> Add
                  scope patch
                </button>
              )}
              {isProgressFormOpen ? null : (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() =>
                    setIsProgressFormOpen(
                      true,
                    )
                  }
                >
                  <Plus size={14} /> Log
                  progress
                </button>
              )}
            </div>
          ) : null}

          {isScopeFormOpen ? (
            <AddScopePatchInlineForm
              item={item}
              isPending={
                addScopePatchStatus?.isPending
              }
              onSave={(payload) =>
                onAddScopePatch(
                  item.id,
                  payload,
                  {
                    onSuccess: () =>
                      setIsScopeFormOpen(
                        false,
                      ),
                  },
                )
              }
              onCancel={() =>
                setIsScopeFormOpen(false)
              }
            />
          ) : null}

          {isProgressFormOpen ? (
            <AddProgressEntryInlineForm
              item={item}
              isPending={
                addProgressEntryStatus?.isPending
              }
              onSave={(payload, options) =>
                onAddProgressEntry(
                  item.id,
                  payload,
                  options,
                )
              }
              onCancel={() =>
                setIsProgressFormOpen(false)
              }
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
