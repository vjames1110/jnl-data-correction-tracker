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
};
