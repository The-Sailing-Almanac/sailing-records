import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../index";

vi.mock("resend", () => ({
  Resend: function () {
    return {
      emails: {
        send: vi.fn().mockResolvedValue({ data: { id: "test-email" } }),
      },
    };
  },
}));

vi.mock("meilisearch", () => ({
  MeiliSearch: function () {
    return {
      getIndex: vi.fn().mockResolvedValue({
        getStats: vi.fn().mockResolvedValue({ numberOfDocuments: 10 }),
        updateFilterableAttributes: vi.fn().mockResolvedValue(true),
        updateSearchableAttributes: vi.fn().mockResolvedValue(true),
        updateSortableAttributes: vi.fn().mockResolvedValue(true),
      }),
      waitForTask: vi.fn().mockResolvedValue(true),
      createIndex: vi.fn().mockResolvedValue({ taskUid: 1 }),
    };
  },
}));

// Mock database query responses for newsletters
vi.mock("../lib/db", () => {
  const queryMock = vi.fn().mockImplementation((text, params) => {
    if (text.includes("FROM newsletters") && text.includes("created_at::date = $1::date")) {
      const dateVal = params[0];
      if (dateVal === "2026-05-28") {
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: 1,
              title: "Sailing Almanac Daily Digest: 2026-05-28",
              content_md: "Test content",
              status: "published",
              created_at: new Date("2026-05-28T12:00:00Z"),
            },
          ],
        });
      }
      return Promise.resolve({ rowCount: 0, rows: [] });
    }
    if (text.includes("FROM newsletters") && text.includes("LIMIT 100")) {
      return Promise.resolve({
        rowCount: 2,
        rows: [
          {
            id: 1,
            title: "Sailing Almanac Daily Digest: 2026-05-28",
            status: "published",
            created_at: new Date("2026-05-28T12:00:00Z"),
          },
          {
            id: 2,
            title: "Sailing Almanac Daily Digest: 2026-05-27",
            status: "published",
            created_at: new Date("2026-05-27T12:00:00Z"),
          },
        ],
      });
    }
    if (text.includes("FROM newsletters") && (text.includes("LIMIT 20") || text.includes("LIMIT $"))) {
      return Promise.resolve({
        rowCount: 2,
        rows: [
          {
            id: 1,
            title: "Sailing Almanac Daily Digest: 2026-05-28",
            status: "published",
            created_at: new Date("2026-05-28T12:00:00Z"),
          },
          {
            id: 2,
            title: "Sailing Almanac Daily Digest: 2026-05-27",
            status: "published",
            created_at: new Date("2026-05-27T12:00:00Z"),
          },
        ],
      });
    }
    if (text.includes("FROM newsletters") && text.includes("LIMIT 1")) {
      return Promise.resolve({
        rowCount: 1,
        rows: [
          {
            id: 1,
            title: "Sailing Almanac Daily Digest: 2026-05-28",
            content_md: "Test content",
            status: "published",
            created_at: new Date("2026-05-28T12:00:00Z"),
          },
        ],
      });
    }
    return Promise.resolve({ rowCount: 0, rows: [] });
  });

  return {
    query: queryMock,
    dbPool: { query: queryMock },
  };
});

describe("Newsletter Endpoints", () => {
  it("GET /api/newsletter/latest should return 200 and the latest newsletter", async () => {
    const res = await request(app).get("/api/v1/newsletters/latest");
    expect(res.status).toBe(200);
    expect(res.body.newsletter.title).toBe("Sailing Almanac Daily Digest: 2026-05-28");
  });

  it("GET /api/newsletter/archive should return 200 and a list of archived newsletters", async () => {
    const res = await request(app).get("/api/v1/newsletters/archive");
    expect(res.status).toBe(200);
    expect(res.body.newsletters).toHaveLength(2);
    expect(res.body.newsletters[0].title).toBe("Sailing Almanac Daily Digest: 2026-05-28");
  });

  it("GET /api/newsletter/feed.rss should return 200 and valid RSS XML", async () => {
    const res = await request(app).get("/api/v1/newsletters/feed.rss");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/rss+xml");
    expect(res.text).toContain("<title>Sailing Almanac Daily Digest Feed</title>");
  });

  it("GET /api/newsletter/:date should return 200 and newsletter for valid date", async () => {
    const res = await request(app).get("/api/v1/newsletters/2026-05-28");
    expect(res.status).toBe(200);
    expect(res.body.newsletter.title).toBe("Sailing Almanac Daily Digest: 2026-05-28");
  });

  it("GET /api/newsletter/:date should return 404 for missing date", async () => {
    const res = await request(app).get("/api/v1/newsletters/2026-05-01");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
