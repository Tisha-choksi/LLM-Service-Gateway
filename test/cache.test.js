import assert from "node:assert/strict";
import test from "node:test";
import { TTLCache, cacheKeyForChat } from "../src/services/cache.js";

test("TTLCache returns values before expiry", () => {
  let now = 1000;
  const cache = new TTLCache({ ttlSeconds: 10, now: () => now });
  cache.set("key", { ok: true });

  now += 9000;
  assert.deepEqual(cache.get("key"), { ok: true });
});

test("TTLCache evicts values after expiry", () => {
  let now = 1000;
  const cache = new TTLCache({ ttlSeconds: 1, now: () => now });
  cache.set("key", "value");

  now += 1001;
  assert.equal(cache.get("key"), undefined);
});

test("cache key is stable for identical chat requests", () => {
  const request = {
    model: "mock-fast",
    messages: [{ role: "user", content: "hello" }],
    temperature: 0
  };

  assert.equal(cacheKeyForChat(request), cacheKeyForChat({ ...request }));
});
