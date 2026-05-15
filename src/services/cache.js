import { createHash } from "node:crypto";

export class TTLCache {
  constructor({ ttlSeconds, now = () => Date.now() }) {
    this.ttlMs = ttlSeconds * 1000;
    this.now = now;
    this.items = new Map();
  }

  get(key) {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (this.now() >= item.expiresAt) {
      this.items.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key, value) {
    this.items.set(key, {
      value,
      expiresAt: this.now() + this.ttlMs
    });
  }

  size() {
    return this.items.size;
  }
}

export function cacheKeyForChat(request) {
  const stable = {
    model: request.model,
    messages: request.messages,
    temperature: request.temperature ?? 1,
    max_tokens: request.max_tokens ?? null,
    response_format: request.response_format ?? null,
    tools: request.tools ?? null,
    provider: request.provider ?? null
  };

  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}
