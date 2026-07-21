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

export function useHodMappings() {
  return useQuery({
    queryKey: queryKeys.organizationHodMappings,
    queryFn:
      organizationService.getHodMappings,
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

export function useSitesDropdown() {
  return useQuery({
    queryKey:
      queryKeys.organizationSitesDropdown,
    queryFn:
      organizationService.getSitesDropdown,
  });
}

export function useDepartmentsDropdown() {
  return useQuery({
    queryKey:
      queryKeys.organizationDepartmentsDropdown,
    queryFn:
      organizationService.getDepartmentsDropdown,
  });
}

export function useUsersDropdown() {
  return useQuery({
    queryKey:
      queryKeys.organizationUsersDropdown,
    queryFn:
      organizationService.getUsersDropdown,
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

export function useUpdateSiteHod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, siteHod }) =>
      organizationService.updateSiteHod(
        id,
        siteHod,
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

export function useDepartments(params) {
  return useQuery({
    queryKey:
      queryKeys.organizationDepartments(params),
    queryFn: () =>
      organizationService.getDepartments(params),
  });
}

export function useDepartmentExport(params) {
  return useQuery({
    queryKey:
      queryKeys.organizationDepartmentExport(params),
    queryFn: () =>
      organizationService.exportDepartments(params),
    enabled: false,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      organizationService.createDepartment,
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      organizationService.updateDepartment(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useUpdateDepartmentHod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, departmentHod }) =>
      organizationService.updateDepartmentHod(
        id,
        departmentHod,
      ),
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useActivateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      organizationService.activateDepartment,
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useDeactivateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      organizationService.deactivateDepartment,
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useDesignations(params) {
  return useQuery({
    queryKey:
      queryKeys.organizationDesignations(params),
    queryFn: () =>
      organizationService.getDesignations(params),
  });
}

export function useDesignationExport(params) {
  return useQuery({
    queryKey:
      queryKeys.organizationDesignationExport(params),
    queryFn: () =>
      organizationService.exportDesignations(
        params,
      ),
    enabled: false,
  });
}

export function useCreateDesignation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      organizationService.createDesignation,
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useUpdateDesignation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      organizationService.updateDesignation(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useActivateDesignation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      organizationService.activateDesignation,
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useDeactivateDesignation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      organizationService.deactivateDesignation,
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useDirectorMappings(params) {
  return useQuery({
    queryKey:
      queryKeys.organizationDirectorMappings(
        params,
      ),
    queryFn: () =>
      organizationService.getDirectorMappings(
        params,
      ),
  });
}

export function useDirectorMappingExport(params) {
  return useQuery({
    queryKey:
      queryKeys.organizationDirectorMappingExport(
        params,
      ),
    queryFn: () =>
      organizationService.exportDirectorMappings(
        params,
      ),
    enabled: false,
  });
}

export function useCreateDirectorMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      organizationService.createDirectorMapping,
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useUpdateDirectorMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      organizationService.updateDirectorMapping(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useActivateDirectorMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      organizationService.activateDirectorMapping,
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}

export function useDeactivateDirectorMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      organizationService.deactivateDirectorMapping,
    onSuccess: () =>
      invalidateOrganizationQueries(
        queryClient,
      ),
  });
}
