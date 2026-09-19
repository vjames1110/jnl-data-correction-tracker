import { useQuery } from "@tanstack/react-query";

import {
  queryKeys,
} from "../constants/queryKeys";
import {
  adminService,
} from "../services/adminService";

export function useAdminCapabilities({
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: queryKeys.adminCapabilities,
    queryFn: adminService.getCapabilities,
    staleTime: 5 * 60_000,
    enabled,
  });
}
