import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishToMastodon, publishToNostr, publishToBluesky } from "../../../../scripts/lib/social-adapters";
import { archiveOutboundPost } from "@stax/activity-core";

vi.mock("@stax/activity-core", () => ({
  archiveOutboundPost: vi.fn().mockResolvedValue({ postId: 42, deliveryIds: [100] }),
}));

vi.mock("nostr-tools/pure", () => ({
  finalizeEvent: vi.fn().mockReturnValue({ id: "mock_nostr_event_id" }),
}));

vi.mock("nostr-tools", () => ({
  nip19: {
    decode: vi.fn().mockReturnValue({ type: "nsec", data: new Uint8Array(32) }),
  },
}));

const { mockRelayPublish, mockLogin, mockPost, mockUploadBlob, mockSession } = vi.hoisted(() => ({
  mockRelayPublish: vi.fn().mockResolvedValue(undefined),
  mockLogin: vi.fn().mockResolvedValue(undefined),
  mockPost: vi.fn().mockResolvedValue({ uri: "at://did:plc:mock/app.bsky.feed.post/rkey_123" }),
  mockUploadBlob: vi.fn().mockResolvedValue({ data: { blob: "mock_blob" } }),
  mockSession: { did: "did:plc:mock", handle: "mock_handle" }
}));

vi.mock("@atproto/api", () => {
  class MockBskyAgent {
    login = mockLogin;
    post = mockPost;
    uploadBlob = mockUploadBlob;
    get session() {
      return mockSession;
    }
  }
  class MockRichText {
    text: string;
    facets = [];
    constructor(opts: { text: string }) {
      this.text = opts.text;
    }
    detectFacets = vi.fn().mockResolvedValue(undefined);
  }
  return {
    BskyAgent: MockBskyAgent,
    RichText: MockRichText
  };
});

vi.mock("nostr-tools/relay", () => ({
  Relay: {
    connect: vi.fn().mockResolvedValue({
      publish: mockRelayPublish,
      close: vi.fn(),
    }),
  },
}));

describe("Platform Adapters", () => {
  const queryMock = vi.fn().mockResolvedValue({ rows: [] });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MASTODON_INSTANCE_URL = "https://mastodon.test";
    process.env.MASTODON_ACCESS_TOKEN = "test_mstdn_token";
    process.env.NOSTR_PRIVATE_KEY = "nsec1testnsec";
    process.env.NOSTR_RELAYS = "wss://relay.test";
    process.env.BLUESKY_IDENTIFIER = "test.bsky.social";
    process.env.BLUESKY_PASSWORD = "test_password";
  });

  describe("publishToMastodon", () => {
    it("should successfully post to Mastodon statuses endpoint and call archiveOutboundPost", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "mstdn_123", url: "https://mastodon.test/status/mstdn_123" }),
      });
      global.fetch = fetchMock;

      const content = {
        id: 1,
        type: "newsletter" as const,
        title: "Daily Digest",
        text: "Sailing daily digest",
      };

      const result = await publishToMastodon(queryMock, 10, content);

      expect(fetchMock).toHaveBeenCalled();
      expect(archiveOutboundPost).toHaveBeenCalled();
      expect(result.status).toBe("success");
      expect(result.externalId).toBe("mstdn_123");
      expect(result.externalUrl).toBe("https://mastodon.test/status/mstdn_123");
    });

    it("should archive failure if Mastodon API call fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });
      global.fetch = fetchMock;

      const content = {
        id: 1,
        type: "newsletter" as const,
        title: "Daily Digest",
        text: "Sailing daily digest",
      };

      await expect(publishToMastodon(queryMock, 10, content)).rejects.toThrow("Mastodon publishing failed");
      expect(archiveOutboundPost).toHaveBeenCalled();
      
      const payloadCalled = vi.mocked(archiveOutboundPost).mock.calls[0][1];
      expect(payloadCalled.deliveries?.[0].status).toBe("failed");
      expect(payloadCalled.deliveries?.[0].error_message).toContain("Internal Server Error");
    });
  });

  describe("publishToNostr", () => {
    it("should successfully connect to relays, sign and publish event, and archive", async () => {
      const content = {
        id: 1,
        type: "newsletter" as const,
        title: "Daily Digest",
        text: "Sailing daily digest",
      };

      const result = await publishToNostr(queryMock, 20, content);

      expect(mockRelayPublish).toHaveBeenCalled();
      expect(archiveOutboundPost).toHaveBeenCalled();
      expect(result.status).toBe("success");
      expect(result.externalId).toBe("mock_nostr_event_id");
    });

    it("should archive failure if all relays fail", async () => {
      mockRelayPublish.mockRejectedValueOnce(new Error("Relay timeout"));

      const content = {
        id: 1,
        type: "newsletter" as const,
        title: "Daily Digest",
        text: "Sailing daily digest",
      };

      await expect(publishToNostr(queryMock, 20, content)).rejects.toThrow("Nostr publishing failed");
      expect(archiveOutboundPost).toHaveBeenCalled();

      const payloadCalled = vi.mocked(archiveOutboundPost).mock.calls[0][1];
      expect(payloadCalled.deliveries?.[0].status).toBe("failed");
    });
  });

  describe("publishToBluesky", () => {
    it("should successfully authenticate, create post record, and archive", async () => {
      mockLogin.mockResolvedValueOnce(undefined);
      mockPost.mockResolvedValueOnce({ uri: "at://did:plc:mock/app.bsky.feed.post/rkey_123" });

      const content = {
        id: 1,
        type: "newsletter" as const,
        title: "Daily Digest",
        text: "Sailing daily digest",
      };

      const result = await publishToBluesky(queryMock, 30, content);

      expect(mockLogin).toHaveBeenCalledWith({ identifier: "test.bsky.social", password: "test_password" });
      expect(mockPost).toHaveBeenCalled();
      expect(archiveOutboundPost).toHaveBeenCalled();
      expect(result.status).toBe("success");
      expect(result.externalId).toBe("at://did:plc:mock/app.bsky.feed.post/rkey_123");
      expect(result.externalUrl).toBe("https://bsky.app/profile/mock_handle/post/rkey_123");
    });

    it("should archive failure if Bluesky API session creation fails", async () => {
      mockLogin.mockRejectedValueOnce(new Error("authentication failed"));

      const content = {
        id: 1,
        type: "newsletter" as const,
        title: "Daily Digest",
        text: "Sailing daily digest",
      };

      await expect(publishToBluesky(queryMock, 30, content)).rejects.toThrow("Bluesky publishing failed");
      expect(archiveOutboundPost).toHaveBeenCalled();

      const payloadCalled = vi.mocked(archiveOutboundPost).mock.calls[0][1];
      expect(payloadCalled.deliveries?.[0].status).toBe("failed");
      expect(payloadCalled.deliveries?.[0].error_message).toContain("authentication failed");
    });
  });
});
