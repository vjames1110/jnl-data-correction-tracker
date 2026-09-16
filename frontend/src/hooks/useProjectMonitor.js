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
      invalidateGirderJobs(queryClient, siteId);
      invalidateActionItems(queryClient, siteId);
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

export function useReviewActivity(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, payload }) =>
      projectMonitorService.reviewActivity(
        activityId,
        payload,
      ),
    onSuccess: () => {
      invalidateStructures(queryClient, siteId);
      invalidateBuildings(queryClient, siteId);
      invalidateGirderJobs(queryClient, siteId);
      invalidateActionItems(queryClient, siteId);
    },
  });
}

export function useReviewStructure(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ structureId, payload }) =>
      projectMonitorService.reviewStructure(
        structureId,
        payload,
      ),
    onSuccess: () =>
      invalidateStructures(queryClient, siteId),
  });
}

export function useReviewBuilding(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ buildingId, payload }) =>
      projectMonitorService.reviewBuilding(
        buildingId,
        payload,
      ),
    onSuccess: () =>
      invalidateBuildings(queryClient, siteId),
  });
}

export function useGirderJobs(siteId) {
  return useQuery({
    queryKey:
      queryKeys.projectMonitorGirderJobs({
        site: siteId,
      }),
    queryFn: () =>
      projectMonitorService.listGirderJobs({
        site: siteId,
      }),
    enabled: Boolean(siteId),
  });
}

function invalidateGirderJobs(
  queryClient,
  siteId,
) {
  queryClient.invalidateQueries({
    queryKey: [
      "project-monitor",
      "girder-jobs",
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

export function useCreateGirderJob(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      projectMonitorService.createGirderJob(
        siteId,
        payload,
      ),
    onSuccess: () =>
      invalidateGirderJobs(queryClient, siteId),
  });
}

export function useDeleteGirderJob(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId) =>
      projectMonitorService.deleteGirderJob(
        jobId,
      ),
    onSuccess: () =>
      invalidateGirderJobs(queryClient, siteId),
  });
}

export function useReviewGirderJob(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, payload }) =>
      projectMonitorService.reviewGirderJob(
        jobId,
        payload,
      ),
    onSuccess: () =>
      invalidateGirderJobs(queryClient, siteId),
  });
}

export function useUpdateGirderSpan(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spanId, payload }) =>
      projectMonitorService.updateGirderSpan(
        spanId,
        payload,
      ),
    onSuccess: () =>
      invalidateGirderJobs(queryClient, siteId),
  });
}

export function useRdsoSpanLibrary(
  includeInactive,
) {
  return useQuery({
    queryKey:
      queryKeys.projectMonitorRdsoSpanLibrary({
        all: includeInactive ? "1" : "",
      }),
    queryFn: () =>
      projectMonitorService.listRdsoSpanLibrary(
        includeInactive
          ? { all: "1" }
          : {},
      ),
  });
}

function invalidateRdsoSpanLibrary(
  queryClient,
) {
  queryClient.invalidateQueries({
    queryKey: [
      "project-monitor",
      "rdso-span-library",
    ],
  });
}

export function useCreateRdsoSpanLibraryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      projectMonitorService.createRdsoSpanLibraryEntry(
        payload,
      ),
    onSuccess: () =>
      invalidateRdsoSpanLibrary(queryClient),
  });
}

export function useUpdateRdsoSpanLibraryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entryId, payload }) =>
      projectMonitorService.updateRdsoSpanLibraryEntry(
        entryId,
        payload,
      ),
    onSuccess: () =>
      invalidateRdsoSpanLibrary(queryClient),
  });
}

export function useDeleteRdsoSpanLibraryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entryId) =>
      projectMonitorService.deleteRdsoSpanLibraryEntry(
        entryId,
      ),
    onSuccess: () =>
      invalidateRdsoSpanLibrary(queryClient),
  });
}

