import { BaseProvider } from "./baseProvider.js";

export class OpenAIProvider extends BaseProvider {
  constructor({ apiKey, baseUrl, timeoutMs }) {
    super({
      id: "openai",
      displayName: "OpenAI",
      models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
      costScore: 0.6,
      timeoutMs
    });
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  get enabled() {
    return Boolean(this.apiKey);
  }

  async chatCompletion(request) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(stripGatewayFields(request)),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`OpenAI provider failed with HTTP ${response.status}`);
    }

    const body = await response.json();
    return { ...body, provider: this.id };
  }
}

function stripGatewayFields(request) {
  const { provider, cache, ...rest } = request;
  return rest;
}
