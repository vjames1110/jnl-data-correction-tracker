import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  MessageSquareText,
  Paperclip,
  RefreshCcw,
  Send,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useAddCorrectionComment,
  useCancelCorrectionRequest,
  useConfirmCorrectionResolution,
  useCorrectionAttachments,
  useCorrectionRequest,
  useCorrectionTimeline,
  useReopenCorrectionRequest,
  useSubmitCorrectionRequest,
  useUploadCorrectionAttachment,
} from "../../../hooks/useCorrectionRequests";
import {
  formatDate,
  formatDateTime,
  formatStatus,
  statusTone,
} from "../utils/requestDisplay";

function DetailItem({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </div>
  );
}

function downloadRequestDetails({
  request,
  timeline,
  attachments,
}) {
  const payload = {
    request,
    timeline,
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      original_name: attachment.original_name,
      attachment_type: attachment.attachment_type,
      content_type: attachment.content_type,
      size_bytes: attachment.size_bytes,
      uploaded_by: attachment.uploaded_by_employee_id,
      created_at: attachment.created_at,
    })),
  };
  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    {
      type: "application/json;charset=utf-8",
    },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${request.reference}-details.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getDuplicateMatches(error) {
  const duplicates =
    error?.errors?.duplicate_requests ?? [];

  return Array.isArray(duplicates)
    ? duplicates
    : [];
}

