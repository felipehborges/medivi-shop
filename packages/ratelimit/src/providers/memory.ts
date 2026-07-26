import type { RateLimiter, RateLimitResult } from "../types";

type Bucket = { count: number; resetAt: number };

/**
 * Fixed-window limiter backed by an in-process Map — the fallback when
 * Upstash isn't configured (local dev/CI/single-instance deploys). State is
 * per-process and unbounded for the process lifetime; fine at this scale,
 * would need real shared storage (Upstash) the moment there's more than one
 * app instance.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  async limit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { success: true, remaining: this.max - 1 };
    }

    if (bucket.count >= this.max) {
      return { success: false, remaining: 0 };
    }

    bucket.count += 1;
    return { success: true, remaining: this.max - bucket.count };
  }
}
