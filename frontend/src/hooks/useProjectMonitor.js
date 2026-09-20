import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { queryKeys } from "../constants/queryKeys";
import { projectMonitorService } from "../services/projectMonitorService";

export function useProjectDashboard(includeEmpty) {
  return useQuery({
    queryKey: queryKeys.projectMonitorDashboard({
      include_empty: includeEmpty ? "1" : "",
    }),
    queryFn: () =>
      projectMonitorService.getDashboard(
        includeEmpty ? { include_empty: "1" } : {},
      ),
  });
}

export function useDueTracker({
  mode,
  date,
  site,
}) {
  const params = {
    mode,
    ...(date ? { date } : {}),
    ...(site ? { site } : {}),
  };

  return useQuery({
    queryKey:
      queryKeys.projectMonitorDueTracker(params),
    queryFn: () =>
      projectMonitorService.getDueTracker(params),
  });
}

export function useOverdueCounts(siteId) {
  return useQuery({
    queryKey: queryKeys.projectMonitorOverdueCounts(
      { site: siteId },
    ),
    queryFn: () =>
      projectMonitorService.getOverdueCounts({
        site: siteId,
      }),
    enabled: Boolean(siteId),
  });
}

function invalidateRollups(queryClient) {
  ["dashboard", "due-tracker", "overdue-counts"].forEach(
    (segment) =>
      queryClient.invalidateQueries({
        queryKey: ["project-monitor", segment],
      }),
  );
}

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
  invalidateRollups(queryClient);
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
  invalidateRollups(queryClient);
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
  invalidateRollups(queryClient);
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
  invalidateRollups(queryClient);
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
  invalidateRollups(queryClient);
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


// ---------------------------------------------------------------
// Finance tier: DPR, RA bills, financial summary, site access
// ---------------------------------------------------------------

function useFinanceQuery(name, params, queryFn, enabled) {
  return useQuery({
    queryKey: queryKeys.projectMonitorFinance(
      name,
      params,
    ),
    queryFn,
    enabled,
  });
}

function invalidateFinance(queryClient) {
  queryClient.invalidateQueries({
    queryKey: ["project-monitor", "finance"],
  });
  invalidateRollups(queryClient);
  queryClient.invalidateQueries({
    queryKey: ["project-monitor", "overview"],
  });
}

function useFinanceMutation(mutationFn) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useDprAccess(siteId) {
  return useFinanceQuery(
    "access",
    { site: siteId },
    () =>
      projectMonitorService.getDprAccess({
        site: siteId,
      }),
    Boolean(siteId),
  );
}

export function useDprContract(siteId, enabled) {
  return useFinanceQuery(
    "contract",
    { site: siteId },
    () =>
      projectMonitorService.getDprContract({
        site: siteId,
      }),
    Boolean(siteId) && enabled,
  );
}

export function useUpdateDprContract(siteId) {
  return useFinanceMutation((payload) =>
    projectMonitorService.updateDprContract(
      siteId,
      payload,
    ),
  );
}

export function useDprItems(siteId, enabled) {
  return useFinanceQuery(
    "items",
    { site: siteId },
    () =>
      projectMonitorService.listDprItems({
        site: siteId,
      }),
    Boolean(siteId) && enabled,
  );
}

export function useCreateDprItem() {
  return useFinanceMutation(
    projectMonitorService.createDprItem,
  );
}

export function useUpdateDprItem() {
  return useFinanceMutation(
    ({ itemId, payload }) =>
      projectMonitorService.updateDprItem(
        itemId,
        payload,
      ),
  );
}

export function useDeleteDprItem() {
  return useFinanceMutation(
    projectMonitorService.deleteDprItem,
  );
}

export function useImportDprItems(siteId) {
  return useFinanceMutation((file) =>
    projectMonitorService.importDprItems(siteId, file),
  );
}

export function useUploadDpr(siteId) {
  return useFinanceMutation((file) =>
    projectMonitorService.uploadDpr(siteId, file),
  );
}

