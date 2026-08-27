import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  queryKeys,
} from "../constants/queryKeys";
import { offlineReadCache } from "../services/offlineReadCache";
import { isNetworkError } from "../services/offlineSync";
import {
  reconciliationService,
} from "../services/reconciliationService";

function invalidateReconciliationQueries(
  queryClient,
) {
  queryClient.invalidateQueries({
    queryKey: ["reconciliation"],
  });
}

/**
 * Serve the Monthly Entry screen's cold-load reads (period, items,
 * entries, output entries) from a localStorage cache when the
 * network request fails offline - Phase 5's offline write path
 * already handles saves made after the page loaded; this covers
 * opening the page again with zero connectivity, as long as it was
 * opened online at least once before. The returned data is tagged
 * so the UI can tell the viewer it's looking at a saved snapshot.
 */
function withReadCache(cacheKey, fetcher) {
  return async () => {
    try {
      const data = await fetcher();
      offlineReadCache.set(cacheKey, data);
      return data;
    } catch (error) {
      if (isNetworkError(error)) {
        const cached =
          offlineReadCache.get(cacheKey);
        if (cached && cached.data) {
          if (
            typeof cached.data === "object"
          ) {
            cached.data.__offlineCachedAt =
              cached.cachedAt;
          }
          return cached.data;
        }
      }
      throw error;
    }
  };
}

export function useReconciliationItemCategories(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationItemCategories(
        params,
      ),
    queryFn: () =>
      reconciliationService.getItemCategories(
        params,
      ),
  });
}

export function useReconciliationItemCategoriesDropdown() {
  return useQuery({
    queryKey:
      queryKeys.reconciliationItemCategoriesDropdown,
    queryFn:
      reconciliationService.getItemCategoriesDropdown,
  });
}

export function useReconciliationItemCategoryExport(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationItemCategoryExport(
        params,
      ),
    queryFn: () =>
      reconciliationService.exportItemCategories(
        params,
      ),
    enabled: false,
  });
}

export function useCreateReconciliationItemCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.createItemCategory,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useUpdateReconciliationItemCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      reconciliationService.updateItemCategory(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useActivateReconciliationItemCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.activateItemCategory,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useDeactivateReconciliationItemCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.deactivateItemCategory,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useImportReconciliationMasters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ resource, rows }) =>
      reconciliationService.importMasters(
        resource,
        rows,
      ),
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useReconciliationItems(params) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationItems(params),
    queryFn: withReadCache(
      `items:${JSON.stringify(params ?? {})}`,
      () =>
        reconciliationService.getItems(params),
    ),
  });
}

export function useReconciliationItemsDropdown() {
  return useQuery({
    queryKey:
      queryKeys.reconciliationItemsDropdown,
    queryFn:
      reconciliationService.getItemsDropdown,
  });
}

export function useReconciliationItemExport(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationItemExport(
        params,
      ),
    queryFn: () =>
      reconciliationService.exportItems(params),
    enabled: false,
  });
}

export function useCreateReconciliationItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reconciliationService.createItem,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useUpdateReconciliationItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      reconciliationService.updateItem(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useActivateReconciliationItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.activateItem,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useDeactivateReconciliationItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.deactivateItem,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useReconciliationItemStandards(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationItemStandards(
        params,
      ),
    queryFn: () =>
      reconciliationService.getItemStandards(
        params,
      ),
  });
}

export function useReconciliationItemStandardExport(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationItemStandardExport(
        params,
      ),
    queryFn: () =>
      reconciliationService.exportItemStandards(
        params,
      ),
    enabled: false,
  });
}

export function useCreateReconciliationItemStandard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.createItemStandard,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useUpdateReconciliationItemStandard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      reconciliationService.updateItemStandard(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useActivateReconciliationItemStandard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.activateItemStandard,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useDeactivateReconciliationItemStandard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.deactivateItemStandard,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useReconciliationSiteItemConfigs(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationSiteItemConfigs(
        params,
      ),
    queryFn: () =>
      reconciliationService.getSiteItemConfigs(
        params,
      ),
  });
}

