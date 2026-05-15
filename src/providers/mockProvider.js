import { BaseProvider } from "./baseProvider.js";
import { estimateTokens } from "./tokenEstimator.js";

export class MockProvider extends BaseProvider {
  constructor({ enabled = true, timeoutMs }) {
    super({
      id: "mock",
      displayName: "Local Mock Provider",
      models: ["mock-fast", "mock-smart", "*"],
      costScore: 0.1,
      timeoutMs
    });
    this._enabled = enabled;
  }

  get enabled() {
    return this._enabled;
  }

  async chatCompletion(request) {
    const prompt = request.messages?.map((message) => message.content).join(" ") || "";
    const content = `Mock response from gateway for: ${prompt.slice(0, 180)}`;
    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(content);

    return {
      id: `chatcmpl_mock_${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: request.model || "mock-fast",
      provider: this.id,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens
      }
    };
  }
}