export function useDprGrid(siteId, enabled) {
  return useFinanceQuery(
    "grid",
    { site: siteId },
    () =>
      projectMonitorService.getDprGrid({
        site: siteId,
      }),
    Boolean(siteId) && enabled,
  );
}

export function useSaveDprGrid() {
  return useFinanceMutation(
    projectMonitorService.saveDprGrid,
  );
}

export function useDprEntries(params, enabled) {
  return useFinanceQuery(
    "entries",
    params,
    () => projectMonitorService.listDprEntries(params),
    Boolean(params.site) && enabled,
  );
}

export function useCreateDprEntry() {
  return useFinanceMutation(
    projectMonitorService.createDprEntry,
  );
}

export function useDeleteDprEntry() {
  return useFinanceMutation(
    projectMonitorService.deleteDprEntry,
  );
}

export function useDprUnlocks(siteId, enabled) {
  return useFinanceQuery(
    "unlocks",
    { site: siteId },
    () =>
      projectMonitorService.listDprUnlocks({
        site: siteId,
      }),
    Boolean(siteId) && enabled,
  );
}

export function useUnlockDprDay() {
  return useFinanceMutation(
    projectMonitorService.unlockDprDay,
  );
}

export function useRaBills(siteId, enabled) {
  return useFinanceQuery(
    "ra-bills",
    { site: siteId },
    () =>
      projectMonitorService.listRaBills({
        site: siteId,
      }),
    Boolean(siteId) && enabled,
  );
}

export function useCreateRaBill() {
  return useFinanceMutation(
    projectMonitorService.createRaBill,
  );
}

export function useUpdateRaBill() {
  return useFinanceMutation(({ billId, payload }) =>
    projectMonitorService.updateRaBill(billId, payload),
  );
}

export function useDeleteRaBill() {
  return useFinanceMutation(
    projectMonitorService.deleteRaBill,
  );
}

export function useFinancialSummary(siteId, enabled) {
  return useFinanceQuery(
    "summary",
    { site: siteId },
    () =>
      projectMonitorService.getFinancialSummary({
        site: siteId,
      }),
    Boolean(siteId) && enabled,
  );
}

export function useFinancialReport(
  siteId,
  asOn,
  enabled,
) {
  const params = {
    site: siteId,
    ...(asOn ? { as_on: asOn } : {}),
  };

  return useFinanceQuery(
    "report",
    params,
    () =>
      projectMonitorService.getFinancialReport(params),
    Boolean(siteId) && enabled,
  );
}

export function useSiteAccess(siteId) {
  return useFinanceQuery(
    "site-access",
    { site: siteId },
    () =>
      projectMonitorService.listSiteAccess(
        siteId ? { site: siteId } : {},
      ),
    true,
  );
}

export function useGrantSiteAccess() {
  return useFinanceMutation(
    projectMonitorService.grantSiteAccess,
  );
}

export function useRevokeSiteAccess() {
  return useFinanceMutation(
    projectMonitorService.revokeSiteAccess,
  );
}

// ---------------------------------------------------------------
// HR: labour, staff and their day-wise cost (per-site HR role)
// ---------------------------------------------------------------

export function useHrAccess(siteId) {
  return useFinanceQuery(
    "hr-access",
    { site: siteId },
    () =>
      projectMonitorService.getHrAccess({ site: siteId }),
    Boolean(siteId),
  );
}

export function useHrSummary(siteId, month, enabled) {
  return useFinanceQuery(
    "hr-summary",
    { site: siteId, month },
    () =>
      projectMonitorService.getHrSummary({
        site: siteId,
        month,
      }),
    Boolean(siteId) && enabled,
  );
}

export function useLabourEntries(siteId, month, enabled) {
  return useFinanceQuery(
    "hr-labour",
    { site: siteId, month },
    () =>
      projectMonitorService.listLabour({
        site: siteId,
        month,
      }),
    Boolean(siteId) && enabled,
  );
}

export function useCreateLabour() {
  return useFinanceMutation(
    projectMonitorService.createLabour,
  );
}

