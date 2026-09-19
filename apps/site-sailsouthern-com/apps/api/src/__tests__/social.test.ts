import { describe, it, expect, vi, beforeEach } from "vitest";

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

import request from "supertest";
import { app } from "../index";

vi.mock("../lib/db", () => {
  const queryMock = vi.fn().mockImplementation((text: string, params?: any[]) => {
    if (text.includes("SELECT COUNT(*)::int AS count FROM social_posts")) {
      return Promise.resolve({ rows: [{ count: 12 }], rowCount: 1 });
    }
    if (text.includes("social_post_deliveries") && text.includes("COUNT(CASE WHEN")) {
      return Promise.resolve({ rows: [{ success: 10, failed: 2 }], rowCount: 1 });
    }
    if (text.includes("social_post_captures") && text.includes("COUNT(CASE WHEN")) {
      return Promise.resolve({ rows: [{ success: 8, failed: 1 }], rowCount: 1 });
    }
    if (text.includes("FROM social_posts")) {
      return Promise.resolve({
        rows: [
          {
            id: 1,
            content_text: "Test post for Mastodon",
            title: "Test Post",
            linked_entity_type: "newsletter",
            linked_entity_id: "10",
            metadata: {},
            provenance_rights: {},
            created_at: new Date("2026-05-28T20:00:00.000Z"),
          },
        ],
        rowCount: 1
      });
    }
    if (text.includes("FROM social_post_deliveries")) {
      return Promise.resolve({
        rows: [
          {
            id: 1,
            post_id: 1,
            account_id: 1,
            platform: "mastodon",
            external_id: "mock_id",
            external_url: "https://mastodon.mock/1",
            status: "success",
            error_message: null,
            delivered_at: new Date("2026-05-28T20:00:01.000Z"),
          },
        ],
        rowCount: 1
      });
    }
    if (text.includes("FROM social_post_media")) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    if (text.includes("FROM social_post_links")) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    if (text.includes("FROM social_post_captures")) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    if (text.includes("FROM social_publishing_runs")) {
      return Promise.resolve({
        rows: [
          {
            id: 1,
            job_name: "micro_edition_publish",
            run_status: "success",
            started_at: new Date("2026-05-28T20:00:00.000Z"),
            completed_at: new Date("2026-05-28T20:00:10.000Z"),
            duration_ms: 10000,
            summary_counts: { deliveries: 3, failures: 0 },
            error_message: null
          }
        ],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });

  return {
    query: queryMock,
    dbPool: { query: queryMock },
  };
});

describe("GET /api/v1/social/posts", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = "supersecretadminkey";
  });

  it("should return 401 Unauthorized without admin key", async () => {
    const res = await request(app).get("/api/v1/social/posts");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 200 and paginated posts with valid admin key", async () => {
    const res = await request(app)
      .get("/api/v1/social/posts")
      .set("x-admin-key", "supersecretadminkey");
    expect(res.status).toBe(200);
    expect(res.body.posts).toBeDefined();
    expect(res.body.posts.length).toBe(1);
    expect(res.body.posts[0].content_text).toBe("Test post for Mastodon");
    expect(res.body.posts[0].deliveries.length).toBe(1);
    expect(res.body.posts[0].deliveries[0].platform).toBe("mastodon");
  });
});

describe("GET /api/v1/social/posts/:id", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = "supersecretadminkey";
  });

  it("should return 401 Unauthorized without admin key", async () => {
    const res = await request(app).get("/api/v1/social/posts/1");
    expect(res.status).toBe(401);
  });

  it("should return 200 and detailed post with valid admin key", async () => {
    const res = await request(app)
      .get("/api/v1/social/posts/1")
      .set("x-admin-key", "supersecretadminkey");
    expect(res.status).toBe(200);
    expect(res.body.post).toBeDefined();
    expect(res.body.post.id).toBe(1);
    expect(res.body.deliveries).toBeDefined();
  });
});

describe("GET /api/v1/social/runs", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = "supersecretadminkey";
  });

  it("should return 401 Unauthorized without admin key", async () => {
    const res = await request(app).get("/api/v1/social/runs");
    expect(res.status).toBe(401);
  });

  it("should return 200 and run list with next schedule details with valid admin key", async () => {
    const res = await request(app)
      .get("/api/v1/social/runs")
      .set("x-admin-key", "supersecretadminkey");
    expect(res.status).toBe(200);
    expect(res.body.runs).toBeDefined();
    expect(res.body.runs.length).toBe(1);
    expect(res.body.runs[0].job_name).toBe("micro_edition_publish");
    expect(res.body.schedule).toBeDefined();
    expect(res.body.schedule.cron_pattern).toBeDefined();
    expect(res.body.schedule.next_run).toBeDefined();
  });
});

describe("GET /api/v1/social/reconciliation", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = "supersecretadminkey";
  });

  it("should return 401 Unauthorized without admin key", async () => {
    const res = await request(app).get("/api/v1/social/reconciliation");
    expect(res.status).toBe(401);
  });

  it("should return 200 and reconciled operational metrics with valid admin key", async () => {
    const res = await request(app)
      .get("/api/v1/social/reconciliation")
      .set("x-admin-key", "supersecretadminkey");
    expect(res.status).toBe(200);
    expect(res.body.internal_metrics).toBeDefined();
    expect(res.body.internal_metrics.total_posts).toBe(12);
    expect(res.body.internal_metrics.deliveries.total).toBe(12);
    expect(res.body.internal_metrics.deliveries.success_rate_pct).toBeCloseTo(83.33);
    expect(res.body.internal_metrics.captures.total).toBe(9);
    expect(res.body.internal_metrics.captures.success_rate_pct).toBeCloseTo(88.89);
    expect(res.body.ga4_metrics).toBeDefined();
  });
});

