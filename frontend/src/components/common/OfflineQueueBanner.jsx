import { CloudOff, RefreshCw, WifiOff } from "lucide-react";

export function OfflineQueueBanner({
  isOnline,
  queueCount,
  isSyncing,
  onSyncNow,
}) {
  if (isOnline && queueCount === 0) {
    return null;
  }

  return (
    <div
      className={`inline-alert ${
        isOnline
          ? "inline-alert--warning"
          : "inline-alert--error"
      }`}
    >
      {isOnline ? (
        <CloudOff size={16} />
      ) : (
        <WifiOff size={16} />
      )}
      <div>
        <strong>
          {isOnline
            ? "Back online"
            : "You're offline"}
        </strong>
        <p>
          {queueCount > 0
            ? `${queueCount} change(s) saved on this device, waiting to sync.`
            : "Changes will be saved on this device and sent when you're back online."}
        </p>
      </div>
      {isOnline && queueCount > 0 ? (
        <button
          type="button"
          className="button button--tertiary"
          onClick={onSyncNow}
          disabled={isSyncing}
        >
          <RefreshCw size={15} />
          {isSyncing ? "Syncing..." : "Sync Now"}
        </button>
      ) : null}
    </div>
  );
}
