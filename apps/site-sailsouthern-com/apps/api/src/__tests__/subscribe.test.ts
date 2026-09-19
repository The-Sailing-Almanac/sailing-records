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

vi.mock("../lib/db", () => {
  const queryMock = vi.fn().mockImplementation((text, params) => {
    if (text.includes("SELECT is_active FROM email_subscriptions")) {
      const email = params[0];
      if (email === "duplicate@example.com") {
        return Promise.resolve({ rows: [{ is_active: true }] });
      }
      return Promise.resolve({ rows: [] });
    }
    if (text.includes("UPDATE email_subscriptions")) {
      const token = params[0];
      if (token === "validtoken") {
        return Promise.resolve({ rows: [{ email: "user@example.com" }] });
      }
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [], rowCount: 1 });
  });

  return {
    query: queryMock,
    dbPool: { query: queryMock },
  };
});

describe("POST /api/subscribe", () => {
  it("should return 201 and queue email for a valid new email", async () => {
    const res = await request(app)
      .post("/api/v1/subscribe")
      .send({ email: "newuser@example.com", frequency: ["daily"] });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("confirmation_sent");
  });

  it("should return 409 for a duplicate active email", async () => {
    const res = await request(app)
      .post("/api/v1/subscribe")
      .send({ email: "duplicate@example.com", frequency: ["daily"] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
  });

  it("should return 400 for an invalid email format", async () => {
    const res = await request(app)
      .post("/api/v1/subscribe")
      .send({ email: "notanemail", frequency: ["daily"] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/subscribe/confirm/:token", () => {
  it("should redirect 302 to website for a valid token", async () => {
    const res = await request(app).get("/api/v1/subscribe/confirm/validtoken");
    expect(res.status).toBe(302);
    expect(res.header.location).toContain("subscribed=1");
  });

  it("should return 400 for an invalid or expired token", async () => {
    const res = await request(app).get("/api/v1/subscribe/confirm/expiredtoken");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });
});
