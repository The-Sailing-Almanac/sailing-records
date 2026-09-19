import { Pool } from "pg";
import dotenv from "dotenv";
import { logger } from "@stax/logger";
import { nip19 } from "nostr-tools";
import { finalizeEvent } from "nostr-tools/pure";
import { Relay } from "nostr-tools/relay";

dotenv.config();

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const relays = (process.env.NOSTR_RELAYS || "wss://relay.damus.io,wss://nos.lol").split(",");

function parseNostrPrivateKey(keyStr: string): Uint8Array {
  if (keyStr.startsWith("nsec")) {
    const decoded = nip19.decode(keyStr);
    if (decoded.type === "nsec") {
      return decoded.data;
    }
  }
  return Buffer.from(keyStr, "hex");
}

async function publishNostrEvent(
  eventData: { kind: number; content: string; tags: string[][] },
  privateKeyBytes: Uint8Array
): Promise<string> {
  const event = finalizeEvent(
    {
      kind: eventData.kind,
      created_at: Math.floor(Date.now() / 1000),
      tags: eventData.tags,
      content: eventData.content,
    },
    privateKeyBytes
  );

  logger.info(`[NostrPublisher] Signed event ${event.id}. Publishing to ${relays.length} relays...`);

  for (const url of relays) {
    try {
      logger.info(`[NostrPublisher] Connecting to relay ${url}...`);
      const relay = await Relay.connect(url);
      await relay.publish(event);
      logger.info(`[NostrPublisher] Successfully published event ${event.id} to ${url}`);
      relay.close();
    } catch (err) {
      logger.error(`[NostrPublisher] Failed to publish event to relay ${url}`, err);
    }
  }

  return event.id;
}

export async function processUnpublishedBulletins() {
  // TODO(sprint-12-social-archive): Consolidate this custom publishing path to use the shared platform adapters in `scripts/lib/social-adapters.ts` and archive outbound bulletin posts.
  try {
    const bulletinsRes = await dbPool.query(
      `SELECT b.id, b.title, b.body_md, t.slug, t.name as tribe_name, ak.nostr_private_key
       FROM tribe_bulletins b
       JOIN tribes t ON t.id = b.tribe_id
       LEFT JOIN actor_keys ak ON ak.actor_id = 'https://sailsouthern.com/api/entities/' || t.slug || '/actor'
       WHERE b.nostr_event_id IS NULL
       ORDER BY b.created_at ASC`
    );

    if (bulletinsRes.rows.length === 0) {
      return;
    }

    logger.info(`[NostrPublisher] Found ${bulletinsRes.rows.length} unpublished bulletins.`);

    for (const row of bulletinsRes.rows) {
      const privateKeyStr = row.nostr_private_key || process.env.NOSTR_PRIVATE_KEY;
      if (!privateKeyStr) {
        logger.warn(`[NostrPublisher] Skipping bulletin ${row.id}: No Nostr private key configured for tribe ${row.slug} or process.env.NOSTR_PRIVATE_KEY`);
        continue;
      }

      const keyBytes = parseNostrPrivateKey(privateKeyStr);
      const content = `⛵ Bulletin from ${row.tribe_name} tribe:\n\n"${row.title}"\n\n${row.body_md}`;
      const tags = [
        ["t", "sailing"],
        ["t", row.slug],
      ];

      logger.info(`[NostrPublisher] Processing bulletin ${row.id} ("${row.title}")`);
      const eventId = await publishNostrEvent({ kind: 1, content, tags }, keyBytes);

      await dbPool.query("UPDATE tribe_bulletins SET nostr_event_id = $1 WHERE id = $2", [eventId, row.id]);
      logger.info(`[NostrPublisher] Bulletin ${row.id} updated with Nostr Event ID: ${eventId}`);
    }
  } catch (err) {
    logger.error("[NostrPublisher] Error processing unpublished bulletins", err);
  }
}

// Daemon loop
export function startNostrPublisherDaemon() {
  logger.info("[NostrPublisher] Starting daemon loop...");
  const intervalMs = parseInt(process.env.NOSTR_PUBLISH_INTERVAL_MS || "15000", 10);
  
  const tick = async () => {
    await processUnpublishedBulletins();
    setTimeout(tick, intervalMs);
  };
  
  tick();
}

// Start if executed directly
if (require.main === module) {
  startNostrPublisherDaemon();
}
