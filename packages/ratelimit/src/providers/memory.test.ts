import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "./memory";

describe("MemoryRateLimiter", () => {
  it("allows up to max requests within the window, then rejects", async () => {
    const limiter = new MemoryRateLimiter(3, 60_000);

    expect((await limiter.limit("a")).success).toBe(true);
    expect((await limiter.limit("a")).success).toBe(true);
    const third = await limiter.limit("a");
    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = await limiter.limit("a");
    expect(fourth.success).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("tracks separate keys independently", async () => {
    const limiter = new MemoryRateLimiter(1, 60_000);

    expect((await limiter.limit("a")).success).toBe(true);
    expect((await limiter.limit("a")).success).toBe(false);
    expect((await limiter.limit("b")).success).toBe(true);
  });

  it("resets the count once the window has elapsed", async () => {
    const limiter = new MemoryRateLimiter(1, 10);

    expect((await limiter.limit("a")).success).toBe(true);
    expect((await limiter.limit("a")).success).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect((await limiter.limit("a")).success).toBe(true);
  });
});
