import {
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import { useOutsideClick } from "../../../hooks/useOutsideClick";
import { ActivityGroupsTable } from "./ActivityGroupsTable";
import { ReviewAllControl } from "./ReviewAllControl";

function SpanEditForm({
  span,
  onSave,
  onCancel,
  isPending,
}) {
  const [vendor, setVendor] = useState(
    span.vendor,
  );
  const [poNumber, setPoNumber] = useState(
    span.po_number,
  );
  const [drawingNo, setDrawingNo] = useState(
    span.drawing_no,
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      vendor,
      po_number: poNumber,
      drawing_no: drawingNo,
    });
  };

  return (
    <form
      className="pm-drawer-form"
      onSubmit={handleSubmit}
    >
      <label className="form-field">
        <span>Drawing no.</span>
        <input
          type="text"
          value={drawingNo}
          onChange={(event) =>
            setDrawingNo(event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>Vendor</span>
        <input
          type="text"
          value={vendor}
          onChange={(event) =>
            setVendor(event.target.value)
          }
        />
      </label>
      <label className="form-field">
        <span>PO number</span>
        <input
          type="text"
          value={poNumber}
          onChange={(event) =>
            setPoNumber(event.target.value)
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

function SpanSection({
  span,
  isExpanded,
  onToggle,
  canEdit,
  onUpdateSpan,
  updateSpanStatus,
  activeActivityId,
  onSelectActivity,
  onSubmitUpdate,
  updateStatus,
  onReviewActivity,
  reviewActivityStatus,
}) {
  const [isEditing, setIsEditing] =
    useState(false);

  return (
    <div className="pm-span-section">
      <div
        className="pm-span-section__header"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
        <strong>{span.label}</strong>
        <span className="sub">
          {span.girder_type || "Non-standard"}
          {span.span_length_m
            ? ` · ${span.span_length_m} m`
            : ""}
          {span.drawing_no
            ? ` · ${span.drawing_no}`
            : ""}
        </span>
        <span className="pm-span-section__progress">
          {span.overall_progress.done}/
          {span.overall_progress.total} complete
        </span>
      </div>

      {isExpanded ? (
        <div className="pm-span-section__body">
          {canEdit ? (
            isEditing ? (
              <SpanEditForm
                span={span}
                isPending={
                  updateSpanStatus?.isPending
                }
                onSave={(payload) =>
                  onUpdateSpan(
                    span.id,
                    payload,
                    {
                      onSuccess: () =>
                        setIsEditing(false),
                    },
                  )
                }
                onCancel={() =>
                  setIsEditing(false)
                }
              />
            ) : (
              <div className="pm-span-section__meta">
                <span>
                  Vendor:{" "}
                  {span.vendor || "-"}
                </span>
                <span>
                  PO: {span.po_number || "-"}
                </span>
                <button
                  type="button"
                  className="button button--tertiary"
                  onClick={() =>
                    setIsEditing(true)
                  }
                >
                  Edit vendor / PO / drawing
                  no.
                </button>
              </div>
            )
          ) : null}

          <ActivityGroupsTable
            groups={span.groups}
            activeActivityId={
              activeActivityId
            }
            onSelectActivity={
              onSelectActivity
            }
            canEdit={canEdit}
            onSubmitUpdate={onSubmitUpdate}
            updateStatus={updateStatus}
            onReviewActivity={
              onReviewActivity
            }
            reviewActivityStatus={
              reviewActivityStatus
            }
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * One bridge's full girder tracking - the bridge-level GAD row (via
 * the shared ``ActivityGroupsTable``), then every span as its own
 * accordion section with its own vendor/PO/drawing-no (freely
 * editable, per the prototype) and its own girder/bearings/
 * expansion-joints chains.
 */
export function GirderJobDrawer({
  job,
  eyebrow,
  metaLine,
  activeActivityId,
  onSelectActivity,
  canEdit,
  onClose,
  onSubmitUpdate,
  updateStatus,
  onReviewActivity,
  reviewActivityStatus,
  onReviewAll,
  reviewAllStatus,
  onUpdateSpan,
  updateSpanStatus,
}) {
  const [expandedSpanId, setExpandedSpanId] =
    useState(
      () => job?.spans?.[0]?.id ?? null,
    );
  const drawerRef = useRef(null);
  useOutsideClick(
    drawerRef,
    Boolean(activeActivityId),
    () => onSelectActivity(null),
  );

  if (!job) {
    return null;
  }

  return (
    <aside
      className="details-drawer"
      ref={drawerRef}
    >
      <div className="details-drawer__header">
        <div>
          <span className="page-eyebrow">
            {eyebrow}
          </span>
          <h2>{job.bridge_name}</h2>
          <p>{metaLine}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={18} />
        </button>
      </div>

      <ReviewAllControl
        label="Review all tasks on this bridge"
        onReviewAll={onReviewAll}
        reviewAllStatus={reviewAllStatus}
      />

      <ActivityGroupsTable
        groups={job.groups}
        activeActivityId={activeActivityId}
        onSelectActivity={onSelectActivity}
        canEdit={canEdit}
        onSubmitUpdate={onSubmitUpdate}
        updateStatus={updateStatus}
        onReviewActivity={onReviewActivity}
        reviewActivityStatus={
          reviewActivityStatus
        }
      />

      <h4 style={{ marginTop: 14 }}>Spans</h4>
      {job.spans.map((span) => (
        <SpanSection
          key={span.id}
          span={span}
          isExpanded={
            span.id === expandedSpanId
          }
          onToggle={() =>
            setExpandedSpanId((current) =>
              current === span.id
                ? null
                : span.id,
            )
          }
          canEdit={canEdit}
          onUpdateSpan={onUpdateSpan}
          updateSpanStatus={updateSpanStatus}
          activeActivityId={activeActivityId}
          onSelectActivity={onSelectActivity}
          onSubmitUpdate={onSubmitUpdate}
          updateStatus={updateStatus}
          onReviewActivity={onReviewActivity}
          reviewActivityStatus={
            reviewActivityStatus
          }
        />
      ))}
    </aside>
  );
}
