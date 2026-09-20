import { apiClient } from "./apiClient";

export const projectMonitorService = {
  async getDprAccess(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/dpr/access/",
      { params },
    );
    return response.data.data;
  },

  async getDprContract(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/dpr/contract/",
      { params },
    );
    return response.data.data;
  },

  async updateDprContract(siteId, payload) {
    const response = await apiClient.patch(
      "/project-monitor/dpr/contract/",
      payload,
      { params: { site: siteId } },
    );
    return response.data.data;
  },

  async listDprItems(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/dpr/items/",
      { params },
    );
    return response.data.data;
  },

  async createDprItem(payload) {
    const response = await apiClient.post(
      "/project-monitor/dpr/items/",
      payload,
    );
    return response.data.data;
  },

  async updateDprItem(itemId, payload) {
    const response = await apiClient.patch(
      `/project-monitor/dpr/items/${itemId}/`,
      payload,
    );
    return response.data.data;
  },

  async deleteDprItem(itemId) {
    await apiClient.delete(
      `/project-monitor/dpr/items/${itemId}/`,
    );
  },

  async importDprItems(siteId, file) {
    const form = new FormData();
    form.append("site", siteId);
    form.append("file", file);
    const response = await apiClient.post(
      "/project-monitor/dpr/items/import/",
      form,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data.data;
  },

  async uploadDpr(siteId, file) {
    const form = new FormData();
    form.append("site", siteId);
    form.append("file", file);
    const response = await apiClient.post(
      "/project-monitor/dpr/upload/",
      form,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data.data;
  },

  async downloadDprTemplate(siteId, kind) {
    const response = await apiClient.get(
      "/project-monitor/dpr/template/",
      {
        params: { site: siteId, kind },
        responseType: "blob",
      },
    );
    return response.data;
  },

  async getDprGrid(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/dpr/grid/",
      { params },
    );
    return response.data.data;
  },

  async saveDprGrid(payload) {
    const response = await apiClient.put(
      "/project-monitor/dpr/grid/",
      payload,
    );
    return response.data.data;
  },

  async listDprEntries(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/dpr/entries/",
      { params },
    );
    return response.data.data;
  },

  async createDprEntry(payload) {
    const response = await apiClient.post(
      "/project-monitor/dpr/entries/",
      payload,
    );
    return response.data.data;
  },

  async deleteDprEntry(entryId) {
    await apiClient.delete(
      `/project-monitor/dpr/entries/${entryId}/`,
    );
  },

  async listDprUnlocks(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/dpr/unlock/",
      { params },
    );
    return response.data.data;
  },

  async unlockDprDay(payload) {
    const response = await apiClient.post(
      "/project-monitor/dpr/unlock/",
      payload,
    );
    return response.data.data;
  },

  async listRaBills(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/ra-bills/",
      { params },
    );
    return response.data.data;
  },

  async createRaBill(payload) {
    const response = await apiClient.post(
      "/project-monitor/ra-bills/",
      payload,
    );
    return response.data.data;
  },

  async updateRaBill(billId, payload) {
    const response = await apiClient.patch(
      `/project-monitor/ra-bills/${billId}/`,
      payload,
    );
    return response.data.data;
  },

  async deleteRaBill(billId) {
    await apiClient.delete(
      `/project-monitor/ra-bills/${billId}/`,
    );
  },

  async getFinancialSummary(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/financial-summary/",
      { params },
    );
    return response.data.data;
  },

  async getFinancialReport(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/financial-report/",
      { params },
    );
    return response.data.data;
  },

  // ---- HR (labour and staff cost) ----

  async getHrAccess(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/hr/access/",
      { params },
    );
    return response.data.data;
  },

  async getHrSummary(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/hr/summary/",
      { params },
    );
    return response.data.data;
  },

  async listLabour(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/hr/labour/",
      { params },
    );
    return response.data.data;
  },

  async createLabour(payload) {
    const response = await apiClient.post(
      "/project-monitor/hr/labour/",
      payload,
    );
    return response.data.data;
  },

  async deleteLabour(entryId) {
    await apiClient.delete(
      `/project-monitor/hr/labour/${entryId}/`,
    );
  },

  async listStaff(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/hr/staff/",
      { params },
    );
    return response.data.data;
  },

  async createStaff(payload) {
    const response = await apiClient.post(
      "/project-monitor/hr/staff/",
      payload,
    );
    return response.data.data;
  },

  async updateStaff(staffId, payload) {
    const response = await apiClient.patch(
      `/project-monitor/hr/staff/${staffId}/`,
      payload,
    );
    return response.data.data;
  },

  async deleteStaff(staffId) {
    await apiClient.delete(
      `/project-monitor/hr/staff/${staffId}/`,
    );
  },

  async listStaffOverrides(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/hr/overrides/",
      { params },
    );
    return response.data.data;
  },

  async saveStaffOverride(payload) {
    const response = await apiClient.post(
      "/project-monitor/hr/overrides/",
      payload,
    );
    return response.data.data;
  },

  async deleteStaffOverride(overrideId) {
    await apiClient.delete(
      `/project-monitor/hr/overrides/${overrideId}/`,
    );
  },

  async downloadHrTemplate(siteId) {
    const response = await apiClient.get(
      "/project-monitor/hr/template/",
      {
        params: siteId ? { site: siteId } : {},
        responseType: "blob",
      },
    );
    return response.data;
  },

  async uploadHr(siteId, file) {
    const form = new FormData();
    if (siteId) {
      form.append("site", siteId);
    }
    form.append("file", file);
    const response = await apiClient.post(
      "/project-monitor/hr/upload/",
      form,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data.data;
  },

  // ---- Machinery (machines, usage, fuel) ----

  async getMachineryAccess(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/machinery/access/",
      { params },
    );
    return response.data.data;
  },

  async getMachinerySummary(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/machinery/summary/",
      { params },
    );
    return response.data.data;
  },

  async listMachines(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/machinery/machines/",
      { params },
    );
    return response.data.data;
  },

  async createMachine(payload) {
    const response = await apiClient.post(
      "/project-monitor/machinery/machines/",
      payload,
    );
    return response.data.data;
  },

  async updateMachine(machineId, payload) {
    const response = await apiClient.patch(
      `/project-monitor/machinery/machines/${machineId}/`,
      payload,
    );
    return response.data.data;
  },

  async deleteMachine(machineId) {
    await apiClient.delete(
      `/project-monitor/machinery/machines/${machineId}/`,
    );
  },

  async listMachineUsage(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/machinery/usage/",
      { params },
    );
    return response.data.data;
  },

  async saveMachineUsage(payload) {
    const response = await apiClient.post(
      "/project-monitor/machinery/usage/",
      payload,
    );
    return response.data.data;
  },

  async deleteMachineUsage(usageId) {
    await apiClient.delete(
      `/project-monitor/machinery/usage/${usageId}/`,
    );
  },

  async listFuel(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/machinery/fuel/",
      { params },
    );
    return response.data.data;
  },

  async createFuel(payload) {
    const response = await apiClient.post(
      "/project-monitor/machinery/fuel/",
      payload,
    );
    return response.data.data;
  },

  async deleteFuel(fuelId) {
    await apiClient.delete(
      `/project-monitor/machinery/fuel/${fuelId}/`,
    );
  },

  async downloadMachineryTemplate(siteId) {
    const response = await apiClient.get(
      "/project-monitor/machinery/template/",
      {
        params: siteId ? { site: siteId } : {},
        responseType: "blob",
      },
    );
    return response.data;
  },

  async uploadMachinery(siteId, file) {
    const form = new FormData();
    if (siteId) {
      form.append("site", siteId);
    }
    form.append("file", file);
    const response = await apiClient.post(
      "/project-monitor/machinery/upload/",
      form,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data.data;
  },

  async listSiteAccess(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/site-access/",
      { params },
    );
    return response.data.data;
  },

  async grantSiteAccess(payload) {
    const response = await apiClient.post(
      "/project-monitor/site-access/",
      payload,
    );
    return response.data.data;
  },

  async revokeSiteAccess(accessId) {
    await apiClient.delete(
      `/project-monitor/site-access/${accessId}/`,
    );
  },

  async getDashboard(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/dashboard/",
      { params },
    );

    return response.data.data;
  },

  async getDueTracker(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/due-tracker/",
      { params },
    );

    return response.data.data;
  },

  async getOverdueCounts(params = {}) {
    const response = await apiClient.get(
      "/project-monitor/overdue-counts/",
      { params },
    );

    return response.data.data;
  },

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
