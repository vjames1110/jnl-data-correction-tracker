import { useQuery } from "@tanstack/react-query";

import {
  queryKeys,
} from "../constants/queryKeys";
import {
  adminService,
} from "../services/adminService";

export function useDashboard(
  period = "30d",
) {
  return useQuery({
    queryKey:
      queryKeys.adminDashboard(period),
    queryFn: () =>
      adminService.getDashboard(period),
    refetchInterval: 60_000,
  });
}

export function useRecentActivity(
  limit = 10,
) {
  return useQuery({
    queryKey:
      queryKeys.adminRecentActivity(limit),
    queryFn: () =>
      adminService.getRecentActivity(limit),
    refetchInterval: 60_000,
  });
}