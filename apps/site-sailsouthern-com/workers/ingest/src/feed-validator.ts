import { logger } from "@stax/logger";
/**
 * BullMQ worker: validates feed_endpoints incrementally (max 10 concurrent HTTP checks).
 */
import { Queue, Worker } from "bullmq";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const BATCH_SIZE = 50;
const MAX_CONCURRENT = 10;
const REQUEST_TIMEOUT_MS = 10_000;
const QUEUE_NAME = "feed_validation";

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

export const feedValidationQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
});

type FeedRow = {
  id: string;
  url: string;
};

function looksLikeFeedXml(body: string, contentType: string): boolean {
  const lower = body.slice(0, 2000).toLowerCase();
  const ct = contentType.toLowerCase();
  if (ct.includes("xml") || ct.includes("rss") || ct.includes("atom")) {
    return (
      lower.includes("<rss") ||
      lower.includes("<feed") ||
      lower.includes("<rdf:rdf")
    );
  }
  return (
    lower.includes("<rss") ||
    lower.includes("<feed") ||
    lower.includes("<channel>")
  );
}

async function fetchFeedContent(url: string, signal: AbortSignal): Promise<{ status: number; text: string; contentType: string }> {
  let res = await fetch(url, {
    method: "HEAD",
    signal,
    headers: { "User-Agent": "SailingAlmanac-FeedValidator/1.0" },
    redirect: "follow",
  });

  if (res.status === 405 || res.status === 501) {
    res = await fetch(url, {
      method: "GET",
      signal,
      headers: { "User-Agent": "SailingAlmanac-FeedValidator/1.0" },
      redirect: "follow",
    });
  }

  if (res.status < 200 || res.status >= 300) {
    return { status: res.status, text: "", contentType: "" };
  }

  const getRes = await fetch(url, {
    method: "GET",
    signal,
    headers: { "User-Agent": "SailingAlmanac-FeedValidator/1.0" },
    redirect: "follow",
  });

  const contentType = getRes.headers.get("content-type") || "";
  const text = await getRes.text();
  return { status: getRes.status, text, contentType };
}

async function checkFeed(url: string): Promise<{
  httpStatus: number;
  isActive: boolean;
  validationError: string | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const { status, text, contentType } = await fetchFeedContent(url, controller.signal);

    if (status < 200 || status >= 300) {
      return {
        httpStatus: status,
        isActive: false,
        validationError: `http_${status}`,
      };
    }

    const valid = looksLikeFeedXml(text, contentType);
    return {
      httpStatus: status,
      isActive: valid,
      validationError: valid ? null : "not_feed_xml",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      httpStatus: 0,
      isActive: false,
      validationError: message.slice(0, 500),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await fn(item);
    }
  });
  await Promise.all(workers);
}

async function validateBatch(feedIds: string[]) {
  const res = await dbPool.query<FeedRow>(
    `SELECT id, url FROM feed_endpoints WHERE id = ANY($1::uuid[])`,
    [feedIds]
  );

  let active = 0;
  let dead = 0;
  let errors = 0;

  await runWithConcurrency(res.rows, MAX_CONCURRENT, async (feed) => {
    const result = await checkFeed(feed.url);

    await dbPool.query(
      `UPDATE feed_endpoints
       SET http_status = $1,
           is_active = $2,
           validation_error = $3,
           last_checked_at = NOW()
       WHERE id = $4`,
      [
        result.httpStatus || null,
        result.isActive,
        result.validationError,
        feed.id,
      ]
    );

    if (result.isActive) active += 1;
    else if (result.validationError?.startsWith("http_")) dead += 1;
    else errors += 1;
  });

  logger.info(
    `[Feed Validator] Batch complete: active=${active}, dead=${dead}, errors=${errors}`
  );
}

export const feedValidatorWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const feedIds = job.data.feedIds as string[];
    await validateBatch(feedIds);
  },
  { connection: redisConnection, concurrency: 1 }
);

feedValidatorWorker.on("failed", (job, err) => {
  logger.error(`[Feed Validator] Job ${job?.id} failed:`, err.message);
});

export async function enqueueUnvalidatedFeeds() {
  const res = await dbPool.query<{ id: string }>(
    `SELECT id FROM feed_endpoints
     WHERE last_checked_at IS NULL
     ORDER BY created_at NULLS LAST, id
     LIMIT 500`
  );

  if (res.rows.length === 0) {
    logger.info("[Feed Validator] No unvalidated feeds to enqueue.");
    return 0;
  }

  const ids = res.rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    await feedValidationQueue.add("validate-batch", { feedIds: chunk });
  }

  logger.info(
    `[Feed Validator] Enqueued ${Math.ceil(ids.length / BATCH_SIZE)} jobs (${ids.length} feeds).`
  );
  return ids.length;
}
