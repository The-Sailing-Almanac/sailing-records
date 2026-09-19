import { logger } from "@stax/logger";
import { Worker } from "bullmq";
import { Pool } from "pg";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
// import { GoogleAIFileManager } from "@google/generative-ai/server"; // We would use this for large audio files

dotenv.config();

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function processSinglePodcast(payload: any, jobId: string): Promise<void> {
  let aiSummary = "";
  const hasTranscript = !!(payload.podcastMetadata?.transcripts?.length);

  if (!hasTranscript && process.env.GEMINI_API_KEY) {
    logger.info(`[Podcast Processor] Generating AI summary for ${payload.title}`);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `Based on the following podcast description, provide a short summary of what the podcast is likely about. Description: ${payload.contentSnippet || payload.title}`;
      const result = await model.generateContent(prompt);
      aiSummary = result.response.text();
    } catch (err) {
      logger.error("[Podcast Processor] Gemini summary generation failed:", err);
    }
  }

  const metadata = {
    ...payload.podcastMetadata,
    has_transcript: hasTranscript,
    ai_summary: aiSummary,
    media_enclosure: payload.enclosure
  };

  // 1. Insert/update article_links
  const insertRes = await dbPool.query<{ id: string }>(
    `INSERT INTO article_links (feed_endpoint_id, url, url_hash, title, published_at, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (url_hash) DO UPDATE 
     SET metadata = EXCLUDED.metadata, title = EXCLUDED.title
     RETURNING id`,
    [
      payload.feedEndpointId,
      payload.url,
      payload.urlHash,
      payload.title,
      payload.publishedAt,
      JSON.stringify(metadata)
    ]
  );
  const articleLinkId = insertRes.rows[0].id;

  // 2. Populate podcast_shows if feed metadata exists
  if (payload.podcastMetadata) {
    await dbPool.query(
      `INSERT INTO podcast_shows (feed_endpoint_id, podcast_guid, funding_url, funding_text, license)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (feed_endpoint_id) DO UPDATE
       SET podcast_guid = EXCLUDED.podcast_guid,
           funding_url = EXCLUDED.funding_url,
           funding_text = EXCLUDED.funding_text,
           license = EXCLUDED.license`,
      [
        payload.feedEndpointId,
        payload.podcastMetadata.feedGuid || null,
        payload.podcastMetadata.fundingUrl || null,
        payload.podcastMetadata.fundingText || null,
        payload.podcastMetadata.feedLicense || null
      ]
    );
  }

  // 3. Populate podcast_episodes
  await dbPool.query(
    `INSERT INTO podcast_episodes (article_link_id, episode_guid, license, live_item_readiness, live_item_starts, live_item_ends)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (article_link_id) DO UPDATE
     SET episode_guid = EXCLUDED.episode_guid,
         license = EXCLUDED.license,
         live_item_readiness = EXCLUDED.live_item_readiness,
         live_item_starts = EXCLUDED.live_item_starts,
         live_item_ends = EXCLUDED.live_item_ends`,
    [
      articleLinkId,
      payload.podcastMetadata?.episodeGuid || payload.guid || null,
      payload.podcastMetadata?.episodeLicense || payload.license || null,
      payload.podcastMetadata?.liveItemReadiness || null,
      payload.podcastMetadata?.liveItemStarts ? new Date(payload.podcastMetadata.liveItemStarts) : null,
      payload.podcastMetadata?.liveItemEnds ? new Date(payload.podcastMetadata.liveItemEnds) : null
    ]
  );

  // 4. Populate transcripts
  if (payload.podcastMetadata?.transcripts && Array.isArray(payload.podcastMetadata.transcripts)) {
    await dbPool.query(`DELETE FROM podcast_transcripts WHERE article_link_id = $1`, [articleLinkId]);
    for (const t of payload.podcastMetadata.transcripts) {
      await dbPool.query(
        `INSERT INTO podcast_transcripts (article_link_id, url, type, language, rel)
         VALUES ($1, $2, $3, $4, $5)`,
        [articleLinkId, t.url, t.type, t.language || null, t.rel || null]
      );
    }
  }

  // 5. Populate people
  if (payload.podcastMetadata?.people && Array.isArray(payload.podcastMetadata.people)) {
    await dbPool.query(`DELETE FROM podcast_episode_people WHERE article_link_id = $1`, [articleLinkId]);
    for (const p of payload.podcastMetadata.people) {
      let personId: number;
      const existingPerson = await dbPool.query<{ id: number }>(
        "SELECT id FROM podcast_people WHERE name = $1 AND COALESCE(role, '') = $2",
        [p.name, p.role || '']
      );
      if (existingPerson.rows.length > 0) {
        personId = existingPerson.rows[0].id;
      } else {
        const insertPerson = await dbPool.query<{ id: number }>(
          `INSERT INTO podcast_people (name, role, group_name, href, img)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [p.name, p.role || null, p.group_name || 'cast', p.href || null, p.img || null]
        );
        personId = insertPerson.rows[0].id;
      }
      await dbPool.query(
        `INSERT INTO podcast_episode_people (article_link_id, person_id)
         VALUES ($1, $2)
         ON CONFLICT (article_link_id, person_id) DO NOTHING`,
        [articleLinkId, personId]
      );
    }
  }

  // 6. Populate remote references
  if (payload.podcastMetadata?.remoteReferences && Array.isArray(payload.podcastMetadata.remoteReferences)) {
    await dbPool.query(`DELETE FROM podcast_remote_references WHERE article_link_id = $1`, [articleLinkId]);
    for (const r of payload.podcastMetadata.remoteReferences) {
      await dbPool.query(
        `INSERT INTO podcast_remote_references (article_link_id, remote_feed_guid, remote_item_guid, remote_url, medium)
         VALUES ($1, $2, $3, $4, $5)`,
        [articleLinkId, r.feedGuid || null, r.itemGuid || null, r.url || null, r.medium || null]
      );
    }
  }
}

export const podcastWorker = new Worker("podcast_processing", async (job) => {
  const payload = job.data;
  logger.info(`[Podcast Processor] Processing ${payload.title}`);

  try {
    await processSinglePodcast(payload, job.id || "unknown");
    logger.info(`[Podcast Processor] Successfully saved ${payload.title}`);
  } catch (err) {
    logger.error(`[Podcast Processor] Failed to process job ${job.id}:`, err);
    throw err;
  }
}, { connection: redisConnection });

podcastWorker.on('failed', (job, err) => {
  logger.error(`[Podcast Processor] Job ${job?.id} failed:`, err.message);
});
