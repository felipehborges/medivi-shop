export type RateLimitResult = {
  success: boolean;
  /** Requests remaining in the current window if `success`, else 0. */
  remaining: number;
};

export interface RateLimiter {
  /** Checks and consumes one request for `key` against this limiter's configured window/max. */
  limit(key: string): Promise<RateLimitResult>;
}
