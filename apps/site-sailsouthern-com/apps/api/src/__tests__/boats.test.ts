import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../index";
import { ApiErrorResponse } from "@almanac/types";

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
        getStats: vi.fn().mockResolvedValue({ numberOfDocuments: 0 }),
      }),
    };
  },
}));

vi.mock("../lib/db", () => {
  const queryMock = vi.fn().mockImplementation((text, params) => {
    if (text.includes("FROM boats")) {
      // Handle count query
      if (text.includes("COUNT(*)")) {
        return Promise.resolve({
          rows: [{ count: 15 }],
        });
      }
      
      // Handle detail query (ID 999 not found)
      if (params && params[0] === 999) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({
        rows: [
          {
            id: 1,
            builder_name: "Catalina Yachts",
            model_name: "Catalina 30",
            variant_name: "Standard Rig",
            year_start: 1974,
            year_end: 2008,
            hull_type: "Fin Keel",
            rig_type: "Masthead Sloop",
            loa_m: 9.12,
            displacement_kg: 4627,
          },
        ],
      });
    }

    if (text.includes("FROM boat_sources")) {
      return Promise.resolve({
        rows: [
          {
            source_type: "sailboatdata",
            source_url: "https://sailboatdata.com/sailboat/catalina-30",
            last_seen_at: "2026-05-28T00:00:00Z",
          },
        ],
      });
    }

    if (text.includes("FROM boat_spec_consensus")) {
      return Promise.resolve({
        rows: [
          {
            field_name: "loa_m",
            value_numeric: 9.12,
            value_text: null,
            confidence: 0.95,
            num_sources: 2,
            num_thumbs_up: 5,
            num_flags: 0,
            debug_info: null,
          },
        ],
      });
    }

    return Promise.resolve({ rows: [] });
  });

  return {
    query: queryMock,
    dbPool: { query: queryMock },
  };
});

describe("GET /api/boats", () => {
  it("should return 200 and list of boats with pagination", async () => {
    const res = await request(app).get("/api/v1/boats?page=1&limit=5");
    expect(res.status).toBe(200);
    expect(res.body.boats).toBeInstanceOf(Array);
    expect(res.body.boats.length).toBe(1);
    expect(res.body.total).toBe(15);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
  });
});

describe("GET /api/boats/:id", () => {
  it("should return 404 if boat is not found", async () => {
    const res = await request(app).get("/api/v1/boats/999");
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Boat not found");
  });

  it("should return 200 and combined details with consensus specs", async () => {
    const res = await request(app).get("/api/v1/boats/1");
    expect(res.status).toBe(200);
    expect(res.body.boat.model_name).toBe("Catalina 30");
    expect(res.body.sources[0].source_type).toBe("sailboatdata");
    expect(res.body.specs.loa_m.value).toBe(9.12);
    expect(res.body.specs.loa_m.confidence).toBe(0.95);
    expect(res.body.specs.loa_m.num_thumbs_up).toBe(5);
  });
});

describe("POST /api/boats/:id/vote", () => {
  it("should return 400 validation error if body fields are missing or invalid", async () => {
    const res = await request(app)
      .post("/api/v1/boats/1/vote")
      .send({ field_name: "", vote: "down" }); // invalid vote and empty field_name
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 if boat is not found", async () => {
    const res = await request(app)
      .post("/api/v1/boats/999/vote")
      .send({ field_name: "loa_m", vote: "up" });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Boat not found");
  });

  it("should return 200 and save vote successfully", async () => {
    const res = await request(app)
      .post("/api/v1/boats/1/vote")
      .send({ field_name: "loa_m", vote: "up", comment: "Verified by class rules" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("registered successfully");
  });
});
