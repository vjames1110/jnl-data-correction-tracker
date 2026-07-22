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

export function useEmployeeDropdown() {
  return useQuery({
    queryKey: queryKeys.employeeDropdown,
    queryFn: employeeService.getDropdown,
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
