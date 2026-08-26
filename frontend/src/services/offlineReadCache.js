const STORAGE_PREFIX =
  "jnl_reconciliation_read_cache_v1:";

function storageKey(cacheKey) {
  return STORAGE_PREFIX + cacheKey;
}

export const offlineReadCache = {
  get(cacheKey) {
    try {
      const raw = localStorage.getItem(
        storageKey(cacheKey),
      );
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  set(cacheKey, data) {
    try {
      localStorage.setItem(
        storageKey(cacheKey),
        JSON.stringify({
          data,
          cachedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // Storage unavailable (private browsing, quota
      // exceeded) - reads simply won't have an offline
      // fallback this session.
    }
  },
};