export function useDeleteLabour() {
  return useFinanceMutation(
    projectMonitorService.deleteLabour,
  );
}

export function useStaffMembers(siteId, enabled) {
  return useFinanceQuery(
    "hr-staff",
    { site: siteId },
    () =>
      projectMonitorService.listStaff({ site: siteId }),
    Boolean(siteId) && enabled,
  );
}

export function useCreateStaff() {
  return useFinanceMutation(
    projectMonitorService.createStaff,
  );
}

export function useUpdateStaff() {
  return useFinanceMutation(({ staffId, payload }) =>
    projectMonitorService.updateStaff(staffId, payload),
  );
}

export function useDeleteStaff() {
  return useFinanceMutation(
    projectMonitorService.deleteStaff,
  );
}

export function useStaffOverrides(siteId, month, enabled) {
  return useFinanceQuery(
    "hr-overrides",
    { site: siteId, month },
    () =>
      projectMonitorService.listStaffOverrides({
        site: siteId,
        month,
      }),
    Boolean(siteId) && enabled,
  );
}

export function useSaveStaffOverride() {
  return useFinanceMutation(
    projectMonitorService.saveStaffOverride,
  );
}

export function useDeleteStaffOverride() {
  return useFinanceMutation(
    projectMonitorService.deleteStaffOverride,
  );
}

export function useUploadHr(siteId) {
  return useFinanceMutation((file) =>
    projectMonitorService.uploadHr(siteId, file),
  );
}

// ---------------------------------------------------------------
// Machinery: machines, daily usage and fuel (per-site Machinery role)
// ---------------------------------------------------------------

export function useMachineryAccess(siteId) {
  return useFinanceQuery(
    "machinery-access",
    { site: siteId },
    () =>
      projectMonitorService.getMachineryAccess({
        site: siteId,
      }),
    Boolean(siteId),
  );
}

export function useMachinerySummary(siteId, month, enabled) {
  return useFinanceQuery(
    "machinery-summary",
    { site: siteId, month },
    () =>
      projectMonitorService.getMachinerySummary({
        site: siteId,
        month,
      }),
    Boolean(siteId) && enabled,
  );
}

export function useMachines(siteId, enabled) {
  return useFinanceQuery(
    "machinery-machines",
    { site: siteId },
    () =>
      projectMonitorService.listMachines({ site: siteId }),
    Boolean(siteId) && enabled,
  );
}

export function useCreateMachine() {
  return useFinanceMutation(
    projectMonitorService.createMachine,
  );
}

export function useUpdateMachine() {
  return useFinanceMutation(({ machineId, payload }) =>
    projectMonitorService.updateMachine(machineId, payload),
  );
}

export function useDeleteMachine() {
  return useFinanceMutation(
    projectMonitorService.deleteMachine,
  );
}

export function useMachineUsage(siteId, month, enabled) {
  return useFinanceQuery(
    "machinery-usage",
    { site: siteId, month },
    () =>
      projectMonitorService.listMachineUsage({
        site: siteId,
        month,
      }),
    Boolean(siteId) && enabled,
  );
}

export function useSaveMachineUsage() {
  return useFinanceMutation(
    projectMonitorService.saveMachineUsage,
  );
}

export function useDeleteMachineUsage() {
  return useFinanceMutation(
    projectMonitorService.deleteMachineUsage,
  );
}

export function useFuelEntries(siteId, month, enabled) {
  return useFinanceQuery(
    "machinery-fuel",
    { site: siteId, month },
    () =>
      projectMonitorService.listFuel({
        site: siteId,
        month,
      }),
    Boolean(siteId) && enabled,
  );
}

export function useCreateFuel() {
  return useFinanceMutation(
    projectMonitorService.createFuel,
  );
}

export function useDeleteFuel() {
  return useFinanceMutation(
    projectMonitorService.deleteFuel,
  );
}

export function useUploadMachinery(siteId) {
  return useFinanceMutation((file) =>
    projectMonitorService.uploadMachinery(siteId, file),
  );
}
