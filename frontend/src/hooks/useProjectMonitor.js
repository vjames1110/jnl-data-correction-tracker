import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { queryKeys } from "../constants/queryKeys";
import { projectMonitorService } from "../services/projectMonitorService";

export function useProjectOverview(siteId) {
  return useQuery({
    queryKey:
      queryKeys.projectMonitorOverview({
        site: siteId,
      }),
    queryFn: () =>
      projectMonitorService.getOverview({
        site: siteId,
      }),
    enabled: Boolean(siteId),
  });
}

export function useUpdateProjectSiteDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ siteId, payload }) =>
      projectMonitorService.updateProjectSiteDetails(
        siteId,
        payload,
      ),
    onSuccess: (_data, { siteId }) =>
      queryClient.invalidateQueries({
        queryKey:
          queryKeys.projectMonitorOverview({
            site: siteId,
          }),
      }),
  });
}

export function useStructures(
  siteId,
  structureType,
) {
  return useQuery({
    queryKey: queryKeys.projectMonitorStructures({
      site: siteId,
      structure_type: structureType || "",
    }),
    queryFn: () =>
      projectMonitorService.listStructures({
        site: siteId,
        ...(structureType
          ? { structure_type: structureType }
          : {}),
      }),
    enabled: Boolean(siteId),
  });
}

function invalidateStructures(
  queryClient,
  siteId,
) {
  queryClient.invalidateQueries({
    queryKey: [
      "project-monitor",
      "structures",
    ],
    predicate: (query) =>
      query.queryKey[2]?.site === siteId,
  });
  queryClient.invalidateQueries({
    queryKey:
      queryKeys.projectMonitorOverview({
        site: siteId,
      }),
  });
}

export function useCreateStructure(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      projectMonitorService.createStructure(
        siteId,
        payload,
      ),
    onSuccess: () =>
      invalidateStructures(queryClient, siteId),
  });
}

export function useDeleteStructure(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (structureId) =>
      projectMonitorService.deleteStructure(
        structureId,
      ),
    onSuccess: () =>
      invalidateStructures(queryClient, siteId),
  });
}

export function useUpdateActivity(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, payload }) =>
      projectMonitorService.updateActivity(
        activityId,
        payload,
      ),
    onSuccess: () => {
      invalidateStructures(queryClient, siteId);
      invalidateBuildings(queryClient, siteId);
    },
  });
}

export function useStructureTypes(
  includeInactive,
) {
  return useQuery({
    queryKey:
      queryKeys.projectMonitorStructureTypes({
        all: includeInactive ? "1" : "",
      }),
    queryFn: () =>
      projectMonitorService.listStructureTypes(
        includeInactive
          ? { all: "1" }
          : {},
      ),
  });
}

function invalidateStructureTypes(queryClient) {
  queryClient.invalidateQueries({
    queryKey: [
      "project-monitor",
      "structure-types",
    ],
  });
}

export function useCreateStructureType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      projectMonitorService.createStructureType(
        payload,
      ),
    onSuccess: () =>
      invalidateStructureTypes(queryClient),
  });
}

export function useUpdateStructureType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      structureTypeId,
      payload,
    }) =>
      projectMonitorService.updateStructureType(
        structureTypeId,
        payload,
      ),
    onSuccess: () =>
      invalidateStructureTypes(queryClient),
  });
}

export function useDeleteStructureType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (structureTypeId) =>
      projectMonitorService.deleteStructureType(
        structureTypeId,
      ),
    onSuccess: () =>
      invalidateStructureTypes(queryClient),
  });
}

export function useBuildings(siteId) {
  return useQuery({
    queryKey: queryKeys.projectMonitorBuildings({
      site: siteId,
    }),
    queryFn: () =>
      projectMonitorService.listBuildings({
        site: siteId,
      }),
    enabled: Boolean(siteId),
  });
}

function invalidateBuildings(
  queryClient,
  siteId,
) {
  queryClient.invalidateQueries({
    queryKey: [
      "project-monitor",
      "buildings",
    ],
    predicate: (query) =>
      query.queryKey[2]?.site === siteId,
  });
  queryClient.invalidateQueries({
    queryKey:
      queryKeys.projectMonitorOverview({
        site: siteId,
      }),
  });
}

export function useCreateBuilding(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      projectMonitorService.createBuilding(
        siteId,
        payload,
      ),
    onSuccess: () =>
      invalidateBuildings(queryClient, siteId),
  });
}

export function useDeleteBuilding(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (buildingId) =>
      projectMonitorService.deleteBuilding(
        buildingId,
      ),
    onSuccess: () =>
      invalidateBuildings(queryClient, siteId),
  });
}
