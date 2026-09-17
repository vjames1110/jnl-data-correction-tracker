import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

const STRUCTURE_KIND_LABELS = {
  MAJOR: "Major Bridge",
  ROB: "ROB",
  FOB: "FOB",
};

function blankSpan(index) {
  return {
    label: `S${index + 1}`,
    libraryId: "",
    isStandard: false,
    drawingNo: "",
    spanLengthM: "",
    girderType: "",
    qtyMt: "",
    vendor: "",
    poNumber: "",
    bearingsCount: 4,
    expansionJointsCount: 2,
  };
}

/**
 * The "+ Add girder job" form - server-side port of the prototype's
 * ``addGirderJob()`` action. Picking an existing Structure (of the
 * matching kind, not already tracked) auto-fills bridge name/
 * chainage; picking a span from the RDSO library pre-fills its
 * drawing no/length/type/quantity, or a span can be entered non-
 * standard. Bearings/Expansion-joints counts are hidden for FOBs,
 * which carry girders only.
 */
export function AddGirderJobForm({
  structures,
  existingStructureIds,
  spanLibrary,
  onCreate,
  onCancel,
  isPending,
  error,
}) {
  const [structureKind, setStructureKind] =
    useState("MAJOR");
  const [pickedStructureId, setPickedStructureId] =
    useState("");
  const [bridgeName, setBridgeName] =
    useState("");
  const [chainageKm, setChainageKm] =
    useState("");
  const [girderScope, setGirderScope] =
    useState("JNL");
  const [spans, setSpans] = useState([
    blankSpan(0),
  ]);

  const isFob = structureKind === "FOB";

  const availableStructures = structures.filter(
    (structure) =>
      structure.structure_type_code ===
        structureKind &&
      !existingStructureIds.has(structure.id),
  );

  const handleKindChange = (value) => {
    setStructureKind(value);
    setPickedStructureId("");
  };

  const handlePickStructure = (value) => {
    setPickedStructureId(value);
    const structure = availableStructures.find(
      (item) => item.id === value,
    );
    if (structure) {
      setBridgeName(structure.name);
      setChainageKm(
        structure.chainage_km != null
          ? String(structure.chainage_km)
          : "",
      );
    }
  };

  const setSpanField = (index, field, value) => {
    setSpans((current) =>
      current.map((span, spanIndex) =>
        spanIndex === index
          ? { ...span, [field]: value }
          : span,
      ),
    );
  };

  const handleLibraryPick = (
    index,
    libraryId,
  ) => {
    const entry = spanLibrary.find(
      (item) => item.id === libraryId,
    );
    setSpans((current) =>
      current.map((span, spanIndex) => {
        if (spanIndex !== index) {
          return span;
        }
        if (!entry) {
          return {
            ...span,
            libraryId: "",
            isStandard: false,
          };
        }
        return {
          ...span,
          libraryId,
          isStandard: true,
          drawingNo: entry.drawing_no || "",
          spanLengthM: String(
            entry.span_length_m,
          ),
          girderType: entry.girder_type,
          qtyMt: String(
            entry.qty_per_span_mt,
          ),
        };
      }),
    );
  };

  const addSpanRow = () =>
    setSpans((current) => [
      ...current,
      blankSpan(current.length),
    ]);

  const removeSpanRow = (index) =>
    setSpans((current) =>
      current.filter(
        (_, spanIndex) => spanIndex !== index,
      ),
    );

  const handleSubmit = (event) => {
    event.preventDefault();
    onCreate(
      {
        structure: pickedStructureId || null,
        structure_kind: structureKind,
        bridge_name: bridgeName,
        chainage_km: chainageKm || null,
        girder_scope: girderScope,
        spans: spans.map((span) => ({
          label: span.label,
          is_standard: span.isStandard,
          drawing_no: span.drawingNo,
          span_length_m:
            span.spanLengthM || null,
          girder_type: span.girderType,
          qty_mt: span.qtyMt || 0,
          vendor: span.vendor,
          po_number: span.poNumber,
          bearings_count: isFob
            ? 0
            : Number(span.bearingsCount) || 0,
          expansion_joints_count: isFob
            ? 0
            : Number(
                span.expansionJointsCount,
              ) || 0,
        })),
      },
      {
        onSuccess: () => {
          setBridgeName("");
          setChainageKm("");
          setPickedStructureId("");
          setSpans([blankSpan(0)]);
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="form-field">
          <span>Structure kind</span>
          <select
            value={structureKind}
            onChange={(event) =>
              handleKindChange(
                event.target.value,
              )
            }
          >
            {Object.entries(
              STRUCTURE_KIND_LABELS,
            ).map(([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>
            Pick an existing structure
            (optional)
          </span>
          <select
            value={pickedStructureId}
            onChange={(event) =>
              handlePickStructure(
                event.target.value,
              )
            }
          >
            <option value="">
              Enter fresh
            </option>
            {availableStructures.map(
              (structure) => (
                <option
                  key={structure.id}
                  value={structure.id}
                >
                  {structure.name}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="form-field">
          <span>Bridge no. / name</span>
          <input
            type="text"
            value={bridgeName}
            onChange={(event) =>
              setBridgeName(
                event.target.value,
              )
            }
            placeholder="e.g. Br. No. 310"
            required
          />
        </label>
        <label className="form-field">
          <span>Chainage (km)</span>
          <input
            type="number"
            step="0.001"
            value={chainageKm}
            onChange={(event) =>
              setChainageKm(
                event.target.value,
              )
            }
            placeholder="15.500"
          />
        </label>
        <label className="form-field">
          <span>
            Girder fabrication & launching
          </span>
          <select
            value={girderScope}
            onChange={(event) =>
              setGirderScope(
                event.target.value,
              )
            }
          >
            <option value="JNL">
              JNL (fabrication by vendor)
            </option>
            <option value="RAILWAY">
              Railway supply - follow-up only
            </option>
          </select>
        </label>
      </div>

      <h5 style={{ marginTop: 14 }}>Spans</h5>
      {spans.map((span, index) => (
        <div
          className="pm-builder-subcard"
          key={index}
        >
          <div className="form-grid">
            <label className="form-field">
              <span>Span label</span>
              <input
                type="text"
                value={span.label}
                onChange={(event) =>
                  setSpanField(
                    index,
                    "label",
                    event.target.value,
                  )
                }
                required
              />
            </label>
            <label className="form-field">
              <span>RDSO standard span</span>
              <select
                value={span.libraryId}
                onChange={(event) =>
                  handleLibraryPick(
                    index,
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Non-standard
                </option>
                {spanLibrary.map((entry) => (
                  <option
                    key={entry.id}
                    value={entry.id}
                  >
                    RDSO {entry.span_length_m}{" "}
                    m {entry.girder_type}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Drawing no.</span>
              <input
                type="text"
                value={span.drawingNo}
                onChange={(event) =>
                  setSpanField(
                    index,
                    "drawingNo",
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="form-field">
              <span>Span length (m)</span>
              <input
                type="number"
                step="0.01"
                value={span.spanLengthM}
                onChange={(event) =>
                  setSpanField(
                    index,
                    "spanLengthM",
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="form-field">
              <span>Girder type</span>
              <input
                type="text"
                value={span.girderType}
                onChange={(event) =>
                  setSpanField(
                    index,
                    "girderType",
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="form-field">
              <span>Qty (MT)</span>
              <input
                type="number"
                step="0.001"
                value={span.qtyMt}
                onChange={(event) =>
                  setSpanField(
                    index,
                    "qtyMt",
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="form-field">
              <span>Vendor</span>
              <input
                type="text"
                value={span.vendor}
                onChange={(event) =>
                  setSpanField(
                    index,
                    "vendor",
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="form-field">
              <span>PO number</span>
              <input
                type="text"
                value={span.poNumber}
                onChange={(event) =>
                  setSpanField(
                    index,
                    "poNumber",
                    event.target.value,
                  )
                }
              />
            </label>
            {!isFob ? (
              <>
                <label className="form-field">
                  <span>Bearings (nos)</span>
                  <input
                    type="number"
                    min="0"
                    value={
                      span.bearingsCount
                    }
                    onChange={(event) =>
                      setSpanField(
                        index,
                        "bearingsCount",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label className="form-field">
                  <span>
                    Expansion joints (nos)
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={
                      span.expansionJointsCount
                    }
                    onChange={(event) =>
                      setSpanField(
                        index,
                        "expansionJointsCount",
                        event.target.value,
                      )
                    }
                  />
                </label>
              </>
            ) : null}
          </div>
          {spans.length > 1 ? (
            <button
              type="button"
              className="icon-button icon-button--danger"
              onClick={() =>
                removeSpanRow(index)
              }
              aria-label="Remove span"
              title="Remove this span"
            >
              <Trash2 size={16} />
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className="button button--tertiary"
        onClick={addSpanRow}
      >
        <Plus size={14} /> Add another span
      </button>

      <div className="management-panel__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={isPending}
        >
          Generate sheet
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
          {error.message}
        </div>
      ) : null}
    </form>
  );
}
