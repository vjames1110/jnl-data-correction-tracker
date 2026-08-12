import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { queryKeys } from "../constants/queryKeys";
import {
  notificationService,
} from "../services/notificationService";

export function useNotifications(
  params = {},
  options = {},
) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: () =>
      notificationService.getNotifications(params),
    enabled: options.enabled ?? true,
    refetchInterval:
      options.refetchInterval ?? 60_000,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notificationPreferences,
    queryFn:
      notificationService.getPreferences.bind(
        notificationService,
      ),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      notificationService.updatePreferences(
        payload,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey:
          queryKeys.notificationPreferences,
      }),
  });
}
