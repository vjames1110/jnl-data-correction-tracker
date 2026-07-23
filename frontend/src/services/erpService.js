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

export const erpService = {
  async getDashboard() {
    const [
      modulesResponse,
      voucherTypesResponse,
      workTypesResponse,
      reasonCategoriesResponse,
      prioritiesResponse,
      mappingsResponse,
    ] = await Promise.all([
      apiClient.get("/erp/modules/export/"),
      apiClient.get("/erp/voucher-types/export/"),
      apiClient.get("/erp/work-types/export/"),
      apiClient.get("/erp/reason-categories/export/"),
      apiClient.get("/erp/priorities/export/"),
      apiClient.get(
        "/erp/responsible-person-mappings/export/",
      ),
    ]);

    const modules = resolveItems(modulesResponse);
    const voucherTypes = resolveItems(
      voucherTypesResponse,
    );
    const workTypes = resolveItems(workTypesResponse);
    const reasonCategories = resolveItems(
      reasonCategoriesResponse,
    );
    const priorities = resolveItems(
      prioritiesResponse,
    );
    const responsibleMappings = resolveItems(
      mappingsResponse,
    );
    const activeMappings = responsibleMappings.filter(
      (mapping) => mapping.is_active,
    );
    const mappedModuleIds = new Set(
      activeMappings.map(
        (mapping) => mapping.erp_module,
      ),
    );
    const missingMappings = modules.filter(
      (module) =>
        module.is_active &&
        !mappedModuleIds.has(module.id),
    );

    return {
      summary: {
        modules: modules.length,
        voucher_types: voucherTypes.length,
        work_types: workTypes.length,
        reason_categories:
          reasonCategories.length,
        priorities: priorities.length,
        responsible_mappings:
          responsibleMappings.length,
        missing_mappings:
          missingMappings.length,
      },
      modules,
      voucher_types: voucherTypes,
      work_types: workTypes,
      reason_categories: reasonCategories,
      priorities,
      responsible_mappings: responsibleMappings,
      missing_mappings: missingMappings,
    };
  },

  async getModulesDropdown() {
    const response = await apiClient.get(
      "/erp/modules/dropdown/",
    );

    return resolveItems(response);
  },

  getModules(params = {}) {
    return getMasterList("/erp/modules/", params);
  },

  exportModules(params = {}) {
    return exportMaster(
      "/erp/modules/export/",
      params,
    );
  },

  async createModule(payload) {
    const response = await apiClient.post(
      "/erp/modules/",
      payload,
    );

    return response.data.data;
  },

  async updateModule(id, payload) {
    const response = await apiClient.patch(
      `/erp/modules/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activateModule(id) {
    const response = await apiClient.post(
      `/erp/modules/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateModule(id) {
    const response = await apiClient.post(
      `/erp/modules/${id}/deactivate/`,
    );

    return response.data.data;
  },

  getVoucherTypes(params = {}) {
    return getMasterList(
      "/erp/voucher-types/",
      params,
    );
  },

  async getVoucherTypesDropdown() {
    const response = await apiClient.get(
      "/erp/voucher-types/dropdown/",
    );

    return resolveItems(response);
  },

  exportVoucherTypes(params = {}) {
    return exportMaster(
      "/erp/voucher-types/export/",
      params,
    );
  },

  async createVoucherType(payload) {
    const response = await apiClient.post(
      "/erp/voucher-types/",
      payload,
    );

    return response.data.data;
  },

  async updateVoucherType(id, payload) {
    const response = await apiClient.patch(
      `/erp/voucher-types/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activateVoucherType(id) {
    const response = await apiClient.post(
      `/erp/voucher-types/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateVoucherType(id) {
    const response = await apiClient.post(
      `/erp/voucher-types/${id}/deactivate/`,
    );

    return response.data.data;
  },

  getWorkTypes(params = {}) {
    return getMasterList(
      "/erp/work-types/",
      params,
    );
  },

  async getWorkTypesDropdown() {
    const response = await apiClient.get(
      "/erp/work-types/dropdown/",
    );

    return resolveItems(response);
  },

  exportWorkTypes(params = {}) {
    return exportMaster(
      "/erp/work-types/export/",
      params,
    );
  },

  async createWorkType(payload) {
    const response = await apiClient.post(
      "/erp/work-types/",
      payload,
    );

    return response.data.data;
  },

  async updateWorkType(id, payload) {
    const response = await apiClient.patch(
      `/erp/work-types/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activateWorkType(id) {
    const response = await apiClient.post(
      `/erp/work-types/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateWorkType(id) {
    const response = await apiClient.post(
      `/erp/work-types/${id}/deactivate/`,
    );

    return response.data.data;
  },

  getReasonCategories(params = {}) {
    return getMasterList(
      "/erp/reason-categories/",
      params,
    );
  },

  async getReasonCategoriesDropdown() {
    const response = await apiClient.get(
      "/erp/reason-categories/dropdown/",
    );

    return resolveItems(response);
  },

  exportReasonCategories(params = {}) {
    return exportMaster(
      "/erp/reason-categories/export/",
      params,
    );
  },

  async createReasonCategory(payload) {
    const response = await apiClient.post(
      "/erp/reason-categories/",
      payload,
    );

    return response.data.data;
  },

  async updateReasonCategory(id, payload) {
    const response = await apiClient.patch(
      `/erp/reason-categories/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activateReasonCategory(id) {
    const response = await apiClient.post(
      `/erp/reason-categories/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateReasonCategory(id) {
    const response = await apiClient.post(
      `/erp/reason-categories/${id}/deactivate/`,
    );

    return response.data.data;
  },

  getPriorities(params = {}) {
    return getMasterList(
      "/erp/priorities/",
      params,
    );
  },

  async getPrioritiesDropdown() {
    const response = await apiClient.get(
      "/erp/priorities/dropdown/",
    );

    return resolveItems(response);
  },

  exportPriorities(params = {}) {
    return exportMaster(
      "/erp/priorities/export/",
      params,
    );
  },

  async createPriority(payload) {
    const response = await apiClient.post(
      "/erp/priorities/",
      payload,
    );

    return response.data.data;
  },

  async updatePriority(id, payload) {
    const response = await apiClient.patch(
      `/erp/priorities/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activatePriority(id) {
    const response = await apiClient.post(
      `/erp/priorities/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivatePriority(id) {
    const response = await apiClient.post(
      `/erp/priorities/${id}/deactivate/`,
    );

    return response.data.data;
  },

  getResponsiblePersonMappings(params = {}) {
    return getMasterList(
      "/erp/responsible-person-mappings/",
      params,
    );
  },

  exportResponsiblePersonMappings(params = {}) {
    return exportMaster(
      "/erp/responsible-person-mappings/export/",
      params,
    );
  },

  async createResponsiblePersonMapping(payload) {
    const response = await apiClient.post(
      "/erp/responsible-person-mappings/",
      payload,
    );

    return response.data.data;
  },

  async updateResponsiblePersonMapping(
    id,
    payload,
  ) {
    const response = await apiClient.patch(
      `/erp/responsible-person-mappings/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activateResponsiblePersonMapping(id) {
    const response = await apiClient.post(
      `/erp/responsible-person-mappings/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateResponsiblePersonMapping(id) {
    const response = await apiClient.post(
      `/erp/responsible-person-mappings/${id}/deactivate/`,
    );

    return response.data.data;
  },

  getRequestFieldConfigurations(params = {}) {
    return getMasterList(
      "/erp/request-field-configurations/",
      params,
    );
  },

  exportRequestFieldConfigurations(params = {}) {
    return exportMaster(
      "/erp/request-field-configurations/export/",
      params,
    );
  },

  async createRequestFieldConfiguration(payload) {
    const response = await apiClient.post(
      "/erp/request-field-configurations/",
      payload,
    );

    return response.data.data;
  },

  async updateRequestFieldConfiguration(
    id,
    payload,
  ) {
    const response = await apiClient.patch(
      `/erp/request-field-configurations/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activateRequestFieldConfiguration(id) {
    const response = await apiClient.post(
      `/erp/request-field-configurations/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateRequestFieldConfiguration(id) {
    const response = await apiClient.post(
      `/erp/request-field-configurations/${id}/deactivate/`,
    );

    return response.data.data;
  },

  async importMasters(resource, rows) {
    const createByResource = {
      modules: this.createModule,
      voucher_types: this.createVoucherType,
      work_types: this.createWorkType,
      reason_categories:
        this.createReasonCategory,
      priorities: this.createPriority,
      responsible_mappings:
        this.createResponsiblePersonMapping,
      field_configurations:
        this.createRequestFieldConfiguration,
    };
    const createItem = createByResource[resource];

    if (!createItem) {
      throw new Error(
        "Unsupported ERP import resource.",
      );
    }

    const results = [];
    for (const row of rows) {
      try {
        results.push({
          row,
          status: "created",
          data: await createItem(row),
        });
      } catch (error) {
        results.push({
          row,
          status: "failed",
          error:
            error.response?.data?.message ||
            error.message,
        });
      }
    }

    return results;
  },
};
