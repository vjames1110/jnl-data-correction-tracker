import { offlineOutbox } from "./offlineOutbox";
import { reconciliationService } from "./reconciliationService";

export function isNetworkError(error) {
  return (
    Boolean(error) &&
    (error.status === null ||
      error.status === undefined)
  );
}

async function replayAction(action) {
  switch (action.type) {
    case "createEntry":
      return reconciliationService.createEntry(
        action.payload,
      );
    case "updateEntry":
      return reconciliationService.updateEntry(
        action.entityId,
        action.payload,
      );
    case "createOutputEntry":
      return reconciliationService.createOutputEntry(
        action.payload,
      );
    case "deleteOutputEntry":
      try {
        return await reconciliationService.deleteOutputEntry(
          action.entityId,
        );
      } catch (error) {
        if (error?.status === 404) {
          return null;
        }
        throw error;
      }
    default:
      return null;
  }
}

export async function flushOfflineQueue({
  onSettle,
} = {}) {
  const queue = offlineOutbox.getAll();
  const result = {
    synced: 0,
    failed: 0,
    remaining: queue.length,
  };

  for (const action of queue) {
    try {
      await replayAction(action);
      offlineOutbox.remove(action.id);
      result.synced += 1;
      result.remaining -= 1;
    } catch (error) {
      if (isNetworkError(error)) {
        // Still offline (or the connection dropped
        // again mid-sync) - stop here and leave the
        // rest of the queue for the next attempt.
        break;
      }

      // A genuine server-side rejection (validation,
      // permission, the period got locked by someone
      // else in the meantime). Retrying it forever
      // would never succeed, so drop it and surface it
      // instead of silently losing the reason why.
      offlineOutbox.remove(action.id);
      result.failed += 1;
      result.remaining -= 1;
    }

    onSettle?.(result, action);
  }

  return result;
}
