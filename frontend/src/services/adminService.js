import { apiClient } from "./apiClient";

export const adminService = {
  async getDashboard(period = "30d") {
    const response = await apiClient.get(
      "/admin-portal/dashboard/",
      {
        params: { period },
      },
    );

    return response.data.data;
  },

  async getLoginTrend(period = "30d") {
    const response = await apiClient.get(
      "/admin-portal/dashboard/login-trend/",
      {
        params: { period },
      },
    );

    return response.data.data;
  },

  async getRecentActivity(limit = 10) {
    const response = await apiClient.get(
      "/admin-portal/recent-activity/",
      {
        params: { limit },
      },
    );

    return response.data.data;
  },

  async getProfile() {
    const response = await apiClient.get(
      "/admin-portal/profile/",
    );

    return response.data.data;
  },

  async getCapabilities() {
    const response = await apiClient.get(
      "/admin-portal/capabilities/",
    );

    return response.data.data;
  },

  async getServerTime() {
    const response = await apiClient.get(
      "/admin-portal/server-time/",
    );

    return response.data.data;
  },
};