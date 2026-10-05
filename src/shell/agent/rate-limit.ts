/**
 * Fixed-window allowance for the Grok writer.
 *
 * `composeWithGrok` spends the app owner's xAI key on behalf of whoever can
 * reach the deployed endpoint, so the endpoint needs a ceiling that does not
 * depend on the caller behaving. The counter is in-process: on a serverless
 * platform each instance keeps its own, which still bounds the burn rate of a
 * hot instance and needs no database.
 */

export type RateLimiter = {
  /** True while this key is inside the allowance; consumes one slot. */
  allow(key: string, now?: number): boolean;
  /** Drop all counters (tests, and a deploy that wants a clean slate). */
  reset(): void;
};

export type RateLimit = {
  limit: number;
  windowMs: number;
};

/** Bound the map so rotating keys cannot grow it without end. */
const MAX_KEYS = 5_000;

export function createRateLimiter({ limit, windowMs }: RateLimit): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    allow(key, now = Date.now()) {
      const bucket = buckets.get(key);
      if (!bucket || now >= bucket.resetAt) {
        if (buckets.size >= MAX_KEYS) {
          for (const [staleKey, entry] of buckets) {
            if (now >= entry.resetAt) buckets.delete(staleKey);
          }
          // Still full of live entries: drop the oldest so the map stays
          // bounded even under a flood of fresh keys.
          for (const oldest of buckets.keys()) {
            if (buckets.size < MAX_KEYS) break;
            buckets.delete(oldest);
          }
        }
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (bucket.count >= limit) return false;
      bucket.count += 1;
      return true;
    },
    reset() {
      buckets.clear();
    },
  };
}
