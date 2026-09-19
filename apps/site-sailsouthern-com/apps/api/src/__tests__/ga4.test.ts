import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendGA4Event } from "@stax/activity-core";

describe("sendGA4Event", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GA4_MEASUREMENT_ID = "G-TEST123456";
    process.env.GA4_API_SECRET = "secret_api_key_abc";
    vi.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 }))
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should skip sending event if credentials are not configured", async () => {
    delete process.env.GA4_MEASUREMENT_ID;
    delete process.env.GA4_API_SECRET;
    
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendGA4Event("test_event", { foo: "bar" });

    expect(fetch).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing GA4_MEASUREMENT_ID or GA4_API_SECRET")
    );
  });

  it("should send post request to GA4 collect endpoint with clean parameters", async () => {
    await sendGA4Event("test_event", {
      text: "hello",
      num: 42,
      bool: true,
      nested: { obj: 1 } as any // should be stringified
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(fetch).mock.calls[0];

    expect(url).toBe(
      "https://www.google-analytics.com/mp/collect?measurement_id=G-TEST123456&api_secret=secret_api_key_abc"
    );

    const body = JSON.parse(options?.body as string);
    expect(body.client_id).toBe("sailsouthern_backend_node");
    expect(body.events.length).toBe(1);
    expect(body.events[0].name).toBe("test_event");
    expect(body.events[0].params.text).toBe("hello");
    expect(body.events[0].params.num).toBe(42);
    expect(body.events[0].params.bool).toBe(true);
    expect(body.events[0].params.nested).toBe("[object Object]");
  });
});
