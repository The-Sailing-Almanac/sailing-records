import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../index";

vi.mock("resend", () => ({
  Resend: function () {
    return {
      emails: {
        send: vi.fn().mockResolvedValue({ data: { id: "test-email-id" } }),
      },
    };
  },
}));

vi.mock("meilisearch", () => ({
  MeiliSearch: function () {
    return {
      getIndex: vi.fn().mockResolvedValue({
        getStats: vi.fn().mockResolvedValue({ numberOfDocuments: 95 }),
        updateFilterableAttributes: vi.fn().mockResolvedValue(true),
        updateSearchableAttributes: vi.fn().mockResolvedValue(true),
        updateSortableAttributes: vi.fn().mockResolvedValue(true),
      }),
      waitForTask: vi.fn().mockResolvedValue(true),
      createIndex: vi.fn().mockResolvedValue({ taskUid: 1 }),
    };
  },
}));

vi.mock("../lib/redirect", () => ({
  resolveRedirectHash: vi.fn((hash) => {
    if (hash === "validhash") {
      return Promise.resolve({
        articleLinkId: "123e4567-e89b-12d3-a456-426614174000",
        canonicalUrl: "https://example.com/sailing-news",
      });
    }
    return Promise.resolve(null);
  }),
  logRedirectClick: vi.fn(),
  ensureRedirectLink: vi.fn(),
}));

vi.mock("../lib/db", () => ({
  query: vi.fn(),
  dbPool: { query: vi.fn() },
}));

describe("GET /sendit/:hash", () => {
  it("should redirect 302 to the canonical URL for a valid hash", async () => {
    const res = await request(app).get("/sendit/validhash");
    expect(res.status).toBe(302);
    expect(res.header.location).toBe("https://example.com/sailing-news");
  });

  it("should return 404 for an invalid hash", async () => {
    const res = await request(app).get("/sendit/invalidhash");
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Link not found");
  });

  it("should return 429 when rate limited (called 21 times)", async () => {
    let limitReached = false;
    for (let i = 0; i < 25; i++) {
      const res = await request(app).get("/sendit/validhash");
      if (res.status === 429) {
        limitReached = true;
        expect(res.body.error.code).toBe("TOO_MANY_REQUESTS");
      }
    }
    expect(limitReached).toBe(true);
  });
});
