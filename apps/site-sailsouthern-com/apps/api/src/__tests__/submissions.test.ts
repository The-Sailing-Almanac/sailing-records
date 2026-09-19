import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../index";

let lastQueryArgs: any[] = [];

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
  const queryMock = vi.fn().mockImplementation((text, params) => {
    if (params) lastQueryArgs = params;
    if (text.includes("INSERT INTO user_submissions")) {
      return Promise.resolve({ rows: [{ id: 42, created_at: "2026-05-28T20:00:00Z" }], rowCount: 1 });
    }
    if (text.includes("SELECT * FROM user_submissions")) {
      return Promise.resolve({ rows: [{ id: 42, submission_type: "story", submitter_email: "test@example.com", rights_grant: "cc_by_sa", is_approved: false }], rowCount: 1 });
    }
    if (text.includes("UPDATE user_submissions SET is_approved = TRUE")) {
      return Promise.resolve({ rows: [{ id: 42, is_approved: true }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });

  return {
    query: queryMock,
    dbPool: { query: queryMock },
  };
});

describe("POST /api/submissions", () => {
  beforeEach(() => {
    lastQueryArgs = [];
  });

  it("should return 201 and store submission for valid body", async () => {
    const res = await request(app)
      .post("/api/v1/submissions")
      .send({
        submission_type: "story",
        boat_id: 12,
        submitter_email: "test@example.com",
        content_payload: { title: "Cruising Galveston", body: "Smooth sailing under sunset." },
        rights_grant: "cc_by_sa",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(42);
    expect(res.body.message).toContain("Submission received");
  });

  it("should return 400 validation error for missing required fields", async () => {
    const res = await request(app)
      .post("/api/v1/submissions")
      .send({
        submission_type: "story",
        rights_grant: "cc_by_sa",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/admin/submissions", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = "supersecretadminkey";
  });

  it("should return 401 without admin key header", async () => {
    const res = await request(app).get("/api/v1/admin/submissions");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 200 with a valid admin key header", async () => {
    const res = await request(app)
      .get("/api/v1/admin/submissions")
      .set("x-admin-key", "supersecretadminkey");
    expect(res.status).toBe(200);
    expect(res.body.submissions).toBeInstanceOf(Array);
  });
});

describe("POST /api/admin/submissions/:id/approve", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = "supersecretadminkey";
  });

  it("should approve submission when called by admin", async () => {
    const res = await request(app)
      .post("/api/v1/admin/submissions/42/approve")
      .set("x-admin-key", "supersecretadminkey");
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("approved successfully");
  });
});
