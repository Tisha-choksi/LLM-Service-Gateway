export class MetricsRegistry {
  constructor() {
    this.counters = new Map();
    this.latencies = new Map();
  }

  increment(name, labels = {}, value = 1) {
    const key = metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  observeLatency(name, labels, durationMs) {
    const key = metricKey(name, labels);
    const bucket = this.latencies.get(key) || {
      count: 0,
      totalMs: 0,
      minMs: Number.POSITIVE_INFINITY,
      maxMs: 0
    };

    bucket.count += 1;
    bucket.totalMs += durationMs;
    bucket.minMs = Math.min(bucket.minMs, durationMs);
    bucket.maxMs = Math.max(bucket.maxMs, durationMs);
    this.latencies.set(key, bucket);
  }

  snapshot() {
    return {
      counters: Object.fromEntries(this.counters),
      latencies: Object.fromEntries(
        [...this.latencies.entries()].map(([key, value]) => [
          key,
          {
            ...value,
            avgMs: value.count ? Math.round(value.totalMs / value.count) : 0
          }
        ])
      )
    };
  }
}

function metricKey(name, labels) {
  const labelText = Object.keys(labels)
    .sort()
    .map((key) => `${key}=${labels[key]}`)
    .join(",");
  return labelText ? `${name}{${labelText}}` : name;
}
