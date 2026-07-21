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
};
