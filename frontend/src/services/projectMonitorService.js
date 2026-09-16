import { apiClient } from "./apiClient";

export const projectMonitorService = {
  async getOverview(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/overview/",
      { params },
    );

    return response.data.data;
  },

  async updateProjectSiteDetails(
    siteId,
    payload,
  ) {
    const response = await apiClient.patch(
      "/project-monitor/overview/",
      payload,
      { params: { site: siteId } },
    );

    return response.data.data;
  },

  async listStructures(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/structures/",
      { params },
    );

    return response.data.data;
  },

  async createStructure(siteId, payload) {
    const response = await apiClient.post(
      "/project-monitor/structures/",
      payload,
      { params: { site: siteId } },
    );

    return response.data.data;
  },

  async getStructure(structureId) {
    const response = await apiClient.get(
      `/project-monitor/structures/${structureId}/`,
    );

    return response.data.data;
  },

  async deleteStructure(structureId) {
    await apiClient.delete(
      `/project-monitor/structures/${structureId}/`,
    );
  },

  async updateActivity(activityId, payload) {
    const response = await apiClient.patch(
      `/project-monitor/activities/${activityId}/`,
      payload,
    );

    return response.data.data;
  },

  async listStructureTypes(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/structure-types/",
      { params },
    );

    return response.data.data;
  },

  async createStructureType(payload) {
    const response = await apiClient.post(
      "/project-monitor/structure-types/",
      payload,
    );

    return response.data.data;
  },

  async updateStructureType(
    structureTypeId,
    payload,
  ) {
    const response = await apiClient.patch(
      `/project-monitor/structure-types/${structureTypeId}/`,
      payload,
    );

    return response.data.data;
  },

  async deleteStructureType(structureTypeId) {
    await apiClient.delete(
      `/project-monitor/structure-types/${structureTypeId}/`,
    );
  },

  async listBuildings(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/buildings/",
      { params },
    );

    return response.data.data;
  },

  async createBuilding(siteId, payload) {
    const response = await apiClient.post(
      "/project-monitor/buildings/",
      payload,
      { params: { site: siteId } },
    );

    return response.data.data;
  },

  async getBuilding(buildingId) {
    const response = await apiClient.get(
      `/project-monitor/buildings/${buildingId}/`,
    );

    return response.data.data;
  },

  async deleteBuilding(buildingId) {
    await apiClient.delete(
      `/project-monitor/buildings/${buildingId}/`,
    );
  },

  async reviewActivity(activityId, payload) {
    const response = await apiClient.post(
      `/project-monitor/activities/${activityId}/review/`,
      payload,
    );

    return response.data.data;
  },

  async reviewStructure(structureId, payload) {
    const response = await apiClient.post(
      `/project-monitor/structures/${structureId}/review/`,
      payload,
    );

    return response.data.data;
  },

  async reviewBuilding(buildingId, payload) {
    const response = await apiClient.post(
      `/project-monitor/buildings/${buildingId}/review/`,
      payload,
    );

    return response.data.data;
  },

  async listGirderJobs(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/girder-jobs/",
      { params },
    );

    return response.data.data;
  },

  async createGirderJob(siteId, payload) {
    const response = await apiClient.post(
      "/project-monitor/girder-jobs/",
      payload,
      { params: { site: siteId } },
    );

    return response.data.data;
  },

  async getGirderJob(jobId) {
    const response = await apiClient.get(
      `/project-monitor/girder-jobs/${jobId}/`,
    );

    return response.data.data;
  },

  async deleteGirderJob(jobId) {
    await apiClient.delete(
      `/project-monitor/girder-jobs/${jobId}/`,
    );
  },

  async reviewGirderJob(jobId, payload) {
    const response = await apiClient.post(
      `/project-monitor/girder-jobs/${jobId}/review/`,
      payload,
    );

    return response.data.data;
  },

  async updateGirderSpan(spanId, payload) {
    const response = await apiClient.patch(
      `/project-monitor/girder-spans/${spanId}/`,
      payload,
    );

    return response.data.data;
  },

  async listRdsoSpanLibrary(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/rdso-span-library/",
      { params },
    );

    return response.data.data;
  },

  async createRdsoSpanLibraryEntry(payload) {
    const response = await apiClient.post(
      "/project-monitor/rdso-span-library/",
      payload,
    );

    return response.data.data;
  },

  async updateRdsoSpanLibraryEntry(
    entryId,
    payload,
  ) {
    const response = await apiClient.patch(
      `/project-monitor/rdso-span-library/${entryId}/`,
      payload,
    );

    return response.data.data;
  },

  async deleteRdsoSpanLibraryEntry(entryId) {
    await apiClient.delete(
      `/project-monitor/rdso-span-library/${entryId}/`,
    );
  },

  async createProjectExtension(
    siteId,
    payload,
  ) {
    const response = await apiClient.post(
      "/project-monitor/extensions/",
      payload,
      { params: { site: siteId } },
    );

    return response.data.data;
  },

  async deleteProjectExtension(extensionId) {
    await apiClient.delete(
      `/project-monitor/extensions/${extensionId}/`,
    );
  },

  async listActionItems(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/action-items/",
      { params },
    );

    return response.data.data;
  },

  async createActionItem(siteId, payload) {
    const response = await apiClient.post(
      "/project-monitor/action-items/",
      payload,
      { params: { site: siteId } },
    );

    return response.data.data;
  },

  async getActionItem(itemId) {
    const response = await apiClient.get(
      `/project-monitor/action-items/${itemId}/`,
    );

    return response.data.data;
  },

  async updateActionItem(itemId, payload) {
    const response = await apiClient.patch(
      `/project-monitor/action-items/${itemId}/`,
      payload,
    );

    return response.data.data;
  },

  async deleteActionItem(itemId) {
    await apiClient.delete(
      `/project-monitor/action-items/${itemId}/`,
    );
  },

  async listLinearItems(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/linear-items/",
      { params },
    );

    return response.data.data;
  },

  async createLinearItem(siteId, payload) {
    const response = await apiClient.post(
      "/project-monitor/linear-items/",
      payload,
      { params: { site: siteId } },
    );

    return response.data.data;
  },

  async deleteLinearItem(itemId) {
    await apiClient.delete(
      `/project-monitor/linear-items/${itemId}/`,
    );
  },

  async createScopePatch(
    linearItemId,
    payload,
  ) {
    const response = await apiClient.post(
      `/project-monitor/linear-items/${linearItemId}/scope-patches/`,
      payload,
    );

    return response.data.data;
  },

  async deleteScopePatch(patchId) {
    await apiClient.delete(
      `/project-monitor/scope-patches/${patchId}/`,
    );
  },

  async createProgressEntry(
    linearItemId,
    payload,
  ) {
    const response = await apiClient.post(
      `/project-monitor/linear-items/${linearItemId}/progress-entries/`,
      payload,
    );

    return response.data.data;
  },

  async updateProgressEntry(
    entryId,
    payload,
  ) {
    const response = await apiClient.patch(
      `/project-monitor/progress-entries/${entryId}/`,
      payload,
    );

    return response.data.data;
  },

  async deleteProgressEntry(entryId) {
    await apiClient.delete(
      `/project-monitor/progress-entries/${entryId}/`,
    );
  },
};
