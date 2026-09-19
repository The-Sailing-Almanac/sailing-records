import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../src/index";

describe("@stax/logger", () => {
  let logSpy: any;
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("masks IPv4 and IPv6 addresses in messages", () => {
    logger.info("Connection from 192.168.1.100 and 2001:db8:3333:4444:5555:6666:7777:8888");
    expect(logSpy).toHaveBeenCalledWith(
      "[INFO] Connection from [MASKED_IP] and [MASKED_IP]",
      ""
    );
  });

  test("masks email addresses in messages", () => {
    logger.warn("User user.name+test@domain.co.uk failed to login");
    expect(warnSpy).toHaveBeenCalledWith(
      "[WARN] User use***@domain.co.uk failed to login",
      ""
    );
  });

  test("strips query strings from URLs in messages", () => {
    logger.info("Fetched https://api.sailsouthern.com/api/admin/stats?key=secret_value&id=123 successfully");
    expect(logSpy).toHaveBeenCalledWith(
      "[INFO] Fetched https://api.sailsouthern.com/api/admin/stats successfully",
      ""
    );
  });

  test("masks sensitive fields in meta object", () => {
    logger.info("User details loaded", {
      email: "test@sailsouthern.com",
      ipAddress: "127.0.0.1",
      apiKey: "123456789abcdef",
      authToken: "secretToken123",
      password: "password123",
      safeValue: "keep_this"
    });

    const parsedMeta = logSpy.mock.calls[0][1];
    expect(parsedMeta).toEqual({
      email: "tes***",
      ipAddress: "[MASKED_IP]",
      apiKey: "123456...",
      authToken: "secret...",
      password: "passwo...",
      safeValue: "keep_this"
    });
  });

  test("properly formats errors with stack traces", () => {
    const testError = new Error("Database timeout");
    logger.error("Failed query", testError, { query: "SELECT * FROM users" });

    expect(errorSpy).toHaveBeenCalled();
    const errorPayload = errorSpy.mock.calls[0][1];
    expect(errorPayload.message).toBe("Database timeout");
    expect(errorPayload.stack).toBeDefined();
    expect(errorPayload.query).toBe("SELECT * FROM users");
  });
});
