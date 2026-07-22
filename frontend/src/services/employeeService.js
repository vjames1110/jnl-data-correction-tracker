import { apiClient } from "./apiClient";

function resolveItems(response) {
  return response.data?.data ?? [];
}

function resolveMeta(response) {
  return response.data?.meta ?? {};
}

function buildRoleDistribution(profiles) {
  const counts = profiles.reduce(
    (current, profile) => {
      const role = profile.role || "UNKNOWN";
      current[role] = (current[role] ?? 0) + 1;
      return current;
    },
    {},
  );

  return Object.entries(counts).map(
    ([role, count]) => ({
      role,
      count,
    }),
  );
}

function buildDashboard(profiles) {
  const totalUsers = profiles.length;
  const activeUsers = profiles.filter(
    (profile) =>
      profile.user_detail?.account_status ===
        "ACTIVE" &&
      profile.user_detail?.is_active,
  ).length;
  const lockedUsers = profiles.filter(
    (profile) =>
      profile.user_detail?.account_status ===
      "LOCKED",
  ).length;
  const suspendedUsers = profiles.filter(
    (profile) =>
      profile.user_detail?.account_status ===
      "SUSPENDED",
  ).length;
  const temporaryPasswords = profiles.filter(
    (profile) =>
      profile.user_detail?.must_change_password,
  ).length;

  return {
    summary: {
      total_users: totalUsers,
      active_users: activeUsers,
      inactive_users: profiles.filter(
        (profile) =>
          profile.user_detail?.account_status ===
            "INACTIVE" ||
          profile.is_active === false,
      ).length,
      locked_users: lockedUsers,
      suspended_users: suspendedUsers,
      temporary_passwords: temporaryPasswords,
    },
    role_distribution:
      buildRoleDistribution(profiles),
    profiles,
  };
}

export const employeeService = {
  async getDashboard() {
    const response = await apiClient.get(
      "/employees/profiles/export/",
    );
    const profiles = resolveItems(response);

    return buildDashboard(profiles);
  },

  async getProfiles(params = {}) {
    const response = await apiClient.get(
      "/employees/profiles/",
      {
        params,
      },
    );

    return {
      items: resolveItems(response),
      meta: resolveMeta(response),
    };
  },

  async exportProfiles(params = {}) {
    const response = await apiClient.get(
      "/employees/profiles/export/",
      {
        params,
      },
    );

    return resolveItems(response);
  },

  async getFilterOptions() {
    const response = await apiClient.get(
      "/employees/profiles/filter-options/",
    );

    return response.data?.data ?? {};
  },

  async getDropdown() {
    const response = await apiClient.get(
      "/employees/profiles/dropdown/",
    );

    return resolveItems(response);
  },

  async createProfile(payload) {
    const response = await apiClient.post(
      "/employees/profiles/",
      payload,
    );

    return response.data.data;
  },

  async updateProfile(profileId, payload) {
    const response = await apiClient.patch(
      `/employees/profiles/${profileId}/`,
      payload,
    );

    return response.data.data;
  },

  async activateProfile(profileId) {
    const response = await apiClient.post(
      `/employees/profiles/${profileId}/activate/`,
    );

    return response.data.data;
  },

  async deactivateProfile(profileId) {
    const response = await apiClient.post(
      `/employees/profiles/${profileId}/deactivate/`,
    );

    return response.data.data;
  },

  async createAccount(profileId, payload) {
    const response = await apiClient.post(
      `/employees/profiles/${profileId}/create-account/`,
      payload,
    );

    return response.data.data;
  },

  async resetTemporaryPassword(profileId) {
    const response = await apiClient.post(
      `/employees/profiles/${profileId}/reset-temporary-password/`,
    );

    return response.data.data;
  },

  async unlockAccount(profileId) {
    const response = await apiClient.post(
      `/employees/profiles/${profileId}/unlock-account/`,
    );

    return response.data.data;
  },

  async suspendAccount(profileId) {
    const response = await apiClient.post(
      `/employees/profiles/${profileId}/suspend-account/`,
    );

    return response.data.data;
  },

  async reactivateAccount(profileId) {
    const response = await apiClient.post(
      `/employees/profiles/${profileId}/reactivate-account/`,
    );

    return response.data.data;
  },

  async changeRole(profileId, payload) {
    const response = await apiClient.post(
      `/employees/profiles/${profileId}/change-role/`,
      payload,
    );

    return response.data.data;
  },

  async revokeSessions(profileId) {
    const response = await apiClient.post(
      `/employees/profiles/${profileId}/revoke-sessions/`,
    );

    return response.data.data;
  },

  async getLoginHistory(profileId) {
    const response = await apiClient.get(
      `/employees/profiles/${profileId}/login-history/`,
    );

    return resolveItems(response);
  },

  async downloadTemplate(format) {
    const response = await apiClient.get(
      "/employees/profiles/import-template/",
      {
        params: { format },
        responseType: "blob",
      },
    );

    return response.data;
  },

  async previewImport(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post(
      "/employees/profiles/import-preview/",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return response.data.data;
  },

  async importFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post(
      "/employees/profiles/import/",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return response.data.data;
  },

  async exportFailedRows(failedRows) {
    const response = await apiClient.post(
      "/employees/profiles/failed-rows-export/",
      {
        failed_rows: failedRows,
      },
      {
        responseType: "blob",
      },
    );

    return response.data;
  },
};
