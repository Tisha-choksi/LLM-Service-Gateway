# LLM Service Gateway

Production-grade backend gateway that exposes one OpenAI-compatible API surface for multiple LLM providers. It centralizes provider integrations, routing, failover, caching, rate limiting, usage tracking, and observability.

## Features

- Unified `POST /v1/chat/completions` endpoint
- Provider abstraction for OpenAI, Anthropic, and a local mock provider
- Intelligent routing by cost, latency, or balanced scoring
- Failover with provider health scoring and circuit-breaker behavior
- Response caching for deterministic requests
- Per-key/IP rate limiting
- Usage accounting by provider, model, route, and API key
- Health and metrics endpoints
- No runtime npm dependencies

## Quick Start

```bash
cp .env.example .env
npm start
```

Test the gateway:

```bash
curl -X POST http://localhost:8080/v1/chat/completions ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: dev-key" ^
  -d "{\"model\":\"mock-fast\",\"messages\":[{\"role\":\"user\",\"content\":\"hello\"}]}"
```

Run tests:

```bash
npm test
```

## API

### `POST /v1/chat/completions`

Accepts an OpenAI-style request:

```json
{
  "model": "mock-fast",
  "messages": [{ "role": "user", "content": "Explain API gateways." }],
  "temperature": 0.2,
  "max_tokens": 300,
  "provider": "mock"
}
```

The optional `provider` field forces a specific provider when available. Without it, the router selects a healthy provider according to `ROUTING_STRATEGY`.

### `GET /health`

Returns service and provider health.

### `GET /metrics`

Returns JSON metrics for requests, cache, provider latency, failures, and usage.

### `GET /usage`

Returns usage totals grouped by API key, provider, and model.

## Provider Setup

Set provider API keys in `.env`:

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

The mock provider is enabled by default so the project runs immediately.

## Architecture

```text
src/server.js
  -> middleware/auth.js
  -> middleware/rateLimiter.js
  -> services/gateway.js
      -> services/router.js
      -> services/cache.js
      -> services/usageStore.js
      -> providers/*
      -> observability/metrics.js
```

The gateway normalizes incoming requests, chooses candidate providers, performs cache lookup, executes failover, records usage, and emits metrics.

## Production Notes

For production deployment, replace in-memory stores with Redis or a database:

- `TTLCache` -> Redis
- `RateLimiter` -> Redis token bucket
- `UsageStore` -> PostgreSQL, ClickHouse, or warehouse sink
- `MetricsRegistry` -> Prometheus/OpenTelemetry exporter

The interfaces are intentionally small so those swaps are mechanical.
