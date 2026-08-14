import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { queryKeys } from "../constants/queryKeys";
import {
  correctionRequestService,
} from "../services/correctionRequestService";

function invalidateCorrectionQueries(queryClient) {
  queryClient.invalidateQueries({
    queryKey: ["corrections"],
  });
}

export function useCorrectionDashboard() {
  return useQuery({
    queryKey: queryKeys.correctionDashboard,
    queryFn:
      correctionRequestService.getDashboard.bind(
        correctionRequestService,
      ),
    refetchInterval: 60_000,
  });
}

export function useCorrectionAnalytics() {
  return useQuery({
    queryKey: queryKeys.correctionAnalytics,
    queryFn:
      correctionRequestService.getAnalytics.bind(
        correctionRequestService,
      ),
    refetchInterval: 60_000,
  });
}

export function useCorrectionRequests(
  params,
  options = {},
) {
  return useQuery({
    queryKey:
      queryKeys.correctionRequests(params),
    queryFn: () =>
      correctionRequestService.getRequests(params),
    enabled: options.enabled ?? true,
  });
}

export function useCorrectionRequest(id) {
  return useQuery({
    queryKey: queryKeys.correctionRequest(id),
    queryFn: () =>
      correctionRequestService.getRequest(id),
    enabled: Boolean(id),
  });
}

export function useCorrectionTimeline(requestId) {
  return useQuery({
    queryKey:
      queryKeys.correctionTimeline(requestId),
    queryFn: () =>
      correctionRequestService.getTimeline(
        requestId,
      ),
    enabled: Boolean(requestId),
  });
}

export function useCorrectionAttachments(
  requestId,
) {
  return useQuery({
    queryKey:
      queryKeys.correctionAttachments(requestId),
    queryFn: () =>
      correctionRequestService.getAttachments(
        requestId,
      ),
    enabled: Boolean(requestId),
  });
}

export function useMyCorrectionRequests(params) {
  return useQuery({
    queryKey:
      queryKeys.correctionMyRequests(params),
    queryFn: () =>
      correctionRequestService.getMyRequests(params),
  });
}

export function useMyAssignments(params) {
  return useQuery({
    queryKey:
      queryKeys.correctionMyAssignments(params),
    queryFn: () =>
      correctionRequestService.getMyAssignments(
        params,
      ),
    refetchInterval: 60_000,
  });
}

export function useAssignmentCounts() {
  return useQuery({
    queryKey: queryKeys.correctionAssignmentCounts,
    queryFn:
      correctionRequestService.getAssignmentCounts.bind(
        correctionRequestService,
      ),
    refetchInterval: 60_000,
  });
}

export function useAssignmentAnalytics() {
  return useQuery({
    queryKey:
      queryKeys.correctionAssignmentAnalytics,
    queryFn:
      correctionRequestService.getAssignmentAnalytics.bind(
        correctionRequestService,
      ),
    refetchInterval: 60_000,
  });
}

export function useAcceptAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.acceptAssignment(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useRequestReassignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.requestReassignment(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useStartProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.startProgress(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useHoldWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.holdWork(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useResumeWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.resumeWork(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useResolveWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.resolveWork(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useCreateCorrectionDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      correctionRequestService.createDraft,
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useUpdateCorrectionDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.updateDraft(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useDeleteCorrectionDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      correctionRequestService.deleteDraft,
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useSubmitCorrectionRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.submitRequest(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useCancelCorrectionRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.cancelRequest(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useAddCorrectionComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.addComment(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useConfirmCorrectionResolution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.confirmResolution(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useReopenCorrectionRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.reopenRequest(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useAssignCorrectionRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.assignRequest(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useReassignCorrectionRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.reassignRequest(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useUploadCorrectionAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      correctionRequestService.uploadAttachment,
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useApprovalInbox(params) {
  return useQuery({
    queryKey: queryKeys.approvalInbox(params),
    queryFn: () =>
      correctionRequestService.getApprovalInbox(
        params,
      ),
  });
}

export function useApprovalSteps(params) {
  return useQuery({
    queryKey: queryKeys.approvalSteps(params),
    queryFn: () =>
      correctionRequestService.getApprovalSteps(
        params,
      ),
  });
}

export function useApprovalStep(id) {
  return useQuery({
    queryKey: queryKeys.approvalStep(id),
    queryFn: () =>
      correctionRequestService.getApprovalStep(id),
    enabled: Boolean(id),
  });
}

export function useApprovalHistory(id) {
  return useQuery({
    queryKey: queryKeys.approvalHistory(id),
    queryFn: () =>
      correctionRequestService.getApprovalHistory(
        id,
      ),
    enabled: Boolean(id),
  });
}

export function useApprovalPendingCounts() {
  return useQuery({
    queryKey: queryKeys.approvalPendingCounts,
    queryFn:
      correctionRequestService.getApprovalPendingCounts.bind(
        correctionRequestService,
      ),
    refetchInterval: 60_000,
  });
}

export function useApproveApprovalStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.approveApprovalStep(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useRejectApprovalStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.rejectApprovalStep(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useReturnApprovalStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.returnApprovalStep(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useCommentApprovalStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.commentApprovalStep(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

export function useDelegateApprovalStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      correctionRequestService.delegateApprovalStep(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}

