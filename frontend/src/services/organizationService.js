import { apiClient } from "./apiClient";

function resolveItems(response) {
  return response.data?.data ?? [];
}

function resolveMeta(response) {
  return response.data?.meta ?? {};
}

export const organizationService = {
  async getCompaniesDropdown() {
    const response = await apiClient.get(
      "/organization/companies/dropdown/",
    );

    return resolveItems(response);
  },

  async getSitesDropdown() {
    const response = await apiClient.get(
      "/organization/sites/dropdown/",
    );

    return resolveItems(response);
  },

  async getDepartmentsDropdown() {
    const response = await apiClient.get(
      "/organization/departments/dropdown/",
    );

    return resolveItems(response);
  },

  async getUsersDropdown() {
    const response = await apiClient.get(
      "/organization/users/dropdown/",
    );

    return resolveItems(response);
  },

  async getDashboard() {
    const [
      sitesResponse,
      departmentsResponse,
      designationsResponse,
      directorMappingsResponse,
      siteDepartmentMappingsResponse,
    ] = await Promise.all([
      apiClient.get(
        "/organization/sites/export/",
      ),
      apiClient.get(
        "/organization/departments/export/",
      ),
      apiClient.get(
        "/organization/designations/export/",
      ),
      apiClient.get(
        "/organization/director-mappings/export/",
      ),
      apiClient.get(
        "/organization/site-department-mappings/export/",
      ),
    ]);

    const sites = resolveItems(sitesResponse);
    const departments = resolveItems(
      departmentsResponse,
    );
    const designations = resolveItems(
      designationsResponse,
    );
    const directorMappings = resolveItems(
      directorMappingsResponse,
    );
    const siteDepartmentMappings = resolveItems(
      siteDepartmentMappingsResponse,
    );

    const missingSiteHods = sites.filter(
      (site) => !site.site_hod,
    ).length;
    const missingDepartmentHods =
      departments.filter(
        (department) =>
          !department.department_hod,
      ).length;
    const missingMappingHods =
      siteDepartmentMappings.filter(
        (mapping) =>
          !mapping.site_hod ||
          !mapping.department_hod,
      ).length;

    return {
      summary: {
        total_sites: sites.length,
        active_sites: sites.filter(
          (site) => site.is_active,
        ).length,
        departments: departments.length,
        designations: designations.length,
        director_mappings:
          directorMappings.length,
        missing_hod_mappings:
          missingSiteHods +
          missingDepartmentHods +
          missingMappingHods,
      },
      sites,
      departments,
      designations,
      director_mappings: directorMappings,
      site_department_mappings:
        siteDepartmentMappings,
    };
  },

  async getHodMappings() {
    const [
      sitesResponse,
      departmentsResponse,
      siteDepartmentMappingsResponse,
      usersResponse,
    ] = await Promise.all([
      apiClient.get(
        "/organization/sites/export/",
      ),
      apiClient.get(
        "/organization/departments/export/",
      ),
      apiClient.get(
        "/organization/site-department-mappings/export/",
      ),
      apiClient.get(
        "/organization/users/dropdown/",
      ),
    ]);

    const sites = resolveItems(sitesResponse);
    const departments = resolveItems(
      departmentsResponse,
    );
    const siteDepartmentMappings = resolveItems(
      siteDepartmentMappingsResponse,
    );
    const users = resolveItems(usersResponse);

    const missingSiteHods = sites.filter(
      (site) => !site.site_hod,
    );
    const missingDepartmentHods =
      departments.filter(
        (department) =>
          !department.department_hod,
      );
    const incompleteMappingHistory =
      siteDepartmentMappings.filter(
        (mapping) =>
          !mapping.site_hod ||
          !mapping.department_hod,
      );

    return {
      summary: {
        sites: sites.length,
        departments: departments.length,
        missing_site_hods:
          missingSiteHods.length,
        missing_department_hods:
          missingDepartmentHods.length,
        incomplete_mapping_history:
          incompleteMappingHistory.length,
        total_missing:
          missingSiteHods.length +
          missingDepartmentHods.length +
          incompleteMappingHistory.length,
      },
      sites,
      departments,
      site_department_mappings:
        siteDepartmentMappings,
      users,
      missing: {
        site_hods: missingSiteHods,
        department_hods:
          missingDepartmentHods,
        mapping_history:
          incompleteMappingHistory,
      },
    };
  },

  async getSites(params = {}) {
    const response = await apiClient.get(
      "/organization/sites/",
      {
        params,
      },
    );

    return {
      items: resolveItems(response),
      meta: resolveMeta(response),
    };
  },

  async exportSites(params = {}) {
    const response = await apiClient.get(
      "/organization/sites/export/",
      {
        params,
      },
    );

    return resolveItems(response);
  },

  async createSite(payload) {
    const response = await apiClient.post(
      "/organization/sites/",
      payload,
    );

    return response.data.data;
  },

  async updateSite(id, payload) {
    const response = await apiClient.patch(
      `/organization/sites/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async updateSiteHod(id, siteHod) {
    const response = await apiClient.patch(
      `/organization/sites/${id}/`,
      {
        site_hod: siteHod || null,
      },
    );

    return response.data.data;
  },

  async activateSite(id) {
    const response = await apiClient.post(
      `/organization/sites/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateSite(id) {
    const response = await apiClient.post(
      `/organization/sites/${id}/deactivate/`,
    );

    return response.data.data;
  },

  async getDepartments(params = {}) {
    const response = await apiClient.get(
      "/organization/departments/",
      {
        params,
      },
    );

    return {
      items: resolveItems(response),
      meta: resolveMeta(response),
    };
  },

  async exportDepartments(params = {}) {
    const response = await apiClient.get(
      "/organization/departments/export/",
      {
        params,
      },
    );

    return resolveItems(response);
  },

  async createDepartment(payload) {
    const response = await apiClient.post(
      "/organization/departments/",
      payload,
    );

    return response.data.data;
  },

  async updateDepartment(id, payload) {
    const response = await apiClient.patch(
      `/organization/departments/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async updateDepartmentHod(
    id,
    departmentHod,
  ) {
    const response = await apiClient.patch(
      `/organization/departments/${id}/`,
      {
        department_hod:
          departmentHod || null,
      },
    );

    return response.data.data;
  },

  async activateDepartment(id) {
    const response = await apiClient.post(
      `/organization/departments/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateDepartment(id) {
    const response = await apiClient.post(
      `/organization/departments/${id}/deactivate/`,
    );

    return response.data.data;
  },

  async getDesignations(params = {}) {
    const response = await apiClient.get(
      "/organization/designations/",
      {
        params,
      },
    );

    return {
      items: resolveItems(response),
      meta: resolveMeta(response),
    };
  },

  async exportDesignations(params = {}) {
    const response = await apiClient.get(
      "/organization/designations/export/",
      {
        params,
      },
    );

    return resolveItems(response);
  },

  async createDesignation(payload) {
    const response = await apiClient.post(
      "/organization/designations/",
      payload,
    );

    return response.data.data;
  },

  async updateDesignation(id, payload) {
    const response = await apiClient.patch(
      `/organization/designations/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activateDesignation(id) {
    const response = await apiClient.post(
      `/organization/designations/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateDesignation(id) {
    const response = await apiClient.post(
      `/organization/designations/${id}/deactivate/`,
    );

    return response.data.data;
  },

  async getDirectorMappings(params = {}) {
    const response = await apiClient.get(
      "/organization/director-mappings/",
      {
        params,
      },
    );

    return {
      items: resolveItems(response),
      meta: resolveMeta(response),
    };
  },

  async exportDirectorMappings(params = {}) {
    const response = await apiClient.get(
      "/organization/director-mappings/export/",
      {
        params,
      },
    );

    return resolveItems(response);
  },

  async createDirectorMapping(payload) {
    const response = await apiClient.post(
      "/organization/director-mappings/",
      payload,
    );

    return response.data.data;
  },

  async updateDirectorMapping(id, payload) {
    const response = await apiClient.patch(
      `/organization/director-mappings/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async activateDirectorMapping(id) {
    const response = await apiClient.post(
      `/organization/director-mappings/${id}/activate/`,
    );

    return response.data.data;
  },

  async deactivateDirectorMapping(id) {
    const response = await apiClient.post(
      `/organization/director-mappings/${id}/deactivate/`,
    );

    return response.data.data;
  },
};
