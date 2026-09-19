import { describe, test, expect, vi } from "vitest";
import { validate, requireAdminKey, errorHandler } from "../src/index";
import { z } from "zod";
import { Request, Response, NextFunction } from "express";

describe("@stax/api-middleware", () => {
  describe("validate middleware", () => {
    const schema = z.object({
      id: z.string().uuid(),
      count: z.number().min(1),
    });

    test("passes valid target payloads and calls next", () => {
      const middleware = validate(schema, "body");
      const req = {
        body: { id: "a811d044-6725-4554-b52e-ec111f122554", count: 5 }
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.body.count).toBe(5);
    });

    test("returns 400 validation error for invalid inputs", () => {
      const middleware = validate(schema, "body");
      const req = {
        body: { id: "not-a-uuid", count: 0 }
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("requireAdminKey middleware", () => {
    test("direct middleware signature: allows access if x-admin-key header matches", () => {
      process.env.ADMIN_API_KEY = "super_secret_admin_key";
      
      const req = {
        headers: { "x-admin-key": "super_secret_admin_key" }
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      requireAdminKey(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test("direct middleware signature: returns 401 if x-admin-key header is invalid", () => {
      process.env.ADMIN_API_KEY = "super_secret_admin_key";

      const req = {
        headers: { "x-admin-key": "wrong_key" }
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      requireAdminKey(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("factory signature: creates middleware and validates header", () => {
      process.env.ADMIN_API_KEY = "custom_secret";
      const middleware = requireAdminKey("custom-header");

      const req = {
        headers: { "custom-header": "custom_secret" }
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("errorHandler middleware", () => {
    test("sends 500 error response and logs it", () => {
      const err = new Error("General system failure");
      const req = {
        method: "GET",
        path: "/api/test",
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: "INTERNAL_ERROR",
          message: "General system failure",
          details: null
        })
      }));
    });
  });
});
