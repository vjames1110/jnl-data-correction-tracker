import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  MessageSquareText,
  Paperclip,
  RotateCcw,
  UserRoundPlus,
  XCircle,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { USER_ROLES } from "../../../constants/roles";
import {
  useApprovalHistory,
  useApprovalStep,
  useApprovalSteps,
  useApproveApprovalStep,
  useCommentApprovalStep,
  useCorrectionAttachments,
  useCorrectionRequest,
  useCorrectionRequests,
  useCorrectionTimeline,
  useDelegateApprovalStep,
  useRejectApprovalStep,
  useReturnApprovalStep,
} from "../../../hooks/useCorrectionRequests";
import {
  useUsersDropdown,
} from "../../../hooks/useOrganization";
import { AssignmentPanel } from "../../corrections/components/AssignmentPanel";
import {
  ASSIGNABLE_REQUEST_STATUSES,
  REASSIGNABLE_REQUEST_STATUSES,
} from "../../corrections/utils/requestStatusDisplay";
import {
  approvalStatusTone,
  formatApprovalStatus,
  formatCodeName,
  formatDate,
  formatDateTime,
  formatPerson,
  getAgeingLabel,
  getSlaState,
} from "../utils/approvalDisplay";

function DetailItem({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </div>
  );
}

function pickRequestId(approval) {
  return approval?.request || null;
}

function isDuplicateCandidate(item, request) {
  if (!item || !request || item.id === request.id) {
    return false;
  }

  const sameVoucher =
    item.voucher_type === request.voucher_type ||
    item.voucher_code === request.voucher_code;
  const sameVoucherNumber =
    request.voucher_number &&
    item.voucher_number === request.voucher_number;

  return Boolean(sameVoucher && sameVoucherNumber);
}

function isPreviousIssue(item, request) {
  if (!item || !request || item.id === request.id) {
    return false;
  }

  return [
    "REJECTED",
    "REOPENED",
    "CANCELLED",
    "CLOSED",
    "RESOLVED",
  ].includes(item.current_status);
}

