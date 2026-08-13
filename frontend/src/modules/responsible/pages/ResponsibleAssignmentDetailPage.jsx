import { useMemo, useState } from "react";
import {
  CheckCircle2,
  MessageSquareText,
  Paperclip,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { useAuth } from "../../../hooks/useAuth";
import {
  useAcceptAssignment,
  useAddCorrectionComment,
  useCorrectionAttachments,
  useCorrectionRequest,
  useCorrectionTimeline,
  useHoldWork,
  useRequestReassignment,
  useResolveWork,
  useResumeWork,
  useStartProgress,
  useUploadCorrectionAttachment,
} from "../../../hooks/useCorrectionRequests";
import {
  ACCEPTABLE_WORK_STATUSES,
  formatCodeName,
  formatDate,
  formatDateTime,
  formatStatus,
  HOLDABLE_WORK_STATUSES,
  REASSIGNMENT_REQUESTABLE_STATUSES,
  RESOLVABLE_WORK_STATUSES,
  RESUMABLE_WORK_STATUSES,
  STARTABLE_WORK_STATUSES,
  statusTone,
} from "../utils/workDisplay";

function DetailItem({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </div>
  );
}

const initialResolveForm = {
  erp_action_completed: "",
  completion_date: "",
  erp_reference: "",
  actual_amount: "",
  actual_quantity: "",
  final_comments: "",
};

export function ResponsibleAssignmentDetailPage() {
  const { assignmentId } = useParams();
  const { user } = useAuth();

  const [comment, setComment] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [
    expectedResumeDate,
    setExpectedResumeDate,
  ] = useState("");
  const [holdComment, setHoldComment] =
    useState("");
  const [
    reassignmentReason,
    setReassignmentReason,
  ] = useState("");
  const [resolveForm, setResolveForm] = useState(
    initialResolveForm,
  );
  const [attachmentFile, setAttachmentFile] =
    useState(null);
  const [localMessage, setLocalMessage] =
    useState("");

  const requestQuery =
    useCorrectionRequest(assignmentId);
  const timelineQuery =
    useCorrectionTimeline(assignmentId);
  const attachmentsQuery =
    useCorrectionAttachments(assignmentId);

  const acceptAssignment = useAcceptAssignment();
  const startProgress = useStartProgress();
  const holdWork = useHoldWork();
  const resumeWork = useResumeWork();
  const resolveWork = useResolveWork();
  const requestReassignment =
    useRequestReassignment();
  const addComment = useAddCorrectionComment();
  const uploadAttachment =
    useUploadCorrectionAttachment();

  const request = requestQuery.data;
  const timeline = useMemo(
    () => timelineQuery.data ?? [],
    [timelineQuery.data],
  );
  const attachments = useMemo(
    () => attachmentsQuery.data ?? [],
    [attachmentsQuery.data],
  );

  const actionError =
    acceptAssignment.error ||
    startProgress.error ||
    holdWork.error ||
    resumeWork.error ||
    resolveWork.error ||
    requestReassignment.error ||
    addComment.error ||
    uploadAttachment.error;
  const isBusy =
    acceptAssignment.isPending ||
    startProgress.isPending ||
    holdWork.isPending ||
    resumeWork.isPending ||
    resolveWork.isPending ||
    requestReassignment.isPending ||
    addComment.isPending ||
    uploadAttachment.isPending;

  if (
    requestQuery.isLoading ||
    timelineQuery.isLoading ||
    attachmentsQuery.isLoading
  ) {
    return (
      <AppLoader label="Loading assignment details..." />
    );
  }

  if (requestQuery.isError) {
    return (
      <ErrorState
        title="Assignment unavailable"
        message={requestQuery.error?.message}
        onRetry={requestQuery.refetch}
      />
    );
  }

  const status = request.current_status;
  const isOwner =
    !user?.id || request.current_owner === user.id;
  const canAccept =
    isOwner &&
    ACCEPTABLE_WORK_STATUSES.includes(status);
  const canStart =
    isOwner &&
    STARTABLE_WORK_STATUSES.includes(status);
  const canHold =
    isOwner &&
    HOLDABLE_WORK_STATUSES.includes(status);
  const canResume =
    isOwner &&
    RESUMABLE_WORK_STATUSES.includes(status);
  const canResolve =
    isOwner &&
    RESOLVABLE_WORK_STATUSES.includes(status);
  const canRequestReassignment =
    isOwner &&
    REASSIGNMENT_REQUESTABLE_STATUSES.includes(
      status,
    );
  const hasActiveAction =
    canAccept ||
    canStart ||
    canHold ||
    canResume ||
    canResolve ||
    canRequestReassignment;

  function updateResolveField(field, value) {
    setResolveForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function refreshAssignmentData() {
    await Promise.all([
      requestQuery.refetch(),
      timelineQuery.refetch(),
    ]);
  }

  async function handleAccept() {
    setLocalMessage("");

    try {
      await acceptAssignment.mutateAsync({
        id: request.id,
        payload: { comment },
      });
      setComment("");
      setLocalMessage("Assignment accepted.");
      await refreshAssignmentData();
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  async function handleStartProgress() {
    setLocalMessage("");

    try {
      await startProgress.mutateAsync({
        id: request.id,
        payload: { comment },
      });
      setComment("");
      setLocalMessage("Work marked in progress.");
      await refreshAssignmentData();
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  async function handleHold() {
    if (!holdReason.trim()) {
      return;
    }

    setLocalMessage("");

    try {
      await holdWork.mutateAsync({
        id: request.id,
        payload: {
          reason: holdReason,
          expected_resume_date:
            expectedResumeDate || null,
          comment: holdComment,
        },
      });
      setHoldReason("");
      setExpectedResumeDate("");
      setHoldComment("");
      setLocalMessage(
        "Request placed on hold.",
      );
      await refreshAssignmentData();
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  async function handleResume() {
    setLocalMessage("");

    try {
      await resumeWork.mutateAsync({
        id: request.id,
        payload: { comment },
      });
      setComment("");
      setLocalMessage("Work resumed.");
      await refreshAssignmentData();
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  async function handleResolve() {
    if (
      !resolveForm.erp_action_completed.trim() ||
      !resolveForm.completion_date
    ) {
      return;
    }

    setLocalMessage("");

    try {
      await resolveWork.mutateAsync({
        id: request.id,
        payload: {
          erp_action_completed:
            resolveForm.erp_action_completed,
          completion_date:
            resolveForm.completion_date,
          erp_reference: resolveForm.erp_reference,
          actual_amount:
            resolveForm.actual_amount || null,
          actual_quantity:
            resolveForm.actual_quantity || null,
          final_comments:
            resolveForm.final_comments,
        },
      });
      setResolveForm(initialResolveForm);
      setLocalMessage(
        "Correction request resolved.",
      );
      await refreshAssignmentData();
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  async function handleRequestReassignment() {
    if (!reassignmentReason.trim()) {
      return;
    }

    const confirmed = window.confirm(
      `Request reassignment for ${request.reference}?`,
    );
    if (!confirmed) {
      return;
    }

    setLocalMessage("");

    try {
      await requestReassignment.mutateAsync({
        id: request.id,
        payload: { reason: reassignmentReason },
      });
      setReassignmentReason("");
      setLocalMessage(
        "Reassignment requested.",
      );
      await refreshAssignmentData();
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  async function handleComment() {
    if (!comment.trim()) {
      return;
    }

    setLocalMessage("");

    try {
      await addComment.mutateAsync({
        id: request.id,
        payload: { comment },
      });
      setComment("");
      setLocalMessage("Comment added.");
      await refreshAssignmentData();
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  async function handleAttachmentUpload() {
    if (!attachmentFile) {
      return;
    }

    setLocalMessage("");

    try {
      await uploadAttachment.mutateAsync({
        request: request.id,
        file: attachmentFile,
        attachment_type:
          attachmentFile.type?.startsWith("image/")
            ? "EMAIL_SCREENSHOT"
            : "SUPPORTING_DOCUMENT",
      });
      setAttachmentFile(null);
      setLocalMessage("Attachment uploaded.");
      await attachmentsQuery.refetch();
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  return (
    <div className="responsible-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Assignment Detail
          </span>
          <h1>{request.reference}</h1>
          <p>
            Assignment information, timeline and
            operational actions.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--tertiary"
            to="/responsible/assignments"
          >
            Assignments
          </Link>
        </div>
      </div>

      {localMessage ? (
        <div className="inline-alert inline-alert--success">
          <strong>{localMessage}</strong>
        </div>
      ) : null}

      {actionError ? (
        <div className="inline-alert inline-alert--error">
          <strong>{actionError.message}</strong>
        </div>
      ) : null}

      {!isOwner ? (
        <div className="inline-alert inline-alert--info">
          <ShieldAlert size={18} />
          <div>
            <strong>Read-only view</strong>
            <p>
              This request is not currently owned
              by you.
            </p>
          </div>
        </div>
      ) : null}

      <div className="request-details-layout">
        <div className="request-details-main">
          <SurfaceCard>
            <div className="surface-card__header">
              <h2>Request Summary</h2>
              <span
                className={`request-status request-status--${statusTone(
                  status,
                )}`}
              >
                {formatStatus(status)}
              </span>
            </div>
            <div className="surface-card__body">
              <dl className="request-details-grid">
                <DetailItem
                  label="Requester"
                  value={`${request.requester_employee_id || ""} ${request.requester_name || ""}`.trim()}
                />
                <DetailItem
                  label="Site"
                  value={formatCodeName({
                    code: request.site_code,
                    name: request.site_name,
                  })}
                />
                <DetailItem
                  label="Department"
                  value={formatCodeName({
                    code: request.department_code,
                    name: request.department_name,
                  })}
                />
                <DetailItem
                  label="ERP Module"
                  value={formatCodeName({
                    code: request.erp_module_code,
                    name: request.erp_module_name,
                  })}
                />
                <DetailItem
                  label="Voucher"
                  value={`${request.voucher_number || "-"} / ${request.voucher_name || "-"}`}
                />
                <DetailItem
                  label="Voucher Date"
                  value={formatDate(
                    request.voucher_date,
                  )}
                />
                <DetailItem
                  label="Work Type"
                  value={request.work_type_name}
                />
                <DetailItem
                  label="Reason"
                  value={request.reason_name}
                />
                <DetailItem
                  label="Priority"
                  value={request.priority_name}
                />
                <DetailItem
                  label="SLA Deadline"
                  value={formatDateTime(
                    request.sla_deadline,
                  )}
                />
                <DetailItem
                  label="Requested Window"
                  value={`${formatDateTime(
                    request.requested_window_start,
                  )} to ${formatDateTime(
                    request.requested_window_end,
                  )}`}
                />
                <DetailItem
                  label="Amount"
                  value={request.amount}
                />
                <DetailItem
                  label="Quantity"
                  value={request.quantity}
                />
              </dl>
              <div className="request-description">
                <strong>Description</strong>
                <p>{request.description || "-"}</p>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="surface-card__header">
              <h2>Timeline</h2>
            </div>
            <div className="surface-card__body">
              {!timeline.length ? (
                <EmptyState
                  title="No timeline found"
                  message="Assignment activity will appear here."
                />
              ) : (
                <div className="request-timeline">
                  {timeline.map((entry) => (
                    <div key={entry.id}>
                      <span />
                      <div>
                        <strong>
                          {entry.event_type.replaceAll(
                            "_",
                            " ",
                          )}
                        </strong>
                        <p>
                          {entry.comment ||
                            `${entry.from_status || "-"} to ${entry.to_status || "-"}`}
                        </p>
                        <small>
                          {entry.actor_employee_id ||
                            "System"}{" "}
                          /{" "}
                          {formatDateTime(
                            entry.created_at,
                          )}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SurfaceCard>
        </div>

        <aside className="request-details-side">
          <SurfaceCard>
            <div className="surface-card__header">
              <h2>Work Actions</h2>
            </div>
            <div className="surface-card__body request-action-stack">
              {!hasActiveAction ? (
                <span className="director-action-note">
                  {formatStatus(status)}
                </span>
              ) : null}

              {canAccept ? (
                <button
                  type="button"
                  className="button button--primary"
                  disabled={isBusy}
                  onClick={handleAccept}
                >
                  <CheckCircle2 size={16} />
                  Accept Assignment
                </button>
              ) : null}

              {canStart ? (
                <button
                  type="button"
                  className="button button--primary"
                  disabled={isBusy}
                  onClick={handleStartProgress}
                >
                  <PlayCircle size={16} />
                  Start Progress
                </button>
              ) : null}

              {canResume ? (
                <button
                  type="button"
                  className="button button--primary"
                  disabled={isBusy}
                  onClick={handleResume}
                >
                  <PlayCircle size={16} />
                  Resume Work
                </button>
              ) : null}

              {canHold ? (
                <div className="tracker-override">
                  <label className="form-field">
                    <span>Hold Reason</span>
                    <textarea
                      value={holdReason}
                      onChange={(event) =>
                        setHoldReason(
                          event.target.value,
                        )
                      }
                      rows={2}
                    />
                  </label>
                  <label className="form-field">
                    <span>
                      Expected Resume Date
                    </span>
                    <input
                      type="date"
                      value={expectedResumeDate}
                      onChange={(event) =>
                        setExpectedResumeDate(
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>Comment</span>
                    <textarea
                      value={holdComment}
                      onChange={(event) =>
                        setHoldComment(
                          event.target.value,
                        )
                      }
                      rows={2}
                    />
                  </label>
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={
                      isBusy ||
                      !holdReason.trim()
                    }
                    onClick={handleHold}
                  >
                    <PauseCircle size={16} />
                    Place On Hold
                  </button>
                </div>
              ) : null}

              {canResolve ? (
                <div className="tracker-override">
                  <label className="form-field">
                    <span>
                      ERP Action Completed
                    </span>
                    <textarea
                      value={
                        resolveForm.erp_action_completed
                      }
                      onChange={(event) =>
                        updateResolveField(
                          "erp_action_completed",
                          event.target.value,
                        )
                      }
                      rows={2}
                    />
                  </label>
                  <label className="form-field">
                    <span>Completion Date</span>
                    <input
                      type="date"
                      value={
                        resolveForm.completion_date
                      }
                      onChange={(event) =>
                        updateResolveField(
                          "completion_date",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>ERP Reference</span>
                    <input
                      type="text"
                      value={
                        resolveForm.erp_reference
                      }
                      onChange={(event) =>
                        updateResolveField(
                          "erp_reference",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>
                      Actual Amount Corrected
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={
                        resolveForm.actual_amount
                      }
                      onChange={(event) =>
                        updateResolveField(
                          "actual_amount",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>
                      Actual Quantity Corrected
                    </span>
                    <input
                      type="number"
                      step="0.001"
                      value={
                        resolveForm.actual_quantity
                      }
                      onChange={(event) =>
                        updateResolveField(
                          "actual_quantity",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>Final Comments</span>
                    <textarea
                      value={
                        resolveForm.final_comments
                      }
                      onChange={(event) =>
                        updateResolveField(
                          "final_comments",
                          event.target.value,
                        )
                      }
                      rows={2}
                    />
                  </label>
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={
                      isBusy ||
                      !resolveForm.erp_action_completed.trim() ||
                      !resolveForm.completion_date
                    }
                    onClick={handleResolve}
                  >
                    <CheckCircle2 size={16} />
                    Mark Resolved
                  </button>
                </div>
              ) : null}

              <label className="form-field">
                <span>Comment</span>
                <textarea
                  value={comment}
                  onChange={(event) =>
                    setComment(event.target.value)
                  }
                  rows={3}
                />
              </label>
              <button
                type="button"
                className="button button--secondary"
                disabled={
                  isBusy || !comment.trim()
                }
                onClick={handleComment}
              >
                <MessageSquareText size={16} />
                Add Comment
              </button>

              {canRequestReassignment ? (
                <div className="tracker-override">
                  <label className="form-field">
                    <span>
                      Request Reassignment Reason
                    </span>
                    <textarea
                      value={reassignmentReason}
                      onChange={(event) =>
                        setReassignmentReason(
                          event.target.value,
                        )
                      }
                      rows={2}
                    />
                  </label>
                  <button
                    type="button"
                    className="button button--tertiary"
                    disabled={
                      isBusy ||
                      !reassignmentReason.trim()
                    }
                    onClick={
                      handleRequestReassignment
                    }
                  >
                    <RotateCcw size={16} />
                    Request Reassignment
                  </button>
                </div>
              ) : null}
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="surface-card__header">
              <h2>Attachments</h2>
            </div>
            <div className="surface-card__body request-attachment-section">
              <label className="file-upload-control">
                <Upload size={18} />
                <span>
                  {attachmentFile
                    ? attachmentFile.name
                    : "Upload evidence"}
                </span>
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xlsm,.xls,.csv,.jpg,.jpeg,.png,.webp,.gif"
                  onChange={(event) =>
                    setAttachmentFile(
                      event.target.files?.[0] ??
                        null,
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="button button--secondary"
                disabled={
                  isBusy || !attachmentFile
                }
                onClick={handleAttachmentUpload}
              >
                <Paperclip size={16} />
                Upload Attachment
              </button>

              <div className="request-attachment-list">
                {!attachments.length ? (
                  <span>No attachments.</span>
                ) : (
                  attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.download_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Paperclip size={15} />
                      <span>
                        {attachment.original_name}
                      </span>
                    </a>
                  ))
                )}
              </div>
            </div>
          </SurfaceCard>
        </aside>
      </div>
    </div>
  );
}
