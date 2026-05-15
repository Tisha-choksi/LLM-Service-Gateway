import { HttpError } from "../http/errors.js";

export class ProviderRouter {
  constructor({ providers, strategy = "balanced" }) {
    this.providers = providers;
    this.strategy = strategy;
  }

  candidatesFor(request) {
    const candidates = this.providers.filter((provider) => {
      if (!provider.enabled) return false;
      if (!provider.isHealthy()) return false;
      if (request.provider && provider.id !== request.provider) return false;
      return provider.supports(request.model);
    });

    if (!candidates.length) {
      throw new HttpError(503, "No healthy provider is available for this request");
    }

    return candidates.sort((left, right) => this.score(left) - this.score(right));
  }

  score(provider) {
    const latencyScore = provider.lastLatencyMs ? provider.lastLatencyMs / 1000 : 1;

    if (this.strategy === "cost") return provider.costScore;
    if (this.strategy === "latency") return latencyScore;

    return provider.costScore * 0.6 + latencyScore * 0.4 + provider.failures;
  }

  health() {
    return this.providers.map((provider) => provider.health());
  }
}
