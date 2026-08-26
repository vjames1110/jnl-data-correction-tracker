import { useCallback, useEffect, useState } from "react";

import { offlineOutbox } from "../services/offlineOutbox";
import { flushOfflineQueue } from "../services/offlineSync";

export function useOfflineQueue({
  onSynced,
} = {}) {
  const [isOnline, setIsOnline] = useState(
    () =>
      typeof navigator === "undefined" ||
      navigator.onLine,
  );
  const [queueCount, setQueueCount] = useState(
    () => offlineOutbox.count(),
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] =
    useState(null);

  const refreshQueueCount = useCallback(() => {
    setQueueCount(offlineOutbox.count());
  }, []);

  const enqueue = useCallback(
    (action) => {
      const entry = offlineOutbox.enqueue(action);
      refreshQueueCount();
      return entry;
    },
    [refreshQueueCount],
  );

  const syncNow = useCallback(async () => {
    if (
      isSyncing ||
      !navigator.onLine ||
      offlineOutbox.count() === 0
    ) {
      return;
    }

    setIsSyncing(true);
    try {
      const result = await flushOfflineQueue({
        onSettle: refreshQueueCount,
      });
      setLastSyncResult(result);
      if (result.synced > 0) {
        onSynced?.(result);
      }
      return result;
    } finally {
      setIsSyncing(false);
      refreshQueueCount();
    }
  }, [
    isSyncing,
    onSynced,
    refreshQueueCount,
  ]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener(
      "online",
      handleOnline,
    );
    window.addEventListener(
      "offline",
      handleOffline,
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline,
      );
      window.removeEventListener(
        "offline",
        handleOffline,
      );
    };
  }, []);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    const timer = setTimeout(() => {
      syncNow();
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return {
    isOnline,
    queueCount,
    isSyncing,
    lastSyncResult,
    enqueue,
    syncNow,
    refreshQueueCount,
  };
}
