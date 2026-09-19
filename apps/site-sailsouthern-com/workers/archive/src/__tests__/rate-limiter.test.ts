import { describe, it, expect, vi, beforeEach } from "vitest";
import { DomainRateLimiter } from "../lib/rate-limiter.js";

describe("DomainRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns immediately on first call for a domain", async () => {
    const limiter = new DomainRateLimiter();
    const start = Date.now();
    await limiter.wait("example.com", 1000);
    expect(Date.now() - start).toBeLessThan(100);
  });

  it("delays subsequent calls by at least rate_limit_ms", async () => {
    const limiter = new DomainRateLimiter();
    await limiter.wait("example.com", 1000);
    const waitPromise = limiter.wait("example.com", 1000);
    vi.advanceTimersByTime(1200);
    await waitPromise;
  });

  it("tracks different domains independently", async () => {
    const limiter = new DomainRateLimiter();
    await limiter.wait("site-a.com", 1000);
    await limiter.wait("site-b.com", 1000);
  });
});
