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
    if (text.includes("FROM entities e") && !text.includes("e.slug = $1")) {
      if (text.includes("COUNT(*)::int")) {
        return Promise.resolve({ rows: [{ count: 1 }] });
      }
      return Promise.resolve({
        rows: [
          {
            id: 1,
            slug: "laser",
            canonical_name: "Laser",
            aliases: ["Laser Class"],
            description: "Laser boat class",
            dominant_color: "#ff0000",
            is_verified: true,
            metadata: {},
            entity_type: "boat_class",
            entity_type_label: "Boat Class",
            mention_count: 5,
          },
        ],
      });
    }
    if (text.includes("FROM entities e JOIN entity_types et")) {
      const slug = params[0];
      if (slug === "validslug") {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              slug: "validslug",
              canonical_name: "Valid Entity",
              description: "A valid entity",
              entity_type: "boat_class",
              entity_type_label: "Boat Class",
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    }
    if (text.includes("FROM entity_mentions em")) {
      return Promise.resolve({
        rows: [
          {
            id: "article-123",
            title: "Laser Sailing news",
            redirect_hash: "laserhash",
            canonical_url: "https://example.com/laser",
            publisher_name: "Laser World",
            published_at: new Date().toISOString(),
            content_snippet: "Laser class info",
          },
        ],
      });
    }
    if (text.includes("FROM entities e WHERE e.slug") || text.includes("FROM entities WHERE slug")) {
      const slug = params[0];
      if (slug === "validslug") {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              canonical_name: "Valid Entity",
              slug: "validslug",
              description: "A valid entity",
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    }
    if (text.includes("FROM tribes")) {
      return Promise.resolve({ rows: [] });
    }
    if (text.includes("INSERT INTO entity_followers") || text.includes("DELETE FROM entity_followers")) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [] });
  });

  return {
    query: queryMock,
    dbPool: { query: queryMock },
  };
});

describe("GET /api/entities", () => {
  it("should return 200 and list of entities with correct schema", async () => {
    const res = await request(app).get("/api/v1/entities?type=boat_class");
    expect(res.status).toBe(200);
    expect(res.body.entities).toBeInstanceOf(Array);
    expect(res.body.entities[0].slug).toBe("laser");
    expect(res.body.entities[0].canonical_name).toBe("Laser");
  });

  it("should return 200 for a valid slug with entity details and articles", async () => {
    const res = await request(app).get("/api/v1/entities/validslug");
    expect(res.status).toBe(200);
    expect(res.body.entity.slug).toBe("validslug");
    expect(res.body.articles).toBeInstanceOf(Array);
    expect(res.body.articles[0].title).toBe("Laser Sailing news");
  });

  it("should return 404 for an invalid slug", async () => {
    const res = await request(app).get("/api/v1/entities/invalidslug");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 200 and a valid RSS XML for /feed.rss path", async () => {
    const res = await request(app).get("/api/v1/entities/validslug/feed.rss");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/rss+xml");
    expect(res.text).toContain("<rss version=\"2.0\"");
    expect(res.text).toContain("Valid Entity");
    expect(res.text).toContain("/sendit/laserhash");
  });
});

describe("ActivityPub Federation Endpoints", () => {
  describe("GET /.well-known/webfinger", () => {
    it("should return 400 if resource is missing or invalid", async () => {
      const res = await request(app).get("/.well-known/webfinger");
      expect(res.status).toBe(400);
    });

    it("should return 200 and JRD JSON for valid resource lookup", async () => {
      const res = await request(app).get("/.well-known/webfinger?resource=acct:validslug@sailsouthern.com");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/jrd+json");
      expect(res.body.subject).toBe("acct:validslug@sailsouthern.com");
      expect(res.body.links).toBeInstanceOf(Array);
      expect(res.body.links[0].href).toContain("/api/v1/entities/validslug/actor");
    });

    it("should return 404 for invalid account slug", async () => {
      const res = await request(app).get("/.well-known/webfinger?resource=acct:invalidslug@sailsouthern.com");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/entities/:slug/actor", () => {
    it("should return 200 and Actor JSON for valid slug", async () => {
      const res = await request(app).get("/api/v1/entities/validslug/actor");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/activity+json");
      expect(res.body.type).toBe("Person");
      expect(res.body.preferredUsername).toBe("validslug");
      expect(res.body.inbox).toContain("/api/v1/entities/validslug/inbox");
    });

    it("should return 404 for invalid slug", async () => {
      const res = await request(app).get("/api/v1/entities/invalidslug/actor");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/entities/:slug/inbox", () => {
    it("should return 400 for empty activity payload", async () => {
      const res = await request(app).post("/api/v1/entities/validslug/inbox").send({});
      expect(res.status).toBe(400);
    });

    it("should return 202 status and accept Follow activities", async () => {
      const res = await request(app)
        .post("/api/v1/entities/validslug/inbox")
        .send({
          type: "Follow",
          actor: "https://remote.social/users/bob",
          object: "https://sailsouthern.com/api/entities/validslug/actor"
        });
      expect(res.status).toBe(202);
      expect(res.body.status).toBe("Accepted");
    });

    it("should return 202 status and accept Undo activities", async () => {
      const res = await request(app)
        .post("/api/v1/entities/validslug/inbox")
        .send({
          type: "Undo",
          actor: "https://remote.social/users/bob",
          object: {
            type: "Follow",
            actor: "https://remote.social/users/bob",
            object: "https://sailsouthern.com/api/entities/validslug/actor"
          }
        });
      expect(res.status).toBe(202);
      expect(res.body.status).toBe("Accepted");
    });

    it("should return 404 for invalid inbox slug", async () => {
      const res = await request(app)
        .post("/api/v1/entities/invalidslug/inbox")
        .send({
          type: "Follow",
          actor: "https://remote.social/users/bob",
          object: "https://sailsouthern.com/api/entities/invalidslug/actor"
        });
      expect(res.status).toBe(404);
    });
  });
});

