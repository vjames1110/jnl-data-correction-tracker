import { apiClient } from "./apiClient";

export const authService = {
  async login(credentials) {
    const response = await apiClient.post(
      "/auth/login/",
      credentials,
    );

    return response.data.data;
  },

  async getCurrentUser() {
    const response = await apiClient.get(
      "/auth/me/",
    );

    return response.data.data;
  },

  async changePassword(payload) {
    const response = await apiClient.post(
      "/auth/change-password/",
      payload,
    );

    return response.data;
  },

  async logout(refreshToken) {
    const response = await apiClient.post(
      "/auth/logout/",
      {
        refresh: refreshToken,
      },
    );

    return response.data;
  },
};