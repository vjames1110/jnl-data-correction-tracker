import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  queryKeys,
} from "../constants/queryKeys";
import {
  employeeService,
} from "../services/employeeService";

function invalidateEmployeeQueries(queryClient) {
  queryClient.invalidateQueries({
    queryKey: ["employees"],
  });
}

export function useEmployeeDashboard() {
  return useQuery({
    queryKey: queryKeys.employeeDashboard,
    queryFn: employeeService.getDashboard,
  });
}

export function useEmployeeProfiles(params) {
  return useQuery({
    queryKey:
      queryKeys.employeeProfiles(params),
    queryFn: () =>
      employeeService.getProfiles(params),
  });
}

export function useEmployeeProfileExport(params) {
  return useQuery({
    queryKey:
      queryKeys.employeeProfileExport(params),
    queryFn: () =>
      employeeService.exportProfiles(params),
    enabled: false,
  });
}

export function useEmployeeFilterOptions() {
  return useQuery({
    queryKey: queryKeys.employeeFilterOptions,
    queryFn:
      employeeService.getFilterOptions,
  });
}

export function useEmployeeDropdown(
  params = {},
) {
  return useQuery({
    queryKey:
      queryKeys.employeeDropdown(params),
    queryFn: () =>
      employeeService.getDropdown(params),
  });
}

export function useCreateEmployeeProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      employeeService.createProfile,
    onSuccess: () =>
      invalidateEmployeeQueries(queryClient),
  });
}

export function useUpdateEmployeeProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, payload }) =>
      employeeService.updateProfile(
        profileId,
        payload,
      ),
    onSuccess: () =>
      invalidateEmployeeQueries(queryClient),
  });
}

export function useActivateEmployeeProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      employeeService.activateProfile,
    onSuccess: () =>
      invalidateEmployeeQueries(queryClient),
  });
}

export function useDeactivateEmployeeProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      employeeService.deactivateProfile,
    onSuccess: () =>
      invalidateEmployeeQueries(queryClient),
  });
}

export function useCreateEmployeeAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, payload }) =>
      employeeService.createAccount(
        profileId,
        payload,
      ),
    onSuccess: () =>
      invalidateEmployeeQueries(queryClient),
  });
}

export function useResetEmployeeTemporaryPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      employeeService.resetTemporaryPassword,
    onSuccess: () =>
      invalidateEmployeeQueries(queryClient),
  });
}

export function useUnlockEmployeeAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      employeeService.unlockAccount,
    onSuccess: () =>
      invalidateEmployeeQueries(queryClient),
  });
}

export function useSuspendEmployeeAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      employeeService.suspendAccount,
    onSuccess: () =>
      invalidateEmployeeQueries(queryClient),
  });
}

export function useReactivateEmployeeAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      employeeService.reactivateAccount,
    onSuccess: () =>
      invalidateEmployeeQueries(queryClient),
  });
}

export function useChangeEmployeeRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, role }) =>
      employeeService.changeRole(profileId, {
        role,
      }),
    onSuccess: () =>
      invalidateEmployeeQueries(queryClient),
  });
}

export function useRevokeEmployeeSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      employeeService.revokeSessions,
    onSuccess: () =>
      invalidateEmployeeQueries(queryClient),
  });
}

export function useEmployeeLoginHistory(
  profileId,
  enabled,
) {
  return useQuery({
    queryKey:
      queryKeys.employeeLoginHistory(profileId),
    queryFn: () =>
      employeeService.getLoginHistory(profileId),
    enabled: Boolean(profileId) && enabled,
  });
}

export function useDownloadEmployeeTemplate() {
  return useMutation({
    mutationFn:
      employeeService.downloadTemplate,
  });
}

export function useEmployeeImportColumns() {
  return useQuery({
    queryKey: queryKeys.employeeImportColumns,
    queryFn:
      employeeService.getImportColumns,
  });
}

export function usePreviewEmployeeImport() {
  return useMutation({
    mutationFn: employeeService.previewImport,
  });
}

export function useImportEmployees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: employeeService.importFile,
    onSuccess: () =>
      invalidateEmployeeQueries(queryClient),
  });
}

export function useExportEmployeeFailedRows() {
  return useMutation({
    mutationFn:
      employeeService.exportFailedRows,
  });
}
