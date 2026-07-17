import { AUTH_STORAGE_KEYS } from "../constants/auth";

function getStorage() {
  return window.sessionStorage;
}

export const tokenStorage = {
  getAccessToken() {
    return getStorage().getItem(
      AUTH_STORAGE_KEYS.ACCESS_TOKEN,
    );
  },

  getRefreshToken() {
    return getStorage().getItem(
      AUTH_STORAGE_KEYS.REFRESH_TOKEN,
    );
  },

  setTokens({ access, refresh }) {
    const storage = getStorage();

    if (access) {
      storage.setItem(
        AUTH_STORAGE_KEYS.ACCESS_TOKEN,
        access,
      );
    }

    if (refresh) {
      storage.setItem(
        AUTH_STORAGE_KEYS.REFRESH_TOKEN,
        refresh,
      );
    }
  },

  setAccessToken(accessToken) {
    if (!accessToken) {
      return;
    }

    getStorage().setItem(
      AUTH_STORAGE_KEYS.ACCESS_TOKEN,
      accessToken,
    );
  },

  clearTokens() {
    const storage = getStorage();

    storage.removeItem(
      AUTH_STORAGE_KEYS.ACCESS_TOKEN,
    );
    storage.removeItem(
      AUTH_STORAGE_KEYS.REFRESH_TOKEN,
    );
  },

  hasRefreshToken() {
    return Boolean(this.getRefreshToken());
  },
};