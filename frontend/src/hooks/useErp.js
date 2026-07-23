import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  queryKeys,
} from "../constants/queryKeys";
import { erpService } from "../services/erpService";

function invalidateErpQueries(queryClient) {
  queryClient.invalidateQueries({
    queryKey: ["erp"],
  });
}

export function useErpDashboard() {
  return useQuery({
    queryKey: queryKeys.erpDashboard,
    queryFn: erpService.getDashboard,
    refetchInterval: 60_000,
  });
}

export function useErpModulesDropdown() {
  return useQuery({
    queryKey: queryKeys.erpModulesDropdown,
    queryFn: erpService.getModulesDropdown,
  });
}

export function useErpModules(params) {
  return useQuery({
    queryKey: queryKeys.erpModules(params),
    queryFn: () => erpService.getModules(params),
  });
}

export function useErpModuleExport(params) {
  return useQuery({
    queryKey: queryKeys.erpModuleExport(params),
    queryFn: () =>
      erpService.exportModules(params),
    enabled: false,
  });
}

export function useCreateErpModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.createModule,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useUpdateErpModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      erpService.updateModule(id, payload),
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useActivateErpModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.activateModule,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useDeactivateErpModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.deactivateModule,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useErpVoucherTypes(params) {
  return useQuery({
    queryKey: queryKeys.erpVoucherTypes(params),
    queryFn: () =>
      erpService.getVoucherTypes(params),
  });
}

export function useErpVoucherTypesDropdown() {
  return useQuery({
    queryKey: queryKeys.erpVoucherTypesDropdown,
    queryFn: erpService.getVoucherTypesDropdown,
  });
}

export function useErpVoucherTypeExport(params) {
  return useQuery({
    queryKey:
      queryKeys.erpVoucherTypeExport(params),
    queryFn: () =>
      erpService.exportVoucherTypes(params),
    enabled: false,
  });
}

export function useCreateErpVoucherType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.createVoucherType,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useUpdateErpVoucherType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      erpService.updateVoucherType(id, payload),
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useActivateErpVoucherType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.activateVoucherType,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useDeactivateErpVoucherType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.deactivateVoucherType,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useErpWorkTypes(params) {
  return useQuery({
    queryKey: queryKeys.erpWorkTypes(params),
    queryFn: () =>
      erpService.getWorkTypes(params),
  });
}

export function useErpWorkTypesDropdown() {
  return useQuery({
    queryKey: queryKeys.erpWorkTypesDropdown,
    queryFn: erpService.getWorkTypesDropdown,
  });
}

export function useErpWorkTypeExport(params) {
  return useQuery({
    queryKey: queryKeys.erpWorkTypeExport(params),
    queryFn: () =>
      erpService.exportWorkTypes(params),
    enabled: false,
  });
}

export function useCreateErpWorkType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.createWorkType,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useUpdateErpWorkType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      erpService.updateWorkType(id, payload),
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useActivateErpWorkType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.activateWorkType,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useDeactivateErpWorkType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.deactivateWorkType,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useErpReasonCategories(params) {
  return useQuery({
    queryKey: queryKeys.erpReasonCategories(params),
    queryFn: () =>
      erpService.getReasonCategories(params),
  });
}

export function useErpReasonCategoriesDropdown() {
  return useQuery({
    queryKey:
      queryKeys.erpReasonCategoriesDropdown,
    queryFn:
      erpService.getReasonCategoriesDropdown,
  });
}

export function useErpReasonCategoryExport(params) {
  return useQuery({
    queryKey:
      queryKeys.erpReasonCategoryExport(params),
    queryFn: () =>
      erpService.exportReasonCategories(params),
    enabled: false,
  });
}

export function useCreateErpReasonCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.createReasonCategory,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useUpdateErpReasonCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      erpService.updateReasonCategory(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useActivateErpReasonCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.activateReasonCategory,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useDeactivateErpReasonCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.deactivateReasonCategory,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useErpPriorities(params) {
  return useQuery({
    queryKey: queryKeys.erpPriorities(params),
    queryFn: () =>
      erpService.getPriorities(params),
  });
}

export function useErpPrioritiesDropdown() {
  return useQuery({
    queryKey: queryKeys.erpPrioritiesDropdown,
    queryFn: erpService.getPrioritiesDropdown,
  });
}

export function useErpPriorityExport(params) {
  return useQuery({
    queryKey: queryKeys.erpPriorityExport(params),
    queryFn: () =>
      erpService.exportPriorities(params),
    enabled: false,
  });
}

export function useCreateErpPriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.createPriority,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useUpdateErpPriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      erpService.updatePriority(id, payload),
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useActivateErpPriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.activatePriority,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useDeactivateErpPriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: erpService.deactivatePriority,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useErpResponsiblePersonMappings(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.erpResponsiblePersonMappings(
        params,
      ),
    queryFn: () =>
      erpService.getResponsiblePersonMappings(
        params,
      ),
  });
}

export function useErpResponsiblePersonMappingExport(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.erpResponsiblePersonMappingExport(
        params,
      ),
    queryFn: () =>
      erpService.exportResponsiblePersonMappings(
        params,
      ),
    enabled: false,
  });
}

export function useCreateErpResponsiblePersonMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      erpService.createResponsiblePersonMapping,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useUpdateErpResponsiblePersonMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      erpService.updateResponsiblePersonMapping(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useActivateErpResponsiblePersonMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      erpService.activateResponsiblePersonMapping,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useDeactivateErpResponsiblePersonMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      erpService.deactivateResponsiblePersonMapping,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useErpRequestFieldConfigurations(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.erpRequestFieldConfigurations(
        params,
      ),
    queryFn: () =>
      erpService.getRequestFieldConfigurations(
        params,
      ),
  });
}

export function useErpRequestFieldConfigurationExport(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.erpRequestFieldConfigurationExport(
        params,
      ),
    queryFn: () =>
      erpService.exportRequestFieldConfigurations(
        params,
      ),
    enabled: false,
  });
}

export function useCreateErpRequestFieldConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      erpService.createRequestFieldConfiguration,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useUpdateErpRequestFieldConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      erpService.updateRequestFieldConfiguration(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useActivateErpRequestFieldConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      erpService.activateRequestFieldConfiguration,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useDeactivateErpRequestFieldConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      erpService.deactivateRequestFieldConfiguration,
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}

export function useImportErpMasters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ resource, rows }) =>
      erpService.importMasters(resource, rows),
    onSuccess: () =>
      invalidateErpQueries(queryClient),
  });
}
