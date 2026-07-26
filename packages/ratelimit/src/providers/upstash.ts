import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import type { RateLimiter, RateLimitResult } from "../types";

export class UpstashRateLimiter implements RateLimiter {
  private readonly ratelimit: Ratelimit;

  constructor(input: { url: string; token: string; prefix: string; max: number; windowSeconds: number }) {
    this.ratelimit = new Ratelimit({
      redis: new Redis({ url: input.url, token: input.token }),
      limiter: Ratelimit.slidingWindow(input.max, `${input.windowSeconds} s`),
      prefix: input.prefix,
    });
  }

  async limit(key: string): Promise<RateLimitResult> {
    const result = await this.ratelimit.limit(key);
    return { success: result.success, remaining: result.remaining };
  }
}