export function DirectorApprovalDetailPage() {
  const { approvalId } = useParams();
  const [comment, setComment] = useState("");
  const [delegateTo, setDelegateTo] =
    useState("");
  const [localMessage, setLocalMessage] =
    useState("");
  const approvalQuery = useApprovalStep(approvalId);
  const approval = approvalQuery.data;
  const requestId = pickRequestId(approval);

  const requestQuery =
    useCorrectionRequest(requestId);
  const attachmentsQuery =
    useCorrectionAttachments(requestId);
  const timelineQuery =
    useCorrectionTimeline(requestId);
  const routeQuery = useApprovalSteps({
    request: requestId,
    page_size: 50,
    ordering: "sequence",
  });
  const historyQuery =
    useApprovalHistory(approvalId);
  const usersQuery = useUsersDropdown();
  const approveStep = useApproveApprovalStep();
  const rejectStep = useRejectApprovalStep();
  const returnStep = useReturnApprovalStep();
  const commentStep = useCommentApprovalStep();
  const delegateStep = useDelegateApprovalStep();

  const request = requestQuery.data;
  const previousQuery = useCorrectionRequests(
    {
      requester: request?.requester,
      page_size: 25,
      ordering: "-submitted_at,-created_at",
    },
    {
      enabled: Boolean(request?.requester),
    },
  );

  const attachments = useMemo(
    () => attachmentsQuery.data ?? [],
    [attachmentsQuery.data],
  );
  const timeline = useMemo(
    () => timelineQuery.data ?? [],
    [timelineQuery.data],
  );
  const routeSteps = useMemo(
    () => routeQuery.data?.items ?? [],
    [routeQuery.data],
  );
  const approvalHistory = useMemo(
    () => historyQuery.data ?? [],
    [historyQuery.data],
  );
  const previousRequests = useMemo(
    () => previousQuery.data?.items ?? [],
    [previousQuery.data],
  );
  const delegateUsers = useMemo(
    () =>
      (usersQuery.data ?? []).filter(
        (user) =>
          [
            USER_ROLES.DIRECTOR,
            USER_ROLES.ADMIN,
            USER_ROLES.SUPER_ADMIN,
          ].includes(user.role) &&
          user.id !== approval?.approver,
      ),
    [approval?.approver, usersQuery.data],
  );
  const actionError =
    approveStep.error ||
    rejectStep.error ||
    returnStep.error ||
    commentStep.error ||
    delegateStep.error;
  const isActionBusy =
    approveStep.isPending ||
    rejectStep.isPending ||
    returnStep.isPending ||
    commentStep.isPending ||
    delegateStep.isPending;
  const duplicateCandidates = useMemo(
    () =>
      previousRequests.filter((item) =>
        isDuplicateCandidate(item, request),
      ),
    [previousRequests, request],
  );
  const previousIssues = useMemo(
    () =>
      previousRequests
        .filter((item) =>
          isPreviousIssue(item, request),
        )
        .slice(0, 6),
    [previousRequests, request],
  );

  const isLoading =
    approvalQuery.isLoading ||
    requestQuery.isLoading ||
    attachmentsQuery.isLoading ||
    timelineQuery.isLoading ||
    routeQuery.isLoading ||
    historyQuery.isLoading;

  if (isLoading) {
    return (
      <AppLoader label="Loading approval details..." />
    );
  }

  if (
    approvalQuery.isError ||
    requestQuery.isError
  ) {
    return (
      <ErrorState
        title="Approval unavailable"
        message={
          approvalQuery.error?.message ||
          requestQuery.error?.message
        }
        onRetry={() => {
          approvalQuery.refetch();
          requestQuery.refetch();
        }}
      />
    );
  }

  const slaState = getSlaState(approval);
  const canAct =
    approval.status === "PENDING" &&
    approval.is_current &&
    request.current_status === "PENDING_APPROVAL";

  async function refreshApprovalData() {
    await Promise.all([
      approvalQuery.refetch(),
      requestQuery.refetch(),
      routeQuery.refetch(),
      historyQuery.refetch(),
      timelineQuery.refetch(),
    ]);
  }

  async function runAction(
    mutation,
    successMessage,
    payload = {},
  ) {
    setLocalMessage("");

    try {
      await mutation.mutateAsync({
        id: approval.id,
        payload,
      });
      setLocalMessage(successMessage);
      await refreshApprovalData();
    } catch {
      // Mutation error is shown in the inline alert.
    }
  }

  function requireComment(actionName) {
    if (!comment.trim()) {
      setLocalMessage("");
      return false;
    }

    return window.confirm(
      `${actionName} ${request.reference}?`,
    );
  }

  return (
    <div className="director-approval-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Approval Detail
          </span>
          <h1>{request.reference}</h1>
          <p>
            Request, voucher, route and history for
            director review.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--tertiary"
            to="/director/approvals"
          >
            Approval Inbox
          </Link>
        </div>
      </div>

      {duplicateCandidates.length ? (
        <div className="inline-alert inline-alert--error director-duplicate-alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Duplicate warning</strong>
            <p>
              Similar voucher number found in{" "}
              {duplicateCandidates
                .map((item) => item.reference)
                .join(", ")}
              .
            </p>
          </div>
        </div>
      ) : null}

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

      <div className="director-detail-layout">
        <div className="director-detail-main">
          <SurfaceCard>
            <div className="surface-card__header">
              <h2>Request Summary</h2>
              <span
                className={`request-status request-status--${approvalStatusTone(
                  approval.status,
                )}`}
              >
                {formatApprovalStatus(
                  approval.status,
                )}
              </span>
            </div>
            <div className="surface-card__body">
              <dl className="request-details-grid director-meta-grid">
                <DetailItem
                  label="Requester"
                  value={formatPerson({
                    employeeId:
                      request.requester_employee_id,
                    name: request.requester_name,
                  })}
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
                  label="Current Owner"
                  value={formatPerson({
                    employeeId:
                      request.current_owner_employee_id,
                    name: request.current_owner_name,
                  })}
                />
                <DetailItem
                  label="Status"
                  value={request.current_status}
                />
                <DetailItem
                  label="Priority"
                  value={request.priority_name}
                />
                <DetailItem
                  label="Submitted"
                  value={formatDateTime(
                    request.submitted_at,
                  )}
                />
                <DetailItem
                  label="Ageing"
                  value={getAgeingLabel(
                    request.submitted_at ||
                      request.created_at,
                  )}
                />
                <DetailItem
                  label="SLA"
                  value={slaState.label}
                />
                <DetailItem
                  label="Due At"
                  value={formatDateTime(
                    approval.due_at ||
                      request.sla_deadline,
                  )}
                />
              </dl>
              <div className="request-description">
                <strong>Description</strong>
                <p>{request.description || "-"}</p>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Voucher Details">
            <dl className="request-details-grid director-meta-grid">
              <DetailItem
                label="ERP Module"
                value={formatCodeName({
                  code: request.erp_module_code,
                  name: request.erp_module_name,
                })}
              />
              <DetailItem
                label="Voucher Type"
                value={formatCodeName({
                  code: request.voucher_code,
                  name: request.voucher_name,
                })}
              />
              <DetailItem
                label="Voucher Number"
                value={request.voucher_number}
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
                label="Amount"
                value={request.amount}
              />
              <DetailItem
                label="Quantity"
                value={request.quantity}
              />
            </dl>
          </SurfaceCard>

          <SurfaceCard title="Approval Route">
            {!routeSteps.length ? (
              <EmptyState
                title="No route found"
                message="Approval route details are unavailable."
              />
            ) : (
              <div className="director-route-list">
                {routeSteps.map((step) => (
                  <div key={step.id}>
                    <span>{step.sequence}</span>
                    <div>
                      <strong>
                        {step.level_name ||
                          step.approver_type}
                      </strong>
                      <p>
                        {formatPerson({
                          employeeId:
                            step.approver_employee_id,
                          name: step.approver_name,
                        })}
                      </p>
                      <small>
                        {formatApprovalStatus(
                          step.status,
                        )}{" "}
                        / Due{" "}
                        {formatDateTime(step.due_at)}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard title="History">
            {!timeline.length &&
            !approvalHistory.length ? (
              <EmptyState
                title="No history found"
                message="Request history will appear here."
              />
            ) : (
              <div className="request-timeline">
                {[...approvalHistory, ...timeline].map(
                  (entry) => (
                    <div
                      key={`${entry.id}-${entry.created_at}`}
                    >
                      <span />
                      <div>
                        <strong>
                          {String(
                            entry.action ||
                              entry.event_type ||
                              "History",
                          ).replaceAll("_", " ")}
                        </strong>
                        <p>
                          {entry.comment ||
                            `${entry.from_status || "-"} to ${entry.to_status || "-"}`}
                        </p>
                        <small>
                          {entry.actor_employee_id ||
                            entry.performed_by_employee_id ||
                            "System"}{" "}
                          /{" "}
                          {formatDateTime(
                            entry.created_at,
                          )}
                        </small>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </SurfaceCard>
        </div>

        <aside className="director-detail-side">
          <SurfaceCard title="Approval Actions">
            <div className="request-action-stack">
              <label className="form-field">
                <span>Comment</span>
                <textarea
                  value={comment}
                  onChange={(event) =>
                    setComment(event.target.value)
                  }
                  rows={3}
                  disabled={!canAct || isActionBusy}
                />
              </label>

              <button
                type="button"
                className="button button--primary"
                disabled={!canAct || isActionBusy}
                onClick={() =>
                  runAction(
                    approveStep,
                    "Request approved.",
                    { comment },
                  )
                }
              >
                <CheckCircle2 size={16} />
                Approve
              </button>

              <button
                type="button"
                className="button button--tertiary"
                disabled={
                  !canAct ||
                  isActionBusy ||
                  !comment.trim()
                }
                onClick={() => {
                  if (!requireComment("Reject")) {
                    return;
                  }

                  runAction(
                    rejectStep,
                    "Request rejected.",
                    { comment },
                  );
                }}
              >
                <XCircle size={16} />
                Reject
              </button>

              <button
                type="button"
                className="button button--secondary"
                disabled={
                  !canAct ||
                  isActionBusy ||
                  !comment.trim()
                }
                onClick={() => {
                  if (!requireComment("Return")) {
                    return;
                  }

                  runAction(
                    returnStep,
                    "Request returned.",
                    { comment },
                  );
                }}
              >
                <RotateCcw size={16} />
                Return
              </button>

              <button
                type="button"
                className="button button--secondary"
                disabled={
                  !canAct ||
                  isActionBusy ||
                  !comment.trim()
                }
                onClick={() =>
                  runAction(
                    commentStep,
                    "Comment added.",
                    { comment },
                  )
                }
              >
                <MessageSquareText size={16} />
                Comment
              </button>

              <label className="form-field">
                <span>Delegate To</span>
                <select
                  value={delegateTo}
                  onChange={(event) =>
                    setDelegateTo(event.target.value)
                  }
                  disabled={!canAct || isActionBusy}
                >
                  <option value="">
                    Select delegate
                  </option>
                  {delegateUsers.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.label ||
                        `${user.employee_id} - ${user.full_name}`}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="button button--tertiary"
                disabled={
                  !canAct ||
                  isActionBusy ||
                  !delegateTo
                }
                onClick={() =>
                  runAction(
                    delegateStep,
                    "Approval delegated.",
                    {
                      comment,
                      delegate_to: delegateTo,
                    },
                  )
                }
              >
                <UserRoundPlus size={16} />
                Delegate
              </button>

              {!canAct ? (
                <span className="director-action-note">
                  {formatApprovalStatus(
                    approval.status,
                  )}
                </span>
              ) : null}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Supporting Documents">
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
          </SurfaceCard>

          <SurfaceCard title="Previous Employee Records">
            {!previousIssues.length ? (
              <EmptyState
                title="No previous issues"
                message="No completed or rejected records were found for this requester."
              />
            ) : (
              <div className="request-mini-list director-previous-list">
                {previousIssues.map((item) => (
                  <Link
                    key={item.id}
                    to={`/user/requests/${item.id}`}
                  >
                    <FileText size={15} />
                    <span>
                      <strong>
                        {item.reference}
                      </strong>
                      {item.current_status} /{" "}
                      {formatDateTime(
                        item.submitted_at ||
                          item.created_at,
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard title="Current Step">
            <dl className="request-details-grid director-side-grid">
              <DetailItem
                label="Level"
                value={
                  approval.level_name ||
                  approval.approver_type
                }
              />
              <DetailItem
                label="Approver"
                value={formatPerson({
                  employeeId:
                    approval.approver_employee_id,
                  name: approval.approver_name,
                })}
              />
              <DetailItem
                label="Due"
                value={formatDateTime(approval.due_at)}
              />
              <DetailItem
                label="Escalates"
                value={formatDateTime(
                  approval.escalates_at,
                )}
              />
            </dl>
          </SurfaceCard>

          {request &&
          (ASSIGNABLE_REQUEST_STATUSES.includes(
            request.current_status,
          ) ||
            REASSIGNABLE_REQUEST_STATUSES.includes(
              request.current_status,
            )) ? (
            <SurfaceCard title="Assignment">
              <AssignmentPanel request={request} />
            </SurfaceCard>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
