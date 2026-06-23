import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createApp } from "../src/app.js";
import { HttpError } from "../src/http/errors.js";
import { RateLimiter } from "../src/middleware/rateLimiter.js";
import { UsageStore } from "../src/services/usageStore.js";
import { MetricsRegistry } from "../src/observability/metrics.js";

const chatPayload = { model: "mock-fast", messages: [{ role: "user", content: "hi" }] };

function defaultGateway() {
  return {
    async chatCompletion(body) {
      return {
        id: "chatcmpl_test",
        object: "chat.completion",
        model: body.model,
        provider: "mock",
        choices: [{ index: 0, message: { role: "assistant", content: "hi" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      };
    }
  };
}

async function withServer(overrides, fn) {
  const config = { env: "test", gatewayApiKeys: ["dev-key"], ...overrides.config };
  const app = createApp({
    config,
    gateway: overrides.gateway || defaultGateway(),
    rateLimiter: overrides.rateLimiter || new RateLimiter({ limitPerMinute: 60 }),
    usageStore: overrides.usageStore || new UsageStore(),
    router: overrides.router || { health: () => [{ id: "mock", healthy: true }] },
    metrics: overrides.metrics || new MetricsRegistry()
  });

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET /health responds without authentication", async () => {
  await withServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
  });
});

test("GET /metrics requires a valid gateway API key", async () => {
  await withServer({}, async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/metrics`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${baseUrl}/metrics`, { headers: { "x-api-key": "dev-key" } });
    assert.equal(authorized.status, 200);
  });
});

test("GET /usage requires auth and never echoes the caller's API key back", async () => {
  await withServer({}, async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/usage`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${baseUrl}/usage`, { headers: { "x-api-key": "dev-key" } });
    assert.equal(authorized.status, 200);
    assert.equal(authorized.headers.get("x-gateway-api-key"), null);
  });
});

test("POST /v1/chat/completions authenticates, rate-limits, and proxies to the gateway", async () => {
  await withServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "dev-key" },
      body: JSON.stringify(chatPayload)
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-ratelimit-limit"), "60");
    const body = await res.json();
    assert.equal(body.provider, "mock");
  });
});

test("POST /v1/chat/completions rejects missing or invalid API keys", async () => {
  await withServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "wrong-key" },
      body: JSON.stringify(chatPayload)
    });
    assert.equal(res.status, 401);
  });
});

test("POST /v1/chat/completions returns 429 once the per-key rate limit is exceeded", async () => {
  const rateLimiter = new RateLimiter({ limitPerMinute: 1, now: () => 1000 });
  await withServer({ rateLimiter }, async (baseUrl) => {
    const request = () =>
      fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": "dev-key" },
        body: JSON.stringify(chatPayload)
      });

    assert.equal((await request()).status, 200);
    assert.equal((await request()).status, 429);
  });
});

test("Gateway errors are translated into the corresponding HTTP status", async () => {
  const gateway = {
    async chatCompletion() {
      throw new HttpError(502, "All provider attempts failed", { errors: [{ provider: "mock", message: "boom" }] });
    }
  };
  await withServer({ gateway }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "dev-key" },
      body: JSON.stringify(chatPayload)
    });
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.error.message, "All provider attempts failed");
  });
});

test("Unknown routes return 404", async () => {
  await withServer({}, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/not-a-route`);
    assert.equal(res.status, 404);
  });
});
