import { describe, it, expect, vi } from "vitest";
import { RobotsChecker } from "../lib/robots.js";

const ALLOW_ALL = "User-agent: *\nAllow: /";
const DISALLOW_NEWS = "User-agent: *\nDisallow: /news/";
const BLOCK_CRAWLER = "User-agent: SailingAlmanac-Crawler\nDisallow: /";

describe("RobotsChecker", () => {
  it("allows all paths when robots.txt permits everything", async () => {
    const checker = new RobotsChecker();
    vi.spyOn(checker as any, "fetchRobotsTxt").mockResolvedValue(ALLOW_ALL);
    expect(await checker.isAllowed("example.com", "/articles/test")).toBe(true);
  });

  it("blocks disallowed paths", async () => {
    const checker = new RobotsChecker();
    vi.spyOn(checker as any, "fetchRobotsTxt").mockResolvedValue(DISALLOW_NEWS);
    expect(await checker.isAllowed("example.com", "/news/article")).toBe(false);
    expect(await checker.isAllowed("example.com", "/about")).toBe(true);
  });

  it("blocks paths disallowed specifically for our crawler", async () => {
    const checker = new RobotsChecker();
    vi.spyOn(checker as any, "fetchRobotsTxt").mockResolvedValue(BLOCK_CRAWLER);
    expect(await checker.isAllowed("example.com", "/any/path")).toBe(false);
  });

  it("allows all paths when robots.txt fetch fails", async () => {
    const checker = new RobotsChecker();
    vi.spyOn(checker as any, "fetchRobotsTxt").mockRejectedValue(new Error("404"));
    expect(await checker.isAllowed("example.com", "/articles/test")).toBe(true);
  });

  it("caches robots.txt per domain", async () => {
    const checker = new RobotsChecker();
    const spy = vi.spyOn(checker as any, "fetchRobotsTxt").mockResolvedValue(ALLOW_ALL);
    await checker.isAllowed("example.com", "/a");
    await checker.isAllowed("example.com", "/b");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
