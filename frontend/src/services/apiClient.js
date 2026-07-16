import axios from "axios";

import { env } from "../config/env";

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalizedError = {
      status: error.response?.status ?? null,
      message:
        error.response?.data?.message ??
        error.message ??
        "An unexpected network error occurred.",
      errors: error.response?.data?.errors ?? null,
    };

    return Promise.reject(normalizedError);
  },
);