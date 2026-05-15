import assert from "node:assert/strict";
import test from "node:test";
import { RateLimiter } from "../src/middleware/rateLimiter.js";

test("RateLimiter blocks requests over the configured minute limit", () => {
  const limiter = new RateLimiter({ limitPerMinute: 2, now: () => 1000 });

  assert.equal(limiter.check("a").allowed, true);
  assert.equal(limiter.check("a").allowed, true);
  assert.equal(limiter.check("a").allowed, false);
});

test("RateLimiter resets after the window expires", () => {
  let now = 1000;
  const limiter = new RateLimiter({ limitPerMinute: 1, now: () => now });

  assert.equal(limiter.check("a").allowed, true);
  assert.equal(limiter.check("a").allowed, false);

  now += 60_000;
  assert.equal(limiter.check("a").allowed, true);
});
