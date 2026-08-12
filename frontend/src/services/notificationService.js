import { apiClient } from "./apiClient";

function resolveItems(response) {
  const payload = response.data?.data ?? response.data;

  return Array.isArray(payload) ? payload : [];
}

function resolveItem(response) {
  return response.data?.data ?? response.data ?? null;
}

function resolveMeta(response) {
  return response.data?.meta ?? {};
}

export const notificationService = {
  async getNotifications(params = {}) {
    const response = await apiClient.get(
      "/notifications/",
      {
        params,
      },
    );

    return {
      items: resolveItems(response),
      meta: resolveMeta(response),
    };
  },

  async getNotification(id) {
    const response = await apiClient.get(
      `/notifications/${id}/`,
    );

    return resolveItem(response);
  },

  async getPreferences() {
    const response = await apiClient.get(
      "/notifications/preferences/",
    );

    return resolveItem(response) ?? {};
  },

  async updatePreferences(payload) {
    const response = await apiClient.patch(
      "/notifications/preferences/",
      payload,
    );

    return resolveItem(response);
  },
};