export function useReconciliationSiteItemConfigExport(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationSiteItemConfigExport(
        params,
      ),
    queryFn: () =>
      reconciliationService.exportSiteItemConfigs(
        params,
      ),
    enabled: false,
  });
}

export function useCreateReconciliationSiteItemConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.createSiteItemConfig,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useUpdateReconciliationSiteItemConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      reconciliationService.updateSiteItemConfig(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useActivateReconciliationSiteItemConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.activateSiteItemConfig,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useDeactivateReconciliationSiteItemConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.deactivateSiteItemConfig,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useReconciliationToleranceSettings() {
  return useQuery({
    queryKey:
      queryKeys.reconciliationToleranceSettings,
    queryFn:
      reconciliationService.getToleranceSettings,
  });
}

export function useUpdateReconciliationToleranceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.updateToleranceSettings,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useReconciliationCurrentPeriod(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationCurrentPeriod(
        params,
      ),
    queryFn: withReadCache(
      `period:${JSON.stringify(params ?? {})}`,
      () =>
        reconciliationService.getCurrentPeriod(
          params,
        ),
    ),
    enabled: Boolean(params),
  });
}

export function useSubmitReconciliationPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.submitPeriod,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useUpdateReconciliationPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      reconciliationService.updatePeriod(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useReconciliationPeriodFlags(
  id,
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationPeriodFlags(id),
    queryFn: () =>
      reconciliationService.getPeriodFlags(id),
    enabled: Boolean(id),
  });
}

export function useReconciliationEntries(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationEntries(params),
    queryFn: withReadCache(
      `entries:${params?.period}`,
      () =>
        reconciliationService.getEntries(
          params,
        ),
    ),
    enabled: Boolean(params?.period),
  });
}

export function useCreateReconciliationEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.createEntry,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useUpdateReconciliationEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      reconciliationService.updateEntry(
        id,
        payload,
      ),
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useReconciliationOutputEntries(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationOutputEntries(
        params,
      ),
    queryFn: withReadCache(
      `output-entries:${params?.period}`,
      () =>
        reconciliationService.getOutputEntries(
          params,
        ),
    ),
    enabled: Boolean(params?.period),
  });
}

export function useCreateReconciliationOutputEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.createOutputEntry,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useDeleteReconciliationOutputEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.deleteOutputEntry,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useReconciliationPendingApprovals(
  params,
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationPendingApprovals(
        params,
      ),
    queryFn: () =>
      reconciliationService.getPendingApprovals(
        params,
      ),
  });
}

export function useApproveReconciliationPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, comment }) =>
      reconciliationService.approvePeriod(
        id,
        comment,
      ),
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useRejectReconciliationPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, comment }) =>
      reconciliationService.rejectPeriod(
        id,
        comment,
      ),
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useReturnReconciliationPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, comment }) =>
      reconciliationService.returnPeriod(
        id,
        comment,
      ),
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useReopenReconciliationPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.reopenPeriod,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useReconciliationDashboard(
  params = {},
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationDashboard(params),
    queryFn: () =>
      reconciliationService.getDashboard(params),
  });
}

export function useReconciliationAttachments(
  periodId,
) {
  return useQuery({
    queryKey: [
      "reconciliation",
      "attachments",
      periodId,
    ],
    queryFn: () =>
      reconciliationService.getAttachments(
        periodId,
      ),
    enabled: Boolean(periodId),
  });
}

export function useCreateReconciliationAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.createAttachment,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useDeleteReconciliationAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      reconciliationService.deleteAttachment,
    onSuccess: () =>
      invalidateReconciliationQueries(
        queryClient,
      ),
  });
}

export function useReconciliationStatementPack(
  params = {},
) {
  return useQuery({
    queryKey:
      queryKeys.reconciliationStatementPack(
        params,
      ),
    queryFn: () =>
      reconciliationService.getStatementPack(
        params,
      ),
  });
}
