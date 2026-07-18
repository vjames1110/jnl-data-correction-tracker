import axios from "axios";

import {
  SESSION_END_REASONS,
} from "../constants/auth";
import { env } from "../config/env";
import { tokenStorage } from "./tokenStorage";

const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

let refreshPromise = null;

function normalizeApiError(error) {
  return {
    status: error.response?.status ?? null,
    message:
      error.response?.data?.message ??
      error.message ??
      "An unexpected network error occurred.",
    errors: error.response?.data?.errors ?? null,
    errorCode:
      error.response?.data?.error_code ?? null,
    requestId:
      error.response?.headers?.["x-request-id"] ??
      null,
    originalError: error,
  };
}

async function refreshAccessToken() {
  const refreshToken =
    tokenStorage.getRefreshToken();

  if (!refreshToken) {
    throw new Error(
      "A refresh token is not available.",
    );
  }

  const response = await axios.post(
    `${env.apiBaseUrl}/auth/refresh/`,
    {
      refresh: refreshToken,
    },
    {
      timeout: 20_000,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
  );

  const tokenData =
    response.data?.data ?? response.data;

  if (!tokenData?.access) {
    throw new Error(
      "The token refresh response did not include an access token.",
    );
  }

  tokenStorage.setTokens({
    access: tokenData.access,
    refresh:
      tokenData.refresh ?? refreshToken,
  });

  return tokenData.access;
}

apiClient.interceptors.request.use(
  (config) => {
    const accessToken =
      tokenStorage.getAccessToken();

    if (accessToken) {
      config.headers.Authorization =
        `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(
    normalizeApiError(error),
  ),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    const isRefreshRequest =
      originalRequest?.url?.includes(
        "/auth/refresh/",
      );

    if (
      status === 401 &&
      !originalRequest?._retry &&
      !isRefreshRequest &&
      tokenStorage.hasRefreshToken()
    ) {
      originalRequest._retry = true;

      try {
        refreshPromise ??=
          refreshAccessToken().finally(() => {
            refreshPromise = null;
          });

        const newAccessToken =
          await refreshPromise;

        originalRequest.headers.Authorization =
          `Bearer ${newAccessToken}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        tokenStorage.clearTokens();

        window.dispatchEvent(
          new CustomEvent(
            "jnl:authentication-expired",
            {
              detail: {
                reason:
                  SESSION_END_REASONS.REFRESH_FAILED,
              },
            },
          ),
        );

        return Promise.reject(
          normalizeApiError(refreshError),
        );
      }
    }

    return Promise.reject(
      normalizeApiError(error),
    );
  },
);

export { apiClient };
