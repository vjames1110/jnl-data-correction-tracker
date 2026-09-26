import { useState } from "react";

import { GroupSegments } from "./GroupSegments";
import { ReviewAllControl } from "./ReviewAllControl";
import { WorkspaceSwitch } from "./WorkspaceSwitch";

function SpanEditForm({ span, onSave, onCancel, isPending }) {
  const [vendor, setVendor] = useState(span.vendor);
  const [poNumber, setPoNumber] = useState(span.po_number);
  const [drawingNo, setDrawingNo] = useState(span.drawing_no);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      vendor,
      po_number: poNumber,
      drawing_no: drawingNo,
    });
  };

  return (
    <form className="pm-drawer-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Drawing no.</span>
        <input
          type="text"
          value={drawingNo}
          onChange={(event) => setDrawingNo(event.target.value)}
        />
      </label>
      <label className="form-field">
        <span>Vendor</span>
        <input
          type="text"
          value={vendor}
          onChange={(event) => setVendor(event.target.value)}
        />
      </label>
      <label className="form-field">
        <span>PO number</span>
        <input
          type="text"
          value={poNumber}
          onChange={(event) => setPoNumber(event.target.value)}
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

function SpanPanel({
  span,
  canEdit,
  onUpdateSpan,
  updateSpanStatus,
  ...tableProps
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="pm-segments">
      <div className="pm-span-section__meta">
        <span>
          {span.girder_type || "Non-standard"}
          {span.span_length_m
            ? ` · ${span.span_length_m} m`
            : ""}
          {span.drawing_no ? ` · ${span.drawing_no}` : ""}
        </span>
        <span>Vendor: {span.vendor || "-"}</span>
        <span>PO: {span.po_number || "-"}</span>
        {canEdit && !isEditing ? (
          <button
            type="button"
            className="button button--tertiary"
            onClick={() => setIsEditing(true)}
          >
            Edit vendor / PO / drawing no.
          </button>
        ) : null}
      </div>

      {canEdit && isEditing ? (
        <SpanEditForm
          span={span}
          isPending={updateSpanStatus?.isPending}
          onSave={(payload) =>
            onUpdateSpan(span.id, payload, {
              onSuccess: () => setIsEditing(false),
            })
          }
          onCancel={() => setIsEditing(false)}
        />
      ) : null}

      <GroupSegments
        groups={span.groups}
        label={`${span.label} sections`}
        canEdit={canEdit}
        {...tableProps}
      />
    </div>
  );
}

const BRIDGE = "bridge";

/**
 * One bridge's full girder tracking, opened in place under its row:
 * segments for the bridge-level GAD and for each span, and inside a
 * span its own chains (girder, bearings, expansion joints) as
 * segments too. A span's vendor / PO / drawing number stay editable
 * (freely, per the prototype).
 */
export function GirderJobWorkspace({
  job,
  metaLine,
  onReviewAll,
  reviewAllStatus,
  canEdit,
  onUpdateSpan,
  updateSpanStatus,
  onSelectActivity,
  ...tableProps
}) {
  const hasBridgeSheet = Boolean(job.groups?.length);
  const [selected, setSelected] = useState(
    hasBridgeSheet ? BRIDGE : (job.spans?.[0]?.id ?? BRIDGE),
  );

  const options = [
    ...(hasBridgeSheet
      ? [{ key: BRIDGE, label: "Bridge GAD" }]
      : []),
    ...job.spans.map((span) => ({
      key: span.id,
      label: span.label,
      badge: `${span.overall_progress.done}/${span.overall_progress.total}`,
    })),
  ];
  const span = job.spans.find((entry) => entry.id === selected);

  return (
    <section
      className="pm-workspace-panel"
      aria-label={`${job.bridge_name} tasks`}
    >
      <div className="pm-workspace-panel__head">
        <p className="pm-workspace-panel__meta">{metaLine}</p>
        <ReviewAllControl
          label="Review all tasks on this bridge"
          onReviewAll={onReviewAll}
          reviewAllStatus={reviewAllStatus}
        />
      </div>

      {options.length > 1 ? (
        <WorkspaceSwitch
          label="Bridge sections"
          value={selected}
          onChange={(key) => {
            setSelected(key);
            onSelectActivity(null);
          }}
          options={options}
        />
      ) : null}

      {span ? (
        <SpanPanel
          key={span.id}
          span={span}
          canEdit={canEdit}
          onUpdateSpan={onUpdateSpan}
          updateSpanStatus={updateSpanStatus}
          onSelectActivity={onSelectActivity}
          {...tableProps}
        />
      ) : (
        <GroupSegments
          groups={job.groups}
          label="Bridge sections"
          canEdit={canEdit}
          onSelectActivity={onSelectActivity}
          {...tableProps}
        />
      )}
    </section>
  );
}
