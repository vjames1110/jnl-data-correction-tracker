import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

/**
 * The "review everything on this sheet at once" control - shared by
 * Structures/Buildings (``ActivityWorkspace``) and Girders
 * (``GirderJobWorkspace``), since it's the exact same optional-remark
 * confirm flow either way.
 */
export function ReviewAllControl({
  label = "Review all tasks in this sheet",
  onReviewAll,
  reviewAllStatus,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [remarks, setRemarks] = useState("");

  if (!onReviewAll) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onReviewAll(remarks, {
      onSuccess: () => {
        setIsOpen(false);
        setRemarks("");
      },
    });
  };

  return (
    <div className="pm-review-all">
      {isOpen ? (
        <form
          className="pm-inline-row"
          onSubmit={handleSubmit}
        >
          <input
            type="text"
            placeholder="Remark for this review (optional)"
            value={remarks}
            onChange={(event) =>
              setRemarks(event.target.value)
            }
          />
          <button
            type="submit"
            className="button button--primary"
            disabled={
              reviewAllStatus?.isPending
            }
          >
            <CheckCircle2 size={14} /> Confirm
            review all
          </button>
          <button
            type="button"
            className="button button--tertiary"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setIsOpen(true)}
        >
          <CheckCircle2 size={14} /> {label}
        </button>
      )}
      {reviewAllStatus?.isError ? (
        <div className="inline-alert inline-alert--error">
          {reviewAllStatus.error?.message}
        </div>
      ) : null}
    </div>
  );
}
