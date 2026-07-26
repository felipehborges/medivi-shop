import "server-only";
import { MemoryRateLimiter, UpstashRateLimiter, type RateLimiter } from "@medivi/ratelimit";
import { env } from "./env";

const limiters = new Map<string, RateLimiter>();

/** Cached per (name, max, windowSeconds) so repeated calls share state instead of resetting it. */
function getRateLimiter(name: string, max: number, windowSeconds: number): RateLimiter {
  const cacheKey = `${name}:${max}:${windowSeconds}`;
  const cached = limiters.get(cacheKey);
  if (cached) return cached;

  const limiter =
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? new UpstashRateLimiter({
          url: env.UPSTASH_REDIS_REST_URL,
          token: env.UPSTASH_REDIS_REST_TOKEN,
          prefix: name,
          max,
          windowSeconds,
        })
      : new MemoryRateLimiter(max, windowSeconds * 1000);

  limiters.set(cacheKey, limiter);
  return limiter;
}

/** 10 checkout attempts per minute per identifier (session/IP) — generous for a real shopper, tight against abuse. */
export function getCheckoutRateLimiter(): RateLimiter {
  return getRateLimiter("checkout", 10, 60);
}

/** 100 webhook deliveries per minute per provider — Stripe retries aggressively, so this is a ceiling against abuse, not normal traffic. */
export function getWebhookRateLimiter(): RateLimiter {
  return getRateLimiter("webhook", 100, 60);
}