export function useCreateProjectExtension(
  siteId,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      projectMonitorService.createProjectExtension(
        siteId,
        payload,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey:
          queryKeys.projectMonitorOverview({
            site: siteId,
          }),
      }),
  });
}

export function useDeleteProjectExtension(
  siteId,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (extensionId) =>
      projectMonitorService.deleteProjectExtension(
        extensionId,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey:
          queryKeys.projectMonitorOverview({
            site: siteId,
          }),
      }),
  });
}

export function useActionItems(siteId) {
  return useQuery({
    queryKey:
      queryKeys.projectMonitorActionItems({
        site: siteId,
      }),
    queryFn: () =>
      projectMonitorService.listActionItems({
        site: siteId,
      }),
    enabled: Boolean(siteId),
  });
}

function invalidateActionItems(
  queryClient,
  siteId,
) {
  queryClient.invalidateQueries({
    queryKey: [
      "project-monitor",
      "action-items",
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

export function useCreateActionItem(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      projectMonitorService.createActionItem(
        siteId,
        payload,
      ),
    onSuccess: () =>
      invalidateActionItems(
        queryClient,
        siteId,
      ),
  });
}

export function useUpdateActionItem(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, payload }) =>
      projectMonitorService.updateActionItem(
        itemId,
        payload,
      ),
    onSuccess: () =>
      invalidateActionItems(
        queryClient,
        siteId,
      ),
  });
}

export function useDeleteActionItem(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId) =>
      projectMonitorService.deleteActionItem(
        itemId,
      ),
    onSuccess: () =>
      invalidateActionItems(
        queryClient,
        siteId,
      ),
  });
}

export function useLinearItems(siteId) {
  return useQuery({
    queryKey:
      queryKeys.projectMonitorLinearItems({
        site: siteId,
      }),
    queryFn: () =>
      projectMonitorService.listLinearItems({
        site: siteId,
      }),
    enabled: Boolean(siteId),
  });
}

function invalidateLinearItems(
  queryClient,
  siteId,
) {
  queryClient.invalidateQueries({
    queryKey: [
      "project-monitor",
      "linear-items",
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

export function useCreateLinearItem(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      projectMonitorService.createLinearItem(
        siteId,
        payload,
      ),
    onSuccess: () =>
      invalidateLinearItems(
        queryClient,
        siteId,
      ),
  });
}

export function useDeleteLinearItem(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId) =>
      projectMonitorService.deleteLinearItem(
        itemId,
      ),
    onSuccess: () =>
      invalidateLinearItems(
        queryClient,
        siteId,
      ),
  });
}

export function useCreateScopePatch(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      linearItemId,
      payload,
    }) =>
      projectMonitorService.createScopePatch(
        linearItemId,
        payload,
      ),
    onSuccess: () =>
      invalidateLinearItems(
        queryClient,
        siteId,
      ),
  });
}

export function useDeleteScopePatch(siteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patchId) =>
      projectMonitorService.deleteScopePatch(
        patchId,
      ),
    onSuccess: () =>
      invalidateLinearItems(
        queryClient,
        siteId,
      ),
  });
}

export function useCreateProgressEntry(
  siteId,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      linearItemId,
      payload,
    }) =>
      projectMonitorService.createProgressEntry(
        linearItemId,
        payload,
      ),
    onSuccess: () =>
      invalidateLinearItems(
        queryClient,
        siteId,
      ),
  });
}

export function useUpdateProgressEntry(
  siteId,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entryId, payload }) =>
      projectMonitorService.updateProgressEntry(
        entryId,
        payload,
      ),
    onSuccess: () =>
      invalidateLinearItems(
        queryClient,
        siteId,
      ),
  });
}

export function useDeleteProgressEntry(
  siteId,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entryId) =>
      projectMonitorService.deleteProgressEntry(
        entryId,
      ),
    onSuccess: () =>
      invalidateLinearItems(
        queryClient,
        siteId,
      ),
  });
}
