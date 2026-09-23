import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

const BLANK = {
  from_chainage_km: "",
  to_chainage_km: "",
  vendor: "",
};

/**
 * The project's chainage broken into stretches, each optionally
 * naming who is working it - a site can hand different stretches to
 * different vendors, so this is a list rather than the single
 * overall chainage range on the project details card above it.
 */
export function ChainageSegmentsList({
  segments,
  canEdit,
  onAddSegment,
  addSegmentStatus,
  onDeleteSegment,
}) {
  const [isFormOpen, setIsFormOpen] =
    useState(false);
  const [form, setForm] = useState(BLANK);

  const setField = (key, value) =>
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onAddSegment(
      {
        from_chainage_km: form.from_chainage_km,
        to_chainage_km: form.to_chainage_km,
        vendor: form.vendor,
      },
      {
        onSuccess: () => {
          setIsFormOpen(false);
          setForm(BLANK);
        },
      },
    );
  };

  return (
    <div className="pm-extensions">
      <div className="surface-card__header">
        <h2>Chainage segments</h2>
        {canEdit && !isFormOpen ? (
          <button
            type="button"
            className="button button--tertiary"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus size={14} /> Add chainage
            segment
          </button>
        ) : null}
      </div>
      <p className="sub">
        Break the project&apos;s chainage into
        stretches - a stretch can be left with
        no vendor when it hasn&apos;t been
        handed to one yet.
      </p>

      {segments.length === 0 ? (
        <p className="pm-timeline-empty">
          No chainage segments recorded yet.
        </p>
      ) : (
        <table className="pm-extensions__table">
          <thead>
            <tr>
              <th>From (km)</th>
              <th>To (km)</th>
              <th>Vendor</th>
              {canEdit ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr key={segment.id}>
                <td>
                  {segment.from_chainage_km}
                </td>
                <td>
                  {segment.to_chainage_km}
                </td>
                <td>
                  {segment.vendor || "Not assigned"}
                </td>
                {canEdit ? (
                  <td>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      onClick={() =>
                        onDeleteSegment(
                          segment.id,
                        )
                      }
                      aria-label="Delete chainage segment"
                      title="Delete this chainage segment"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isFormOpen ? (
        <form
          className="pm-inline-row"
          onSubmit={handleSubmit}
        >
          <label className="filter-control">
            <span>From (km)</span>
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.from_chainage_km}
              onChange={(event) =>
                setField(
                  "from_chainage_km",
                  event.target.value,
                )
              }
              required
            />
          </label>
          <label className="filter-control">
            <span>To (km)</span>
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.to_chainage_km}
              onChange={(event) =>
                setField(
                  "to_chainage_km",
                  event.target.value,
                )
              }
              required
            />
          </label>
          <label className="filter-control">
            <span>
              Vendor (optional)
            </span>
            <input
              type="text"
              value={form.vendor}
              onChange={(event) =>
                setField(
                  "vendor",
                  event.target.value,
                )
              }
              placeholder="e.g. ABC Infra"
            />
          </label>
          <button
            type="submit"
            className="button button--primary"
            disabled={
              addSegmentStatus?.isPending
            }
          >
            Save
          </button>
          <button
            type="button"
            className="button button--tertiary"
            onClick={() =>
              setIsFormOpen(false)
            }
          >
            Cancel
          </button>
          {addSegmentStatus?.isError ? (
            <div className="inline-alert inline-alert--error pm-drawer-form__full">
              {
                addSegmentStatus.error
                  ?.message
              }
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