export function RequestDetailsPage() {
  const { requestId } = useParams();
  const [comment, setComment] = useState("");
  const [cancelReason, setCancelReason] =
    useState("");
  const [reopenReason, setReopenReason] =
    useState("");
  const [attachmentFile, setAttachmentFile] =
    useState(null);
  const [localMessage, setLocalMessage] =
    useState("");
  const [duplicateState, setDuplicateState] =
    useState(null);
  const [overrideReason, setOverrideReason] =
    useState("");

  const requestQuery =
    useCorrectionRequest(requestId);
  const timelineQuery =
    useCorrectionTimeline(requestId);
  const attachmentsQuery =
    useCorrectionAttachments(requestId);
  const submitRequest =
    useSubmitCorrectionRequest();
  const cancelRequest =
    useCancelCorrectionRequest();
  const addComment = useAddCorrectionComment();
  const confirmResolution =
    useConfirmCorrectionResolution();
  const reopenRequest =
    useReopenCorrectionRequest();
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
    submitRequest.error ??
    cancelRequest.error ??
    addComment.error ??
    confirmResolution.error ??
    reopenRequest.error ??
    uploadAttachment.error;

  const approvalHistory = useMemo(
    () =>
      timeline.filter((entry) =>
        [
          "SUBMITTED",
          "APPROVAL_ACTION",
          "STATUS_CHANGED",
          "CLOSED",
          "REOPENED",
        ].includes(entry.event_type),
      ),
    [timeline],
  );
  const assignmentHistory = useMemo(
    () =>
      timeline.filter((entry) =>
        ["ASSIGNED", "SUBMITTED"].includes(
          entry.event_type,
        ),
      ),
    [timeline],
  );
  const comments = useMemo(
    () =>
      timeline.filter(
        (entry) => entry.event_type === "COMMENT",
      ),
    [timeline],
  );

  const isBusy =
    submitRequest.isPending ||
    cancelRequest.isPending ||
    addComment.isPending ||
    confirmResolution.isPending ||
    reopenRequest.isPending ||
    uploadAttachment.isPending;

  async function handleSubmitDraft() {
    setLocalMessage("");
    setDuplicateState(null);

    try {
      const submitted =
        await submitRequest.mutateAsync({
          id: request.id,
          payload: {
            override_duplicates: false,
          },
        });
      setLocalMessage(
        `${submitted.reference} submitted successfully.`,
      );
    } catch (error) {
      const duplicates =
        getDuplicateMatches(error);
      if (duplicates.length) {
        setDuplicateState(duplicates);
      }
    }
  }

  async function handleSubmitWithOverride() {
    setLocalMessage("");

    try {
      const submitted =
        await submitRequest.mutateAsync({
          id: request.id,
          payload: {
            override_duplicates: true,
            duplicate_override_reason:
              overrideReason,
          },
        });
      setDuplicateState(null);
      setOverrideReason("");
      setLocalMessage(
        `${submitted.reference} submitted with duplicate override.`,
      );
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  async function handleCancel() {
    const confirmed = window.confirm(
      `Cancel ${request.reference}?`,
    );
    if (!confirmed) {
      return;
    }

    setLocalMessage("");
    setDuplicateState(null);

    try {
      await cancelRequest.mutateAsync({
        id: request.id,
        payload: {
          reason: cancelReason,
        },
      });
      setCancelReason("");
      setLocalMessage("Request cancelled.");
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  async function handleComment() {
    setLocalMessage("");
    setDuplicateState(null);

    try {
      await addComment.mutateAsync({
        id: request.id,
        payload: {
          comment,
        },
      });
      setComment("");
      setLocalMessage("Response added.");
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  async function handleConfirmResolution() {
    setLocalMessage("");
    setDuplicateState(null);

    try {
      await confirmResolution.mutateAsync({
        id: request.id,
        payload: {
          comment:
            comment ||
            "Resolution confirmed by requester.",
        },
      });
      setComment("");
      setLocalMessage("Resolution confirmed.");
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  async function handleReopen() {
    setLocalMessage("");
    setDuplicateState(null);

    try {
      await reopenRequest.mutateAsync({
        id: request.id,
        payload: {
          comment: reopenReason,
        },
      });
      setReopenReason("");
      setLocalMessage("Request reopened.");
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  async function handleAttachmentUpload() {
    if (!attachmentFile) {
      return;
    }

    setLocalMessage("");
    setDuplicateState(null);

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
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  if (
    requestQuery.isLoading ||
    timelineQuery.isLoading ||
    attachmentsQuery.isLoading
  ) {
    return (
      <AppLoader label="Loading request details..." />
    );
  }

  if (requestQuery.isError) {
    return (
      <ErrorState
        title="Request unavailable"
        message={requestQuery.error?.message}
        onRetry={requestQuery.refetch}
      />
    );
  }

  return (
    <div className="request-details-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Request Details
          </span>
          <h1>{request.reference}</h1>
          <p>
            Complete request information,
            timeline, attachments and requester
            actions.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--tertiary"
            to="/user/requests"
          >
            My Requests
          </Link>
          {request.current_status === "DRAFT" ? (
            <Link
              className="button button--secondary"
              to={`/user/requests/${request.id}/continue`}
            >
              Continue Draft
            </Link>
          ) : null}
          <button
            type="button"
            className="button button--primary"
            onClick={() =>
              downloadRequestDetails({
                request,
                timeline,
                attachments,
              })
            }
          >
            <Download size={16} />
            Download Details
          </button>
        </div>
      </div>

      {localMessage ? (
        <div className="inline-alert inline-alert--success">
          <strong>{localMessage}</strong>
        </div>
      ) : null}

      {actionError && !duplicateState ? (
        <div className="inline-alert inline-alert--error">
          <strong>{actionError.message}</strong>
        </div>
      ) : null}

      {duplicateState ? (
        <div className="inline-alert inline-alert--error tracker-duplicate-alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Duplicate request found.</strong>
            <p>
              Existing references:{" "}
              {duplicateState
                .map((item) => item.reference)
                .join(", ")}
            </p>
          </div>
        </div>
      ) : null}

      <div className="request-details-layout">
        <div className="request-details-main">
          <SurfaceCard>
            <div className="surface-card__header">
              <h2>Complete Request Information</h2>
              <span
                className={`request-status request-status--${statusTone(
                  request.current_status,
                )}`}
              >
                {formatStatus(request.current_status)}
              </span>
            </div>
            <div className="surface-card__body">
              <dl className="request-details-grid">
                <DetailItem
                  label="Requester"
                  value={`${request.requester_employee_id} - ${request.requester_name}`}
                />
                <DetailItem
                  label="Site"
                  value={`${request.site_code || ""} ${request.site_name || ""}`.trim()}
                />
                <DetailItem
                  label="Department"
                  value={`${request.department_code || ""} ${request.department_name || ""}`.trim()}
                />
                <DetailItem
                  label="ERP Module"
                  value={`${request.erp_module_code || ""} ${request.erp_module_name || ""}`.trim()}
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
                  label="Correction Type"
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
                  label="Current Owner"
                  value={
                    request.current_owner_name &&
                    request.current_owner_employee_id
                      ? `${request.current_owner_name} (${request.current_owner_employee_id})`
                      : request.current_owner_name ||
                        request.current_owner_employee_id
                  }
                />
                <DetailItem
                  label="SLA Deadline"
                  value={formatDateTime(
                    request.sla_deadline,
                  )}
                />
                <DetailItem
                  label="Submitted"
                  value={formatDateTime(
                    request.submitted_at,
                  )}
                />
                <DetailItem
                  label="Amount"
                  value={request.amount}
                />
                <DetailItem
                  label="Quantity"
                  value={request.quantity}
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
                  label="Latest Update"
                  value={formatDateTime(
                    request.updated_at,
                  )}
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
                  message="Request actions will appear here."
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
              <h2>Available Actions</h2>
            </div>
            <div className="surface-card__body request-action-stack">
              {request.current_status === "DRAFT" ? (
                <>
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={isBusy}
                    onClick={handleSubmitDraft}
                  >
                    <Send size={16} />
                    Submit
                  </button>

                  {duplicateState ? (
                    <div className="tracker-override">
                      <label className="form-field">
                        <span>
                          Duplicate Override Reason
                        </span>
                        <textarea
                          value={overrideReason}
                          onChange={(event) =>
                            setOverrideReason(
                              event.target.value,
                            )
                          }
                          rows={3}
                        />
                      </label>
                      <button
                        type="button"
                        className="button button--primary"
                        disabled={
                          isBusy ||
                          overrideReason.trim()
                            .length < 10
                        }
                        onClick={
                          handleSubmitWithOverride
                        }
                      >
                        <Send size={16} />
                        Submit With Override
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}

              {[
                "DRAFT",
                "SUBMITTED",
                "PENDING_APPROVAL",
                "APPROVED",
                "ASSIGNED",
                "REOPENED",
              ].includes(request.current_status) ? (
                <>
                  <label className="form-field">
                    <span>Cancel Reason</span>
                    <textarea
                      value={cancelReason}
                      onChange={(event) =>
                        setCancelReason(
                          event.target.value,
                        )
                      }
                      rows={2}
                    />
                  </label>
                  <button
                    type="button"
                    className="button button--tertiary"
                    disabled={isBusy}
                    onClick={handleCancel}
                  >
                    <XCircle size={16} />
                    Cancel
                  </button>
                </>
              ) : null}

              <label className="form-field">
                <span>Response / Comment</span>
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
                Respond
              </button>

              {request.current_status ===
              "RESOLVED" ? (
                <button
                  type="button"
                  className="button button--primary"
                  disabled={isBusy}
                  onClick={handleConfirmResolution}
                >
                  <ShieldCheck size={16} />
                  Confirm Resolution
                </button>
              ) : null}

              {[
                "RESOLVED",
                "CLOSED",
              ].includes(request.current_status) ? (
                <>
                  <label className="form-field">
                    <span>Reopen Reason</span>
                    <textarea
                      value={reopenReason}
                      onChange={(event) =>
                        setReopenReason(
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
                      !reopenReason.trim()
                    }
                    onClick={handleReopen}
                  >
                    <RefreshCcw size={16} />
                    Reopen
                  </button>
                </>
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
                    : "Upload supporting file"}
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

          <SurfaceCard>
            <div className="surface-card__header">
              <h2>Approval And Assignment</h2>
            </div>
            <div className="surface-card__body request-mini-list">
              <strong>Approval History</strong>
              {approvalHistory.length ? (
                approvalHistory.map((entry) => (
                  <p key={entry.id}>
                    {entry.event_type.replaceAll(
                      "_",
                      " ",
                    )}{" "}
                    / {formatDateTime(entry.created_at)}
                  </p>
                ))
              ) : (
                <p>No approval history.</p>
              )}
              <strong>Assignment</strong>
              {assignmentHistory.length ? (
                assignmentHistory.map((entry) => (
                  <p key={entry.id}>
                    {entry.comment ||
                      entry.event_type}
                  </p>
                ))
              ) : (
                <p>No assignment history.</p>
              )}
              <strong>Comments</strong>
              {comments.length ? (
                comments.map((entry) => (
                  <p key={entry.id}>
                    {entry.comment}
                  </p>
                ))
              ) : (
                <p>No comments.</p>
              )}
              <strong>Resolution</strong>
              <p>
                {request.current_status ===
                  "RESOLVED" ||
                request.current_status === "CLOSED"
                  ? formatStatus(
                      request.current_status,
                    )
                  : "Not resolved"}
              </p>
            </div>
          </SurfaceCard>
        </aside>
      </div>
    </div>
  );
}
