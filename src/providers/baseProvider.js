export class BaseProvider {
  constructor({ id, displayName, models, costScore = 1, timeoutMs = 30000 }) {
    this.id = id;
    this.displayName = displayName;
    this.models = models;
    this.costScore = costScore;
    this.timeoutMs = timeoutMs;
    this.failures = 0;
    this.circuitOpenedAt = 0;
    this.lastLatencyMs = 0;
  }

  get enabled() {
    return true;
  }

  supports(model) {
    return this.models.includes(model) || this.models.includes("*");
  }

  isHealthy(now = Date.now()) {
    if (this.failures < 3) return true;
    return now - this.circuitOpenedAt > 30_000;
  }

  markSuccess(latencyMs) {
    this.failures = 0;
    this.circuitOpenedAt = 0;
    this.lastLatencyMs = latencyMs;
  }

  markFailure() {
    this.failures += 1;
    if (this.failures >= 3) this.circuitOpenedAt = Date.now();
  }

  health() {
    return {
      id: this.id,
      displayName: this.displayName,
      enabled: this.enabled,
      healthy: this.isHealthy(),
      failures: this.failures,
      lastLatencyMs: this.lastLatencyMs,
      models: this.models
    };
  }
}
