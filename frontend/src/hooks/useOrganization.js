import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  queryKeys,
} from "../constants/queryKeys";
import {
  organizationService,
} from "../services/organizationService";

export function useOrganizationDashboard() {
  return useQuery({
    queryKey: queryKeys.organizationDashboard,
    queryFn:
      organizationService.getDashboard,
    refetchInterval: 60_000,
  });
}

export function useCompaniesDropdown() {
  return useQuery({
    queryKey:
      queryKeys.organizationCompaniesDropdown,
    queryFn:
      organizationService.getCompaniesDropdown,
  });
}

export function useSites(params) {
  return useQuery({
    queryKey:
      queryKeys.organizationSites(params),
    queryFn: () =>
      organizationService.getSites(params),
  });
}

export function useSiteExport(params) {
  return useQuery({
    queryKey:
      queryKeys.organizationSiteExport(params),
    queryFn: () =>
      organizationService.exportSites(params),
    enabled: false,
  });
}

function invalidateOrganizationQueries(
  queryClient,
) {
  queryClient.invalidateQueries({
    queryKey: ["organization"],
  });
}

export function useCreateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      organizationService.createSite,
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useUpdateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      organizationService.updateSite(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useActivateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      organizationService.activateSite,
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useDeactivateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      organizationService.deactivateSite,
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}
