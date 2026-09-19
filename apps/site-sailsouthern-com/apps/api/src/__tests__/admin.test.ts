import { describe, it, expect, vi, beforeEach } from "vitest";
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

vi.mock("../lib/db", () => {
  const queryMock = vi.fn().mockImplementation((text: string, params?: any[]) => {
    if (text.includes("FROM article_links")) {
      if (text.includes("COUNT(*) FILTER")) {
        return Promise.resolve({
          rows: [
            {
              total: 100,
              suppressed: 5,
              relevance_high: 40,
              relevance_medium: 30,
              relevance_low: 20,
              relevance_very_low: 10,
              relevance_null: 0,
            },
          ],
        });
      }
      return Promise.resolve({
        rows: [
          { domain: "sail-world.com", count: 50 },
        ],
      });
    }
    if (text.includes("FROM feed_endpoints")) {
      return Promise.resolve({
        rows: [
          { total: 10, active: 8, dead: 2, unvalidated: 0 },
        ],
      });
    }
    if (text.includes("FROM boats")) {
      if (params && params[0] === 999) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({
        rows: [
          { id: 1, model_name: "J 24", builder_name: "Tillotson Pearson" }
        ]
      });
    }
    if (text.includes("FROM boat_sources")) {
      return Promise.resolve({
        rows: [
          { id: 10, boat_id: 1, source_type: "sailboatdata", source_url: "http://example.com" }
        ]
      });
    }
    if (text.includes("FROM boat_spec_consensus")) {
      return Promise.resolve({
        rows: [
          { id: 100, boat_id: 1, field_name: "loa_m", value_numeric: 7.32, confidence: 1.0 }
        ]
      });
    }
    return Promise.resolve({ rows: [] });
  });

  return {
    query: queryMock,
    dbPool: { query: queryMock },
  };
});

describe("GET /api/admin/stats", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = "supersecretadminkey";
  });

  it("should return 401 Unauthorized without admin key", async () => {
    const res = await request(app).get("/api/v1/admin/stats");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 200 and stats with valid admin key", async () => {
    const res = await request(app)
      .get("/api/v1/admin/stats")
      .set("x-admin-key", "supersecretadminkey");
    expect(res.status).toBe(200);
    expect(res.body.article_links.total).toBe(100);
    expect(res.body.article_links.meilisearch_indexed_estimate).toBe(95);
    expect(res.body.feed_endpoints.active).toBe(8);
  });
});

describe("GET /api/admin/boats/:id", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = "supersecretadminkey";
  });

  it("should return 401 Unauthorized without admin key", async () => {
    const res = await request(app).get("/api/v1/admin/boats/1");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 404 Not Found if boat is not found", async () => {
    const res = await request(app)
      .get("/api/v1/admin/boats/999")
      .set("x-admin-key", "supersecretadminkey");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 200 and boat data with valid admin key", async () => {
    const res = await request(app)
      .get("/api/v1/admin/boats/1")
      .set("x-admin-key", "supersecretadminkey");
    expect(res.status).toBe(200);
    expect(res.body.boat.model_name).toBe("J 24");
    expect(res.body.sources[0].source_type).toBe("sailboatdata");
    expect(res.body.consensus[0].field_name).toBe("loa_m");
  });
});
