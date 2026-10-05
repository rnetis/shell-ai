/**
 * The persistence adapter behind the Shell store.
 *
 * Plain `localStorage` gets two things wrong for an app that keeps a whole
 * desk of user data:
 *
 *  - A write can throw (quota reached, storage disabled, Safari private
 *    mode). Zustand persists synchronously inside the state update, so an
 *    uncaught throw takes the UI down with it — on every change afterwards.
 *  - Every keystroke serializes every mini app on the desk. Debouncing the
 *    write turns a per-keystroke full-store serialization into at most one per
 *    window, and a flush when the tab goes away means nothing is lost.
 */

export type StorageBackend = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type ShellStorageOptions = {
  /** Defaults to `window.localStorage` when a window exists, else a no-op. */
  backend?: StorageBackend | null;
  /** Trailing debounce for `setItem`. `0` writes through. */
  debounceMs?: number;
  /** Called once per failed flush (never re-thrown into the store). */
  onWriteError?: (error: unknown) => void;
  /** Timer hooks, so tests can drive the debounce without wall-clock waits. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export type ShellStorage = StorageBackend & {
  /** Write anything still pending, right now. */
  flush(): void;
  /** True while a debounced write is scheduled. */
  pending(): boolean;
};

const DEFAULT_DEBOUNCE_MS = 250;

function browserBackend(): StorageBackend | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Accessing localStorage itself throws when cookies are blocked.
    return null;
  }
}

export function createShellStorage(options: ShellStorageOptions = {}): ShellStorage {
  const backend = options.backend ?? browserBackend();
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as number));

  // `null` means "delete this key". Writes are coalesced: one pending value
  // per key is the latest truth, so a burst costs one serialization.
  const queued = new Map<string, string | null>();
  let timer: unknown = null;
  let writeErrorReported = false;

  function apply() {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    const entries = [...queued];
    queued.clear();
    if (!backend || entries.length === 0) return;
    for (const [key, value] of entries) {
      try {
        if (value === null) backend.removeItem(key);
        else backend.setItem(key, value);
      } catch (error) {
        // Quota or a blocked origin: drop this batch rather than spin on it.
        // The in-memory state is still correct, and the next change retries.
        if (!writeErrorReported) {
          writeErrorReported = true;
          options.onWriteError?.(error);
        }
      }
    }
  }

  function schedule() {
    // Debounce off means write-through, not "never write".
    if (debounceMs <= 0) {
      apply();
      return;
    }
    if (timer !== null) return;
    timer = setTimer(apply, debounceMs);
  }

  return {
    getItem(key) {
      try {
        return backend?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      queued.set(key, value);
      schedule();
    },
    removeItem(key) {
      queued.delete(key);
      apply();
      // `apply` already flushed other keys; queue the deletion through the
      // backend directly so a reset cannot be undone by an earlier pending
      // write of the same key.
      if (!backend) return;
      try {
        backend.removeItem(key);
      } catch (error) {
        if (!writeErrorReported) {
          writeErrorReported = true;
          options.onWriteError?.(error);
        }
      }
    },
    flush: apply,
    pending: () => timer !== null || queued.size > 0,
  };
}
