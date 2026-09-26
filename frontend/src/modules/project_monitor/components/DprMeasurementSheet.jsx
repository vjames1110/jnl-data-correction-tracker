import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import {
  useDprMeasurements,
  useSaveDprMeasurements,
} from "../../../hooks/useProjectMonitor";
import { apiErrorMessage } from "../utils/finance";
import {
  compareWithEntered,
  comparisonText,
  isMeasured,
  lineQuantity,
  sheetTotal,
} from "../utils/measurement";
import { formatDate } from "../utils/status";

const BLANK_LINE = {
  description: "",
  nos: "",
  length: "",
  breadth: "",
  depth: "",
  is_deduction: false,
};

const DIMENSION_COLUMNS = [
  ["nos", "Nos"],
  ["length", "L"],
  ["breadth", "B"],
  ["depth", "D"],
];

const CHIP_BY_STATE = {
  match: "status-chip status-chip--success",
  short: "status-chip status-chip--warning",
  over: "status-chip status-chip--warning",
  unentered: "status-chip status-chip--warning",
  none: "status-chip",
};

function fromServer(line) {
  const number = (value) =>
    value === null || value === undefined ? "" : String(Number(value));
  return {
    description: line.description ?? "",
    nos: number(line.nos),
    length: number(line.length),
    breadth: number(line.breadth),
    depth: number(line.depth),
    is_deduction: Boolean(line.is_deduction),
  };
}

function toServer(line) {
  const value = (raw) => (raw === "" ? null : raw);
  return {
    description: line.description,
    nos: value(line.nos),
    length: value(line.length),
    breadth: value(line.breadth),
    depth: value(line.depth),
    is_deduction: line.is_deduction,
  };
}

function isBlank(line) {
  return !line.description.trim() && !isMeasured(line);
}

function SheetEditor({
  siteId,
  item,
  date,
  initialLines,
  entered,
  editable,
  onUseTotal,
  onClose,
}) {
  const [lines, setLines] = useState(initialLines);
  const [baseline, setBaseline] = useState(
    JSON.stringify(initialLines),
  );
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const save = useSaveDprMeasurements();

  const total = sheetTotal(lines);
  const { state } = compareWithEntered(total, entered);
  const dirty = JSON.stringify(lines) !== baseline;

  const update = (index, key, value) => {
    setMessage("");
    setLines((current) =>
      current.map((line, position) =>
        position === index ? { ...line, [key]: value } : line,
      ),
    );
  };

  const handleSave = async () => {
    setProblem("");
    setMessage("");
    const kept = lines.filter((line) => !isBlank(line));
    const unfinished = kept.findIndex((line) => !isMeasured(line));
    if (unfinished !== -1) {
      setProblem(
        `Line ${unfinished + 1}: give the Nos or at least one of length, breadth or depth.`,
      );
      return;
    }
    try {
      const saved = await save.mutateAsync({
        site: siteId,
        item: item.id,
        date,
        lines: kept.map(toServer),
      });
      const next = saved.lines.map(fromServer);
      setLines(next);
      setBaseline(JSON.stringify(next));
      setMessage("Measurement saved.");
    } catch (error) {
      setProblem(apiErrorMessage(error));
    }
  };

  return (
    <div className="pm-measure">
      <div className="pm-measure__head">
        <div>
          <strong>
            Measurement -{" "}
            {item.item_no ? `${item.item_no} ` : ""}
            {item.description}
          </strong>
          <span className="sub"> · {formatDate(date)}</span>
        </div>
        <span className={CHIP_BY_STATE[state]}>
          {comparisonText(total, entered)}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="Close measurement"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      <div className="pm-table-wrap">
        <table className="pm-measure__table">
          <thead>
            <tr>
              <th>Description / location</th>
              {DIMENSION_COLUMNS.map(([key, label]) => (
                <th key={key}>{label}</th>
              ))}
              <th>Deduct</th>
              <th>Qty</th>
              {editable ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={editable ? 8 : 7}>
                  <span className="sub">
                    No measurement recorded for this day.
                  </span>
                </td>
              </tr>
            ) : null}
            {lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="text"
                    aria-label={`Line ${index + 1} description`}
                    value={line.description}
                    disabled={!editable}
                    maxLength={200}
                    onChange={(event) =>
                      update(
                        index,
                        "description",
                        event.target.value,
                      )
                    }
                  />
                </td>
                {DIMENSION_COLUMNS.map(([key, label]) => (
                  <td key={key}>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      aria-label={`Line ${index + 1} ${label}`}
                      value={line[key]}
                      disabled={!editable}
                      onChange={(event) =>
                        update(index, key, event.target.value)
                      }
                    />
                  </td>
                ))}
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Line ${index + 1} deduct`}
                    checked={line.is_deduction}
                    disabled={!editable}
                    onChange={(event) =>
                      update(
                        index,
                        "is_deduction",
                        event.target.checked,
                      )
                    }
                  />
                </td>
                <td className="pm-measure__qty">
                  {lineQuantity(line)}
                </td>
                {editable ? (
                  <td>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      aria-label={`Remove line ${index + 1}`}
                      onClick={() =>
                        setLines((current) =>
                          current.filter(
                            (_line, position) =>
                              position !== index,
                          ),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>Measured total</td>
              <td className="pm-measure__qty">{total}</td>
              {editable ? <td /> : null}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="pm-inline-row">
        {editable ? (
          <>
            <button
              type="button"
              className="button button--tertiary button--sm"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { ...BLANK_LINE },
                ])
              }
            >
              <Plus size={14} /> Add line
            </button>
            <button
              type="button"
              className="button button--tertiary button--sm"
              onClick={() => onUseTotal(total)}
              disabled={total <= 0}
            >
              Use measured total
            </button>
            <button
              type="button"
              className="button button--primary button--sm"
              onClick={handleSave}
              disabled={!dirty || save.isPending}
            >
              {save.isPending ? "Saving..." : "Save measurement"}
            </button>
          </>
        ) : (
          <span className="sub">
            This day is locked or you cannot edit it, so the
            measurement is read-only.
          </span>
        )}
        {message ? <span className="sub">{message}</span> : null}
      </div>
      <p className="form-help">
        A measurement is supporting detail for the quantity
        entered - it never blocks saving the DPR. Tick Deduct for
        openings and overlaps.
      </p>
      {problem ? (
        <div className="inline-alert inline-alert--error">
          {problem}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The measurement sheet that opens under an item's row in the DPR
 * grid when a day's quantity is entered: dimension lines, their
 * total, and how that total compares with the quantity typed.
 */
export function DprMeasurementSheet({
  siteId,
  item,
  date,
  entered,
  editable,
  onUseTotal,
  onClose,
}) {
  const query = useDprMeasurements(
    { site: siteId, item: item.id, date },
    true,
  );

  if (query.isLoading) {
    return (
      <div className="pm-measure">
        <span className="sub">Loading measurement...</span>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="pm-measure">
        <div className="inline-alert inline-alert--error">
          {apiErrorMessage(query.error)}
        </div>
      </div>
    );
  }

  const sheet = (query.data ?? [])[0];
  return (
    <SheetEditor
      key={`${item.id}|${date}`}
      siteId={siteId}
      item={item}
      date={date}
      initialLines={(sheet?.lines ?? []).map(fromServer)}
      entered={entered}
      editable={editable}
      onUseTotal={onUseTotal}
      onClose={onClose}
    />
  );
}
