import { describe, it, expect, vi } from "vitest";
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
    if (text.includes("FROM phrf_regions")) {
      return Promise.resolve({
        rows: [
          { slug: "galveston-bay", name: "PHRF Galveston Bay", authority_url: null },
          { slug: "chesapeake-bay", name: "PHRF Chesapeake Bay", authority_url: null },
        ],
      });
    }

    if (text.includes("FROM phrf_ratings")) {
      return Promise.resolve({
        rows: [
          {
            rating_base: 168,
            rating_spin: 168,
            rating_nonspin: 177,
            notes: "J24 Class rating",
            source_url: "file://galveston-bay.csv",
            region_slug: "galveston-bay",
            region_name: "PHRF Galveston Bay",
          },
          {
            rating_base: 168,
            rating_spin: 168,
            rating_nonspin: 174,
            notes: "Chesapeake J24 OD",
            source_url: "file://chesapeake-bay.csv",
            region_slug: "chesapeake-bay",
            region_name: "PHRF Chesapeake Bay",
          },
        ],
      });
    }

    if (text.includes("FROM boat_spec_consensus")) {
      return Promise.resolve({
        rows: [
          { field_name: "loa_m", value_numeric: 7.32 },
          { field_name: "displacement_kg", value_numeric: 1406 },
          { field_name: "sail_area_sqm", value_numeric: 24.3 },
        ],
      });
    }

    if (text.includes("FROM orc_certificates")) {
      return Promise.resolve({
        rows: [
          {
            external_id: "USA-J24-001",
            boat_id: 1,
            owner_name: "Test Owner",
            club_name: "Test Club",
            gph: 695.4,
            loa_m: 7.32,
            lwl_m: 6.10,
            beam_m: 2.71,
            draft_m: 1.22,
            displacement_kg: 1406,
            upwind_sa_m2: 24.3,
            downwind_sa_m2: 48.5,
            cert_year: 2026,
            source_url: "https://orc.org",
            builder_name: "J Boats",
            model_name: "J 24"
          }
        ]
      });
    }

    if (text.includes("FROM boats")) {
      if (params && params[0] === 999) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({
        rows: [{ id: 1, builder_name: "J Boats", model_name: "J 24" }],
      });
    }

    if (text.includes("FROM handicap_systems_reports")) {
      return Promise.resolve({
        rows: [
          {
            report_date: "2026-05-28",
            system_slug: "phrf",
            total_boats_evaluated: 15,
            average_rating: 138.8,
            min_rating: 90.0,
            max_rating: 180.0,
            distribution_data: { "60-119": 6, "120-179": 8, ">=180": 1 },
            insights_markdown: "Test insights for PHRF",
            system_name: "Performance Handicap Racing Fleet",
            authority_name: "US Sailing",
            authority_website: "https://www.ussailing.org"
          }
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


describe("GET /api/handicap/phrf/regions", () => {
  it("should return 200 and list of regions", async () => {
    const res = await request(app).get("/api/v1/handicap/phrf/regions");
    expect(res.status).toBe(200);
    expect(res.body.regions).toBeInstanceOf(Array);
    expect(res.body.regions.length).toBe(2);
    expect(res.body.regions[0].slug).toBe("galveston-bay");
  });
});

describe("GET /api/handicap/phrf/ratings", () => {
  it("should return 400 if boat_id parameter is missing or invalid", async () => {
    const res = await request(app).get("/api/v1/handicap/phrf/ratings");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 200 and ratings list for boat_id", async () => {
    const res = await request(app).get("/api/v1/handicap/phrf/ratings?boat_id=1");
    expect(res.status).toBe(200);
    expect(res.body.ratings).toBeInstanceOf(Array);
    expect(res.body.ratings.length).toBe(2);
    expect(res.body.ratings[0].rating_spin).toBe(168);
  });
});

describe("POST /api/handicap/phrf/compare", () => {
  it("should return 400 validation error if body fields are invalid", async () => {
    const res = await request(app)
      .post("/api/v1/handicap/phrf/compare")
      .send({ boat_id: 1, regions: [], distance_nm: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 if boat is not found", async () => {
    const res = await request(app)
      .post("/api/v1/handicap/phrf/compare")
      .send({ boat_id: 999, regions: ["galveston-bay"], distance_nm: 10 });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Boat not found");
  });

  it("should return 200 and comparisons and deltas across regions", async () => {
    const res = await request(app)
      .post("/api/v1/handicap/phrf/compare")
      .send({ boat_id: 1, regions: ["galveston-bay", "chesapeake-bay"], distance_nm: 10 });
    
    expect(res.status).toBe(200);
    expect(res.body.boat.model_name).toBe("J 24");
    expect(res.body.distance_nm).toBe(10);
    expect(res.body.comparisons).toBeInstanceOf(Array);
    expect(res.body.comparisons.length).toBe(2);
    
    // Compare J24 in Galveston (nonspin 177) vs Chesapeake (nonspin 174) over 10nm
    // rating_diff: 177 - 174 = 3
    // time_delta_seconds: 3 * 10 = 30 seconds
    expect(res.body.deltas).toBeInstanceOf(Array);
    const nonspinDelta = res.body.deltas.find((d: any) => d.type === "nonspin");
    expect(nonspinDelta).toBeDefined();
    expect(nonspinDelta.rating_diff).toBe(3);
    expect(nonspinDelta.time_delta_seconds).toBe(30);
  });
});

describe("POST /api/handicap/estimate", () => {
  it("should return 400 validation error if body parameters are missing", async () => {
    const res = await request(app)
      .post("/api/v1/handicap/estimate")
      .send({ boat_id: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 200 and calculated ORC & IRC estimates", async () => {
    const res = await request(app)
      .post("/api/v1/handicap/estimate")
      .send({ boat_id: 1, phrf_rating: 150 });
    
    expect(res.status).toBe(200);
    expect(res.body.orc).toBeDefined();
    expect(res.body.orc.gphMin).toBeLessThan(res.body.orc.gphMax);
    expect(res.body.irc).toBeDefined();
    expect(res.body.irc.tccMin).toBeLessThan(res.body.irc.tccMax);
    expect(res.body.is_educational).toBe(true);
  });
});

describe("POST /api/handicap/fleet-intel", () => {
  it("should return 400 validation error if boat_identifiers is empty", async () => {
    const res = await request(app)
      .post("/api/v1/handicap/fleet-intel")
      .send({ boat_identifiers: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 200 and analyzed boat heuristics list sorted", async () => {
    const res = await request(app)
      .post("/api/v1/handicap/fleet-intel")
      .send({ boat_identifiers: ["USA-J24-001"], wind_band: "light" });
    
    expect(res.status).toBe(200);
    expect(res.body.boats).toBeInstanceOf(Array);
    expect(res.body.boats.length).toBe(1);
    expect(res.body.boats[0].external_id).toBe("USA-J24-001");
    expect(res.body.boats[0].sa_disp_ratio).toBeGreaterThan(0);
    expect(res.body.boats[0].dl_ratio).toBeGreaterThan(0);
    expect(res.body.boats[0].favored_wind).toBeDefined();
  });
});

describe("GET /api/handicap/reports", () => {
  it("should return 200 and a list of reports", async () => {
    const res = await request(app).get("/api/v1/handicap/reports");
    expect(res.status).toBe(200);
    expect(res.body.reports).toBeInstanceOf(Array);
    expect(res.body.reports.length).toBeGreaterThan(0);
    expect(res.body.reports[0].system_slug).toBe("phrf");
    expect(res.body.reports[0].system_name).toBe("Performance Handicap Racing Fleet");
  });
});

