export class UsageStore {
  constructor() {
    this.rows = [];
    this.totals = new Map();
  }

  record(event) {
    const enriched = {
      timestamp: new Date().toISOString(),
      ...event
    };
    this.rows.push(enriched);

    const key = [event.apiKey, event.provider, event.model].join(":");
    const current = this.totals.get(key) || {
      apiKey: event.apiKey,
      provider: event.provider,
      model: event.model,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    };

    current.requests += 1;
    current.inputTokens += event.usage?.inputTokens || 0;
    current.outputTokens += event.usage?.outputTokens || 0;
    current.totalTokens += event.usage?.totalTokens || 0;
    this.totals.set(key, current);
  }

  snapshot() {
    return {
      totals: [...this.totals.values()],
      recent: this.rows.slice(-50)
    };
  }
}
