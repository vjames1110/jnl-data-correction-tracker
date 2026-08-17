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

export function useNotificationUnreadCount(
  options = {},
) {
  return useQuery({
    queryKey: queryKeys.notificationUnreadCount,
    queryFn:
      notificationService.getUnreadCount.bind(
        notificationService,
      ),
    enabled: options.enabled ?? true,
    refetchInterval:
      options.refetchInterval ?? 60_000,
  });
}

function invalidateNotificationQueries(queryClient) {
  queryClient.invalidateQueries({
    queryKey: ["notifications"],
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) =>
      notificationService.markRead(id),
    onSuccess: () =>
      invalidateNotificationQueries(queryClient),
  });
}

export function useMarkNotificationUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) =>
      notificationService.markUnread(id),
    onSuccess: () =>
      invalidateNotificationQueries(queryClient),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      notificationService.markAllRead.bind(
        notificationService,
      ),
    onSuccess: () =>
      invalidateNotificationQueries(queryClient),
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
