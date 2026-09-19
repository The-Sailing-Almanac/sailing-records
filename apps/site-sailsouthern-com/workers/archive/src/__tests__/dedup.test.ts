import { describe, it, expect, vi } from "vitest";
import { normalizeUrl, generateUrlHash, isKnownUrl } from "../lib/dedup.js";

describe("normalizeUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeUrl("https://example.com/article/")).toBe("https://example.com/article");
  });
  it("strips utm parameters", () => {
    expect(normalizeUrl("https://example.com/a?utm_source=x&utm_medium=y")).toBe("https://example.com/a");
  });
  it("lowercases the host", () => {
    expect(normalizeUrl("https://Example.COM/path")).toBe("https://example.com/path");
  });
});

describe("generateUrlHash", () => {
  it("returns a 64-char hex string", () => {
    const hash = generateUrlHash("https://example.com/article");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("is deterministic", () => {
    const url = "https://example.com/article";
    expect(generateUrlHash(url)).toBe(generateUrlHash(url));
  });
});

describe("isKnownUrl", () => {
  it("returns true when url_hash exists in article_links", async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [{ exists: true }] });
    expect(await isKnownUrl("https://example.com/a", mockQuery)).toBe(true);
  });
  it("returns false when url_hash does not exist", async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [{ exists: false }] });
    expect(await isKnownUrl("https://example.com/b", mockQuery)).toBe(false);
  });
});
