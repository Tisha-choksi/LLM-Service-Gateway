import { HttpError } from "../http/errors.js";
import { cacheKeyForChat } from "./cache.js";

export class LlmGateway {
  constructor({ router, cache, usageStore, metrics }) {
    this.router = router;
    this.cache = cache;
    this.usageStore = usageStore;
    this.metrics = metrics;
  }

  async chatCompletion(request, context) {
    validateChatRequest(request);
    this.metrics.increment("gateway_requests_total", { route: "chat_completions" });

    const cacheable = request.cache !== false && !request.stream;
    const cacheKey = cacheable ? cacheKeyForChat(request, context.apiKey) : "";

    if (cacheable) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.metrics.increment("gateway_cache_hits_total");
        this.usageStore.record({
          apiKey: context.apiKey,
          provider: cached.provider,
          model: cached.model || request.model,
          usage: normalizeUsage(cached.usage)
        });
        return {
          ...cached,
          cached: true
        };
      }
      this.metrics.increment("gateway_cache_misses_total");
    }

    const providers = this.router.candidatesFor(request);
    const errors = [];

    for (const provider of providers) {
      const started = Date.now();
      try {
        const response = await provider.chatCompletion(request);
        const durationMs = Date.now() - started;
        provider.markSuccess(durationMs);
        this.metrics.observeLatency("provider_latency_ms", { provider: provider.id }, durationMs);
        this.metrics.increment("provider_requests_total", { provider: provider.id, status: "success" });

        this.usageStore.record({
          apiKey: context.apiKey,
          provider: provider.id,
          model: response.model || request.model,
          usage: normalizeUsage(response.usage)
        });

        if (cacheable) this.cache.set(cacheKey, response);
        return response;
      } catch (error) {
        provider.markFailure();
        errors.push({ provider: provider.id, message: error.message });
        this.metrics.increment("provider_requests_total", { provider: provider.id, status: "failure" });
      }
    }

    throw new HttpError(502, "All provider attempts failed", { errors });
  }
}

function validateChatRequest(request) {
  if (!request || typeof request !== "object") {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  if (!request.model || typeof request.model !== "string") {
    throw new HttpError(400, "Field 'model' is required");
  }
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    throw new HttpError(400, "Field 'messages' must be a non-empty array");
  }
}

function normalizeUsage(usage = {}) {
  return {
    inputTokens: usage.prompt_tokens || usage.input_tokens || 0,
    outputTokens: usage.completion_tokens || usage.output_tokens || 0,
    totalTokens: usage.total_tokens || 0
  };
}
