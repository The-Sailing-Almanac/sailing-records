/**
 * workers/federation/src/bluesky-feed-generator.ts
 *
 * Bluesky Feed Generator Stub (AT Protocol Feed Service):
 * Implements standard xrpc getFeedSkeleton endpoint and did.json resolver.
 */

import express from "express";
import { logger } from "@stax/logger";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.BLUESKY_FEED_PORT || 5005;
const serviceDid = process.env.BLUESKY_SERVICE_DID || "did:web:feed.sailsouthern.com";

app.use(express.json());

/**
 * GET /.well-known/did.json
 * Resolves the service DID to tell Bluesky where this feed service is hosted.
 */
app.get("/.well-known/did.json", (req, res) => {
  res.json({
    "@context": ["https://www.w3.org/ns/did/v1"],
    "id": serviceDid,
    "service": [
      {
        "id": "#bsky_fg",
        "type": "BskyFeedGenerator",
        "serviceEndpoint": `https://${req.hostname}`
      }
    ]
  });
});

/**
 * GET /xrpc/app.bsky.feed.getFeedSkeleton
 * Official AT Protocol endpoint requested by Bluesky to load feed articles.
 */
app.get("/xrpc/app.bsky.feed.getFeedSkeleton", (req, res) => {
  try {
    const feed = req.query.feed as string;
    const limit = parseInt(req.query.limit as string || "50", 10);
    const cursor = req.query.cursor as string | undefined;

    logger.info(`[Bluesky Feed Generator] Received request for feed: ${feed}, limit: ${limit}, cursor: ${cursor}`);

    // TODO(sprint-12): Fetch articles from database filtering by entity mentions graph
    // e.g. select only articles matching specific sailboat classes or racing tags.
    // Const articles = await getEntitiesFilteredArticles(feed, limit, cursor);

    // Empty skeleton response matching AT Protocol app.bsky.feed.getFeedSkeleton schema:
    // { cursor: string, feed: Array<{ post: string }> }
    const feedSkeleton = {
      cursor: "sprint-11f-skeleton-end-cursor",
      feed: [] as Array<{ post: string }> // Array of AT URIs, e.g. at://did:plc:123/app.bsky.feed.post/456
    };

    res.json(feedSkeleton);
  } catch (err: any) {
    logger.error("[Bluesky Feed Generator] Error generating skeleton:", err);
    res.status(500).json({ error: "InternalServerError", message: err.message });
  }
});

export function startBlueskyFeedGenerator() {
  return app.listen(port, () => {
    logger.info(`[Bluesky Feed Generator] AT Protocol service listening at http://localhost:${port}`);
    logger.info(`- Configured Service DID: ${serviceDid}`);
  });
}

// Start Feed Generator if executed directly
if (require.main === module) {
  startBlueskyFeedGenerator();
}
