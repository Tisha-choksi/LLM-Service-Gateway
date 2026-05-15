import { BaseProvider } from "./baseProvider.js";

export class AnthropicProvider extends BaseProvider {
  constructor({ apiKey, baseUrl, timeoutMs }) {
    super({
      id: "anthropic",
      displayName: "Anthropic",
      models: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-3-7-sonnet-latest"],
      costScore: 0.8,
      timeoutMs
    });
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  get enabled() {
    return Boolean(this.apiKey);
  }

  async chatCompletion(request) {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify(toAnthropicRequest(request)),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`Anthropic provider failed with HTTP ${response.status}`);
    }

    return toOpenAIResponse(await response.json(), request.model, this.id);
  }
}

function toAnthropicRequest(request) {
  const system = request.messages?.find((message) => message.role === "system")?.content;
  const messages = (request.messages || [])
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content
    }));

  return {
    model: request.model,
    max_tokens: request.max_tokens || 1024,
    temperature: request.temperature,
    system,
    messages
  };
}

function toOpenAIResponse(body, model, provider) {
  const content = body.content?.map((part) => part.text || "").join("") || "";
  const inputTokens = body.usage?.input_tokens || 0;
  const outputTokens = body.usage?.output_tokens || 0;

  return {
    id: body.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    provider,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: body.stop_reason || "stop"
      }
    ],
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens
    }
  };
}
