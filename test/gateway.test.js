import assert from "node:assert/strict";
import test from "node:test";
import { LlmGateway } from "../src/services/gateway.js";
import { TTLCache } from "../src/services/cache.js";
import { UsageStore } from "../src/services/usageStore.js";
import { MetricsRegistry } from "../src/observability/metrics.js";

function fakeProvider(id, chatCompletion) {
  return { id, chatCompletion, markSuccess() {}, markFailure() {} };
}

function fakeRouter(providers) {
  return { candidatesFor: () => providers };
}

function newGateway({ providers = [] } = {}) {
  return new LlmGateway({
    router: fakeRouter(providers),
    cache: new TTLCache({ ttlSeconds: 60 }),
    usageStore: new UsageStore(),
    metrics: new MetricsRegistry()
  });
}

const chatRequest = { model: "mock-fast", messages: [{ role: "user", content: "hi" }] };

test("LlmGateway scopes cached responses by API key", async () => {
  let calls = 0;
  const provider = fakeProvider("mock", async (request) => {
    calls += 1;
    return {
      id: `resp-${calls}`,
      model: request.model,
      provider: "mock",
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
    };
  });
  const gateway = newGateway({ providers: [provider] });

  const first = await gateway.chatCompletion(chatRequest, { apiKey: "alice" });
  const second = await gateway.chatCompletion(chatRequest, { apiKey: "alice" });
  assert.equal(second.id, first.id, "same caller should be served the cached response");
  assert.equal(calls, 1);

  const third = await gateway.chatCompletion(chatRequest, { apiKey: "bob" });
  assert.notEqual(third.id, first.id, "a different caller must not receive alice's cached response");
  assert.equal(calls, 2);
});

test("LlmGateway records usage for cache hits, not just live provider calls", async () => {
  const provider = fakeProvider("mock", async (request) => ({
    id: "resp-1",
    model: request.model,
    provider: "mock",
    usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 }
  }));
  const usageStore = new UsageStore();
  const gateway = new LlmGateway({
    router: fakeRouter([provider]),
    cache: new TTLCache({ ttlSeconds: 60 }),
    usageStore,
    metrics: new MetricsRegistry()
  });

  await gateway.chatCompletion(chatRequest, { apiKey: "alice" });
  await gateway.chatCompletion(chatRequest, { apiKey: "alice" });

  const snapshot = usageStore.snapshot();
  assert.equal(snapshot.recent.length, 2, "both the live call and the cache hit should be recorded");

  const total = snapshot.totals.find((entry) => entry.apiKey === "alice");
  assert.equal(total.requests, 2);
  assert.equal(total.totalTokens, 16);
});

test("LlmGateway rejects streaming requests", async () => {
  const gateway = newGateway();

  await assert.rejects(
    () => gateway.chatCompletion({ ...chatRequest, stream: true }, { apiKey: "alice" }),
    (error) => {
      assert.equal(error.statusCode, 501);
      return true;
    }
  );
});

test("LlmGateway fails over to the next healthy provider when one errors", async () => {
  const failing = fakeProvider("flaky", async () => {
    throw new Error("boom");
  });
  const healthy = fakeProvider("backup", async (request) => ({
    id: "resp-ok",
    model: request.model,
    provider: "backup",
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
  }));
  const gateway = newGateway({ providers: [failing, healthy] });

  const response = await gateway.chatCompletion(chatRequest, { apiKey: "alice" });
  assert.equal(response.provider, "backup");
});

test("LlmGateway surfaces a 502 when every provider attempt fails", async () => {
  const failing = fakeProvider("flaky", async () => {
    throw new Error("boom");
  });
  const gateway = newGateway({ providers: [failing] });

  await assert.rejects(
    () => gateway.chatCompletion(chatRequest, { apiKey: "alice" }),
    (error) => {
      assert.equal(error.statusCode, 502);
      return true;
    }
  );
});

test("LlmGateway validates the request body before routing", async () => {
  const gateway = newGateway();

  await assert.rejects(() => gateway.chatCompletion({}, { apiKey: "alice" }), /Field 'model' is required/);
  await assert.rejects(
    () => gateway.chatCompletion({ model: "mock-fast" }, { apiKey: "alice" }),
    /Field 'messages' must be a non-empty array/
  );
});
