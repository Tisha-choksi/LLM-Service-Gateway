export class RateLimiter {
  constructor({ limitPerMinute, now = () => Date.now() }) {
    this.limit = limitPerMinute;
    this.now = now;
    this.buckets = new Map();
  }

  check(key) {
    const now = this.now();
    const windowMs = 60_000;
    const bucket = this.buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now >= bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);

    return {
      allowed: bucket.count <= this.limit,
      limit: this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      resetAt: bucket.resetAt
    };
  }
}
