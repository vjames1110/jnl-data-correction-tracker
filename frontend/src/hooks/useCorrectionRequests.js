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

export function useCorrectionRequests(params) {
  return useQuery({
    queryKey:
      queryKeys.correctionRequests(params),
    queryFn: () =>
      correctionRequestService.getRequests(params),
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

export function useMyCorrectionRequests(params) {
  return useQuery({
    queryKey:
      queryKeys.correctionMyRequests(params),
    queryFn: () =>
      correctionRequestService.getMyRequests(params),
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

export function useUploadCorrectionAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      correctionRequestService.uploadAttachment,
    onSuccess: () =>
      invalidateCorrectionQueries(queryClient),
  });
}
