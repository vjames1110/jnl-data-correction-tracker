import { useState } from "react";
import {
  CheckCircle2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useApproveReconciliationPeriod,
  useReconciliationPendingApprovals,
  useRejectReconciliationPeriod,
  useReturnReconciliationPeriod,
} from "../../../hooks/useReconciliation";

function InboxRow({ period }) {
  const [comment, setComment] = useState("");
  const approve = useApproveReconciliationPeriod();
  const reject = useRejectReconciliationPeriod();
  const returnForCorrection =
    useReturnReconciliationPeriod();

  const isPending =
    approve.isPending ||
    reject.isPending ||
    returnForCorrection.isPending;
  const error =
    approve.error ??
    reject.error ??
    returnForCorrection.error;
  const entryUrl = `/store/entry?month=${period.period_month.slice(
    0,
    7,
  )}&site=${period.site}`;

  return (
    <SurfaceCard>
      <div className="surface-card__header">
        <h2>
          {period.site_code} -{" "}
          {period.period_month}
        </h2>
        <Link
          className="button button--tertiary"
          to={entryUrl}
        >
          View Entries
        </Link>
      </div>
      <div className="surface-card__body">
        <p>
          Submitted by{" "}
          <strong>
            {period.submitted_by_employee_id ||
              "-"}
          </strong>{" "}
          | Entries:{" "}
          <strong>{period.entry_count}</strong> |
          Flags:{" "}
          <strong>{period.flag_count}</strong>
        </p>
        <p className="table-subtext">
          Current level:{" "}
          {period.current_approver_role} —{" "}
          {period.current_approver_name}
        </p>

        {error ? (
          <div className="inline-alert inline-alert--error">
            {error?.message}
          </div>
        ) : null}

        <label className="form-field">
          <span>
            Comment (required for Return / Reject)
          </span>
          <textarea
            rows={2}
            value={comment}
            onChange={(event) =>
              setComment(event.target.value)
            }
            placeholder="Add a comment..."
          />
        </label>

        <div className="management-panel__actions">
          <button
            type="button"
            className="button button--primary"
            disabled={isPending}
            onClick={() =>
              approve.mutate({
                id: period.id,
                comment,
              })
            }
          >
            <CheckCircle2 size={15} />
            Approve
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={isPending || !comment.trim()}
            onClick={() =>
              returnForCorrection.mutate({
                id: period.id,
                comment,
              })
            }
          >
            <RotateCcw size={15} />
            Return For Correction
          </button>
          <button
            type="button"
            className="button button--tertiary"
            disabled={isPending || !comment.trim()}
            onClick={() =>
              reject.mutate({
                id: period.id,
                comment,
              })
            }
          >
            <XCircle size={15} />
            Reject
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
}

export function StoreApprovalInboxPage() {
  const pendingQuery =
    useReconciliationPendingApprovals();
  const periods = pendingQuery.data ?? [];

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Store Reconciliation
          </span>
          <h1>Approval Inbox</h1>
          <p>
            Periods awaiting your sign-off.
            Approve to advance to the next level
            (or close it out); return a period to
            send it back to the store for
            correction; reject to close it out
            permanently.
          </p>
        </div>
      </div>

      {pendingQuery.isLoading ? (
        <AppLoader label="Loading pending approvals..." />
      ) : pendingQuery.isError ? (
        <ErrorState
          title="Pending approvals unavailable"
          message={pendingQuery.error?.message}
          onRetry={pendingQuery.refetch}
        />
      ) : periods.length ? (
        periods.map((period) => (
          <InboxRow
            key={period.id}
            period={period}
          />
        ))
      ) : (
        <EmptyState
          title="Nothing to approve"
          message="No reconciliation periods are currently waiting on your approval."
        />
      )}
    </div>
  );
}
