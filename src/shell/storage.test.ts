import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createShellStorage, type StorageBackend } from "./storage.ts";

/** A localStorage stand-in that can be told to fail on demand. */
function fakeBackend() {
  const data = new Map<string, string>();
  let failNext = 0;
  return {
    data,
    fail(times: number) {
      failNext = times;
    },
    backend: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failNext > 0) {
          failNext -= 1;
          const error = new Error("QuotaExceededError");
          error.name = "QuotaExceededError";
          throw error;
        }
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
    } satisfies StorageBackend,
  };
}

/** Manual timers: the adapter's debounce is what these tests are about. */
function fakeTimers() {
  let pending: (() => void) | null = null;
  return {
    setTimer(fn: () => void) {
      pending = fn;
      return 1;
    },
    clearTimer() {
      pending = null;
    },
    /** Run the scheduled write, if any. Returns false when nothing was due. */
    run() {
      const fn = pending;
      pending = null;
      if (!fn) return false;
      fn();
      return true;
    },
    get scheduled() {
      return pending !== null;
    },
  };
}

describe("shell storage", () => {
  it("coalesces a burst of writes into one", () => {
    const { backend, data } = fakeBackend();
    const timers = fakeTimers();
    const storage = createShellStorage({
      backend,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });

    storage.setItem("shell-os-v1", "one");
    storage.setItem("shell-os-v1", "two");
    storage.setItem("shell-os-v1", "three");
    assert.equal(data.size, 0, "nothing is written before the window closes");
    assert.ok(timers.scheduled);
    assert.ok(timers.run());
    assert.equal(data.get("shell-os-v1"), "three");
    assert.equal(storage.pending(), false);
  });

  it("flushes immediately when asked (tab close, hydration hand-off)", () => {
    const { backend, data } = fakeBackend();
    const timers = fakeTimers();
    const storage = createShellStorage({
      backend,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });

    storage.setItem("shell-os-v1", "typed");
    storage.flush();
    assert.equal(data.get("shell-os-v1"), "typed");
    assert.equal(timers.scheduled, false, "the timer is cancelled, not left to fire later");
    assert.equal(storage.pending(), false);
  });

  it("drops a write that cannot be stored instead of throwing into the store", () => {
    const { backend, data, fail } = fakeBackend();
    const errors: unknown[] = [];
    const timers = fakeTimers();
    const storage = createShellStorage({
      backend,
      onWriteError: (error) => errors.push(error),
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });

    fail(2);
    assert.doesNotThrow(() => {
      storage.setItem("shell-os-v1", "too big");
      storage.setItem("shell-os-v1-extra", "also too big");
      storage.flush();
    });
    assert.equal(data.size, 0);
    assert.equal(errors.length, 1, "reported once for the batch, not once per key");

    // A later change still writes — a full disk is not a dead app.
    storage.setItem("shell-os-v1", "smaller");
    storage.flush();
    assert.equal(data.get("shell-os-v1"), "smaller");
    assert.equal(errors.length, 1, "only a failure reports");
  });

  it("survives a backend that throws on read", () => {
    const storage = createShellStorage({
      backend: {
        getItem() {
          throw new Error("access denied");
        },
        setItem() {},
        removeItem() {},
      },
    });
    assert.equal(storage.getItem("shell-os-v1"), null);
  });

  it("works with no storage at all (SSR, blocked cookies)", () => {
    const storage = createShellStorage({ backend: null });
    assert.equal(storage.getItem("shell-os-v1"), null);
    assert.doesNotThrow(() => {
      storage.setItem("shell-os-v1", "value");
      storage.flush();
      storage.removeItem("shell-os-v1");
    });
  });

  it("removeItem wins over a write still pending for the same key", () => {
    const { backend, data } = fakeBackend();
    const timers = fakeTimers();
    const storage = createShellStorage({
      backend,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });

    storage.setItem("shell-os-v1", "erase me");
    storage.removeItem("shell-os-v1");
    assert.equal(data.has("shell-os-v1"), false);
    timers.run();
    assert.equal(data.has("shell-os-v1"), false, "a stale flush must not resurrect it");
  });

  it("writes through when the debounce is zero", () => {
    const { backend, data } = fakeBackend();
    const storage = createShellStorage({ backend, debounceMs: 0 });
    storage.setItem("shell-os-v1", "now");
    assert.equal(data.get("shell-os-v1"), "now");
  });
});
