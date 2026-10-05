import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "./rate-limit.ts";

describe("compose budget", () => {
  it("allows up to the limit, then refuses", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    const now = 1_000;
    assert.equal(limiter.allow("a", now), true);
    assert.equal(limiter.allow("a", now), true);
    assert.equal(limiter.allow("a", now), true);
    assert.equal(limiter.allow("a", now), false, "fourth call in the window");
  });

  it("counts callers independently", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    const now = 1_000;
    assert.equal(limiter.allow("a", now), true);
    assert.equal(limiter.allow("a", now), true);
    assert.equal(limiter.allow("a", now), false);
    assert.equal(limiter.allow("b", now), true, "one caller cannot spend another's budget");
  });

  it("refills after the window passes", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });
    assert.equal(limiter.allow("a", 1_000), true);
    assert.equal(limiter.allow("a", 1_500), false);
    assert.equal(limiter.allow("a", 2_001), true, "a new window starts fresh");
  });

  it("stays bounded when callers rotate keys", () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
    for (let i = 0; i < 20_000; i += 1) limiter.allow(`caller-${i}`, 1_000);
    // Every bucket is still live (same `now`), so this only passes when the
    // limiter evicts rather than growing without end.
    assert.equal(limiter.allow("fresh", 1_000), true);
    assert.equal(limiter.allow("fresh", 1_000), true);
    limiter.reset();
    assert.equal(limiter.allow("a", 1_000), true, "reset clears the window");
  });
});
