import { apiClient } from "./apiClient";

function resolveItems(response) {
  return response.data?.data ?? [];
}

function resolveMeta(response) {
  return response.data?.meta ?? {};
}

async function getMasterList(path, params = {}) {
  const response = await apiClient.get(path, {
    params,
  });

  return {
    items: resolveItems(response),
    meta: resolveMeta(response),
  };
}

async function exportMaster(path, params = {}) {
  const response = await apiClient.get(path, {
    params,
  });

  return resolveItems(response);
}

export const reconciliationService = {
  getItemCategories(params = {}) {
    return getMasterList(
      "/reconciliation/item-categories/",
      params,
    );
  },

  async getItemCategoriesDropdown() {
    const response = await apiClient.get(
      "/reconciliation/item-categories/dropdown/",
    );

    return resolveItems(response);
  },

  exportItemCategories(params = {}) {
    return exportMaster(
      "/reconciliation/item-categories/export/",
      params,
    );
  },

  async createItemCategory(payload) {
    const response = await apiClient.post(
      "/reconciliation/item-categories/",
      payload,
    );

    return response.data.data;
  },

  async updateItemCategory(id, payload) {
    const response = await apiClient.patch(
      `/reconciliation/item-categories/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activateItemCategory(id) {
    const response = await apiClient.post(
      `/reconciliation/item-categories/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateItemCategory(id) {
    const response = await apiClient.post(
      `/reconciliation/item-categories/${id}/deactivate/`,
    );

    return response.data.data;
  },

  getItems(params = {}) {
    return getMasterList(
      "/reconciliation/items/",
      params,
    );
  },

  async getItemsDropdown() {
    const response = await apiClient.get(
      "/reconciliation/items/dropdown/",
    );

    return resolveItems(response);
  },

  exportItems(params = {}) {
    return exportMaster(
      "/reconciliation/items/export/",
      params,
    );
  },

  async createItem(payload) {
    const response = await apiClient.post(
      "/reconciliation/items/",
      payload,
    );

    return response.data.data;
  },

  async updateItem(id, payload) {
    const response = await apiClient.patch(
      `/reconciliation/items/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activateItem(id) {
    const response = await apiClient.post(
      `/reconciliation/items/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateItem(id) {
    const response = await apiClient.post(
      `/reconciliation/items/${id}/deactivate/`,
    );

    return response.data.data;
  },

  getItemStandards(params = {}) {
    return getMasterList(
      "/reconciliation/item-standards/",
      params,
    );
  },

  exportItemStandards(params = {}) {
    return exportMaster(
      "/reconciliation/item-standards/export/",
      params,
    );
  },

  async createItemStandard(payload) {
    const response = await apiClient.post(
      "/reconciliation/item-standards/",
      payload,
    );

    return response.data.data;
  },

  async updateItemStandard(id, payload) {
    const response = await apiClient.patch(
      `/reconciliation/item-standards/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activateItemStandard(id) {
    const response = await apiClient.post(
      `/reconciliation/item-standards/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateItemStandard(id) {
    const response = await apiClient.post(
      `/reconciliation/item-standards/${id}/deactivate/`,
    );

    return response.data.data;
  },

  getSiteItemConfigs(params = {}) {
    return getMasterList(
      "/reconciliation/site-item-configs/",
      params,
    );
  },

  exportSiteItemConfigs(params = {}) {
    return exportMaster(
      "/reconciliation/site-item-configs/export/",
      params,
    );
  },

  async createSiteItemConfig(payload) {
    const response = await apiClient.post(
      "/reconciliation/site-item-configs/",
      payload,
    );

    return response.data.data;
  },

  async updateSiteItemConfig(id, payload) {
    const response = await apiClient.patch(
      `/reconciliation/site-item-configs/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activateSiteItemConfig(id) {
    const response = await apiClient.post(
      `/reconciliation/site-item-configs/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateSiteItemConfig(id) {
    const response = await apiClient.post(
      `/reconciliation/site-item-configs/${id}/deactivate/`,
    );

    return response.data.data;
  },

  async getToleranceSettings() {
    const response = await apiClient.get(
      "/reconciliation/tolerance-settings/",
    );

    return response.data.data;
  },

  async updateToleranceSettings(payload) {
    const response = await apiClient.patch(
      "/reconciliation/tolerance-settings/",
      payload,
    );

    return response.data.data;
  },

  async getCurrentPeriod(params = {}) {
    const response = await apiClient.get(
      "/reconciliation/periods/current/",
      { params },
    );

    return response.data.data;
  },

  async submitPeriod(id) {
    const response = await apiClient.post(
      `/reconciliation/periods/${id}/submit/`,
    );

    return response.data.data;
  },

  async updatePeriod(id, payload) {
    const response = await apiClient.patch(
      `/reconciliation/periods/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async getPeriodFlags(id) {
    const response = await apiClient.get(
      `/reconciliation/periods/${id}/flags/`,
    );

    return response.data.data;
  },

  async getEntries(params = {}) {
    const response = await apiClient.get(
      "/reconciliation/entries/",
      { params },
    );

    return response.data.data;
  },

  async createEntry(payload) {
    const response = await apiClient.post(
      "/reconciliation/entries/",
      payload,
    );

    return response.data.data;
  },

  async updateEntry(id, payload) {
    const response = await apiClient.patch(
      `/reconciliation/entries/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async getOutputEntries(params = {}) {
    const response = await apiClient.get(
      "/reconciliation/output-entries/",
      { params },
    );

    return response.data.data;
  },

  async createOutputEntry(payload) {
    const response = await apiClient.post(
      "/reconciliation/output-entries/",
      payload,
    );

    return response.data.data;
  },

  async deleteOutputEntry(id) {
    await apiClient.delete(
      `/reconciliation/output-entries/${id}/`,
    );
  },

  async getPendingApprovals(params = {}) {
    const response = await apiClient.get(
      "/reconciliation/periods/pending_approvals/",
      { params },
    );

    return response.data.data;
  },

  async approvePeriod(id, comment = "") {
    const response = await apiClient.post(
      `/reconciliation/periods/${id}/approve/`,
      { comment },
    );

    return response.data.data;
  },

  async rejectPeriod(id, comment) {
    const response = await apiClient.post(
      `/reconciliation/periods/${id}/reject/`,
      { comment },
    );

    return response.data.data;
  },

  async returnPeriod(id, comment) {
    const response = await apiClient.post(
      `/reconciliation/periods/${id}/return/`,
      { comment },
    );

    return response.data.data;
  },

  async reopenPeriod(id) {
    const response = await apiClient.post(
      `/reconciliation/periods/${id}/reopen/`,
    );

    return response.data.data;
  },

  async getDashboard(params = {}) {
    const response = await apiClient.get(
      "/reconciliation/dashboard/",
      { params },
    );

    return response.data.data;
  },

  async getStatementPack(params = {}) {
    const response = await apiClient.get(
      "/reconciliation/statement-pack/",
      { params },
    );

    return response.data.data;
  },
};
