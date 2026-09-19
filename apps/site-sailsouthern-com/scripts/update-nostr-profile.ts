/**
 * Script: update-nostr-profile.ts
 * Purpose: Signs and broadcasts a Nostr Kind-0 metadata update containing Lightning address (lud16) and Bolt12 fields.
 * Idempotent: Yes
 */
import dotenv from "dotenv";
import { nip19 } from "nostr-tools";
import { finalizeEvent } from "nostr-tools/pure";
import { Relay } from "nostr-tools/relay";

dotenv.config();

function parseNostrPrivateKey(keyStr: string): Uint8Array {
  if (keyStr.startsWith("nsec")) {
    const decoded = nip19.decode(keyStr);
    if (decoded.type === "nsec") {
      return decoded.data as Uint8Array;
    }
  }
  return Buffer.from(keyStr, "hex");
}

async function run() {
  console.log("[Nostr-Profile] Starting Kind-0 metadata profile update...");

  const privateKeyStr = process.env.NOSTR_PRIVATE_KEY;
  if (!privateKeyStr) {
    console.error("[Nostr-Profile] Error: NOSTR_PRIVATE_KEY is not defined in environment.");
    process.exit(1);
  }

  let keyBytes: Uint8Array;
  try {
    keyBytes = parseNostrPrivateKey(privateKeyStr);
  } catch (err) {
    console.error("[Nostr-Profile] Error parsing private key:", err);
    process.exit(1);
  }

  // Retrieve identity config values from environment with defaults
  const lightningAddress = process.env.LIGHTNING_ADDRESS;
  const bolt12Offer = process.env.BOLT12_OFFER;
  const name = process.env.NOSTR_PROFILE_NAME || "Sailing Almanac";
  const displayName = process.env.NOSTR_PROFILE_DISPLAY_NAME || "Sailing Almanac";
  const about = process.env.NOSTR_PROFILE_ABOUT || "Autonomous sailing newsletter, regatta results, and fleet analytics.";
  const website = process.env.NOSTR_PROFILE_WEBSITE || "https://sailsouthern.com";
  const picture = process.env.NOSTR_PROFILE_PICTURE || "";
  const nip05 = process.env.NOSTR_PROFILE_NIP05 || "";

  const metadata: Record<string, string> = {
    name,
    display_name: displayName,
    about,
    website,
  };

  if (picture) {
    metadata.picture = picture;
  }
  if (nip05) {
    metadata.nip05 = nip05;
  }
  if (lightningAddress) {
    metadata.lud16 = lightningAddress;
  }
  if (bolt12Offer) {
    metadata.bolt12 = bolt12Offer;
  }

  console.log("[Nostr-Profile] Constructing metadata payload:");
  console.log(JSON.stringify(metadata, null, 2));

  const event = finalizeEvent(
    {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(metadata),
    },
    keyBytes
  );

  const relays = (process.env.NOSTR_RELAYS || "wss://relay.damus.io,wss://nos.lol")
    .split(",")
    .map((r) => r.trim());

  console.log(`[Nostr-Profile] Signed Kind-0 event ${event.id}. Broadcasting to ${relays.length} relays...`);

  let successCount = 0;
  for (const url of relays) {
    try {
      console.log(`[Nostr-Profile] Connecting to relay: ${url}`);
      const relay = await Relay.connect(url);
      await relay.publish(event);
      console.log(`[Nostr-Profile] Successfully published to ${url}`);
      successCount++;
      relay.close();
    } catch (err: any) {
      console.error(`[Nostr-Profile] Failed to publish to relay ${url}:`, err.message || String(err));
    }
  }

  console.log(`[Nostr-Profile] Finished. Successfully updated on ${successCount}/${relays.length} relays.`);
}

run().catch((err) => {
  console.error("[Nostr-Profile] Unexpected error:", err);
  process.exit(1);
});
