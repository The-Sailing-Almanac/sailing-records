export class DomainRateLimiter {
  private lastCallAt = new Map<string, number>();

  async wait(domain: string, rateLimitMs: number): Promise<void> {
    const last = this.lastCallAt.get(domain);
    const now = Date.now();

    if (last !== undefined) {
      const jitter = rateLimitMs * 0.2 * (Math.random() * 2 - 1); // ±20%
      const delay = rateLimitMs + jitter - (now - last);
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.lastCallAt.set(domain, Date.now());
  }
}
