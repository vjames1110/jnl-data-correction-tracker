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

  async getUnreadCount() {
    const response = await apiClient.get(
      "/notifications/unread-count/",
    );

    return resolveItem(response) ?? {
      unread_count: 0,
    };
  },

  async markRead(id) {
    const response = await apiClient.post(
      `/notifications/${id}/mark-read/`,
    );

    return resolveItem(response);
  },

  async markUnread(id) {
    const response = await apiClient.post(
      `/notifications/${id}/mark-unread/`,
    );

    return resolveItem(response);
  },

  async markAllRead() {
    const response = await apiClient.post(
      "/notifications/mark-all-read/",
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
