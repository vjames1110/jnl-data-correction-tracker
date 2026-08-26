const STORAGE_KEY = "jnl_reconciliation_offline_outbox_v1";

function generateId() {
  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID();
  }

  return `client-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(queue),
    );
  } catch {
    // Storage unavailable (private browsing, quota
    // exceeded) - the queue simply won't survive a
    // reload; in-memory retry within the same tab
    // session still works.
  }
}

export const offlineOutbox = {
  generateId,

  getAll() {
    return readQueue();
  },

  count() {
    return readQueue().length;
  },

  enqueue(action) {
    const entry = {
      id: action.id ?? generateId(),
      type: action.type,
      payload: action.payload,
      entityId: action.entityId ?? null,
      dedupeKey: action.dedupeKey ?? null,
      label: action.label ?? "",
      queuedAt: new Date().toISOString(),
    };

    // Replace, not append, when this action targets the same
    // logical write as one already queued (e.g. the user edits the
    // same still-unsynced row twice before reconnecting) - otherwise
    // the stale first edit would still get sent, and since it's
    // idempotent-by-id the later edit would be silently dropped
    // instead of overwriting it.
    const queue = readQueue().filter(
      (item) =>
        !(
          entry.dedupeKey &&
          item.dedupeKey === entry.dedupeKey
        ),
    );
    queue.push(entry);
    writeQueue(queue);
    return entry;
  },

  remove(actionId) {
    writeQueue(
      readQueue().filter(
        (item) => item.id !== actionId,
      ),
    );
  },

  clear() {
    writeQueue([]);
  },
};
