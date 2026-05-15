import { config } from "../config.js";
import { AnthropicProvider } from "./anthropicProvider.js";
import { MockProvider } from "./mockProvider.js";
import { OpenAIProvider } from "./openaiProvider.js";

export function createProviders() {
  return [
    new MockProvider({
      enabled: config.providers.mock.enabled,
      timeoutMs: config.requestTimeoutMs
    }),
    new OpenAIProvider({
      apiKey: config.providers.openai.apiKey,
      baseUrl: config.providers.openai.baseUrl,
      timeoutMs: config.requestTimeoutMs
    }),
    new AnthropicProvider({
      apiKey: config.providers.anthropic.apiKey,
      baseUrl: config.providers.anthropic.baseUrl,
      timeoutMs: config.requestTimeoutMs
    })
  ];
}
