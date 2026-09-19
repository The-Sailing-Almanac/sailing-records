import { archiveOutboundPost, ArchivePostPayload } from "@stax/activity-core";
import crypto from "crypto";
import { nip19 } from "nostr-tools";
import { finalizeEvent } from "nostr-tools/pure";
import { Relay } from "nostr-tools/relay";
import { BskyAgent, RichText } from "@atproto/api";
import { TwitterApi } from "twitter-api-v2";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export interface CanonicalContent {
  id: string | number;
  type: "newsletter" | "article" | "boat";
  title: string;
  text: string;
  mediaUrls?: string[];
  links?: string[];
}

export interface AdapterResult {
  postId: number;
  externalId: string | null;
  externalUrl: string | null;
  status: "success" | "failed";
  errorMessage: string | null;
}

/**
 * Real Mastodon publishing adapter.
 * POSTs status update to Mastodon statuses API endpoint.
 */
export async function publishToMastodon(
  queryFn: (text: string, params?: any[]) => Promise<{ rows: any[] }>,
  accountId: number,
  content: CanonicalContent
): Promise<AdapterResult> {
  const instanceUrl = process.env.MASTODON_INSTANCE_URL;
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;

  if (!instanceUrl || !accessToken) {
    throw new Error("MASTODON_INSTANCE_URL or MASTODON_ACCESS_TOKEN is not defined in environment");
  }

  const endpoint = `${instanceUrl.replace(/\/$/, "")}/api/v1/statuses`;
  const campaign = `issue-${content.id}`;
  const slug = slugify(content.title);
  const webLink = `https://sailsouthern.com/daily/${content.id}?utm_source=sailsouthern&utm_medium=mastodon&utm_campaign=${campaign}&utm_content=${slug}`;
  const postText = `🗞️ ${content.title}\n\n${content.text.slice(0, 250)}...\n\nRead more: ${webLink} #sailing #newsletter`;

  let externalId: string | null = null;
  let externalUrl: string | null = null;
  let status: "success" | "failed" = "success";
  let errorMessage: string | null = null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        status: postText,
        visibility: "public"
      })
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Mastodon API error (HTTP ${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    externalId = data.id;
    externalUrl = data.url;
  } catch (err: any) {
    status = "failed";
    errorMessage = err.message || String(err);
  }

  const payload: ArchivePostPayload = {
    content_text: postText,
    title: content.title,
    linked_entity_type: content.type,
    linked_entity_id: String(content.id),
    metadata: {
      platform_limit: 500,
      char_count: postText.length
    },
    provenance_rights: {
      license: "all_rights_reserved",
      rights_holder: "Sailing Almanac"
    },
    media: content.mediaUrls?.map(url => ({
      media_url: url,
      media_type: "image/jpeg"
    })) || [],
    links: [
      { url: webLink },
      ...(content.links?.map(url => ({ url })) || [])
    ],
    deliveries: [
      {
        account_id: accountId,
        platform: "mastodon",
        external_id: externalId,
        external_url: externalUrl,
        status,
        error_message: errorMessage,
        delivered_at: status === "success" ? new Date() : null
      }
    ]
  };

  const { postId } = await archiveOutboundPost(queryFn, payload);

  if (status === "failed") {
    throw new Error(`Mastodon publishing failed: ${errorMessage}`);
  }

  return {
    postId,
    externalId,
    externalUrl,
    status,
    errorMessage
  };
}

/**
 * Real Nostr publishing adapter.
 * Connects and publishes Kind-1 note to configured relays.
 */
export async function publishToNostr(
  queryFn: (text: string, params?: any[]) => Promise<{ rows: any[] }>,
  accountId: number,
  content: CanonicalContent
): Promise<AdapterResult> {
  const privateKeyStr = process.env.NOSTR_PRIVATE_KEY;
  if (!privateKeyStr) {
    throw new Error("NOSTR_PRIVATE_KEY is not defined in environment");
  }

  let keyBytes: Uint8Array;
  if (privateKeyStr.startsWith("nsec")) {
    const decoded = nip19.decode(privateKeyStr);
    if (decoded.type === "nsec") {
      keyBytes = decoded.data as Uint8Array;
    } else {
      throw new Error("Invalid nsec private key format");
    }
  } else {
    keyBytes = Uint8Array.from(Buffer.from(privateKeyStr, "hex"));
  }

  const campaign = `issue-${content.id}`;
  const slug = slugify(content.title);
  const webLink = `https://sailsouthern.com/daily/${content.id}?utm_source=sailsouthern&utm_medium=nostr&utm_campaign=${campaign}&utm_content=${slug}`;
  const postText = `🗞️ ${content.title}\n\n${content.text.slice(0, 280)}...\n\nRead more: ${webLink}`;

  const tags: string[][] = [
    ["t", "sailing"],
    ["t", "newsletter"]
  ];
  if (content.mediaUrls && content.mediaUrls.length > 0) {
    for (const url of content.mediaUrls) {
      tags.push(["r", url]);
    }
  }

  const event = finalizeEvent(
    {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: postText,
    },
    keyBytes
  );

  const relays = (process.env.NOSTR_RELAYS || "wss://relay.damus.io,wss://nos.lol").split(",").map(r => r.trim());
  const attempted: string[] = [];
  const acknowledged: string[] = [];
  const failures: Record<string, string> = {};

  for (const url of relays) {
    attempted.push(url);
    try {
      const relay = await Relay.connect(url);
      await relay.publish(event);
      acknowledged.push(url);
      relay.close();
    } catch (err: any) {
      failures[url] = err.message || String(err);
    }
  }

  const success = acknowledged.length > 0;
  const deliveryStatus = success ? "success" : "failed";
  const errorMessage = success 
    ? (acknowledged.length < relays.length ? `Partial relay failure: failed on ${Object.keys(failures).join(", ")}` : null)
    : `All relays failed: ${JSON.stringify(failures)}`;

  const payload: ArchivePostPayload = {
    content_text: postText,
    title: content.title,
    linked_entity_type: content.type,
    linked_entity_id: String(content.id),
    metadata: {
      kind: 1,
      attempted_relays: attempted,
      acknowledged_relays: acknowledged,
      failures
    },
    provenance_rights: {
      license: "all_rights_reserved",
      rights_holder: "Sailing Almanac"
    },
    media: content.mediaUrls?.map(url => ({
      media_url: url,
      media_type: "image/jpeg"
    })) || [],
    links: [
      { url: webLink },
      ...(content.links?.map(url => ({ url })) || [])
    ],
    deliveries: [
      {
        account_id: accountId,
        platform: "nostr",
        external_id: event.id,
        external_url: `https://njump.me/${event.id}`,
        status: deliveryStatus,
        error_message: errorMessage,
        delivered_at: success ? new Date() : null
      }
    ]
  };

  const { postId } = await archiveOutboundPost(queryFn, payload);

  if (!success) {
    throw new Error(`Nostr publishing failed: ${errorMessage}`);
  }

  return {
    postId,
    externalId: event.id,
    externalUrl: `https://njump.me/${event.id}`,
    status: "success",
    errorMessage: null
  };
}

/**
 * Real AT Protocol / Bluesky publishing adapter.
 * Performs session auth exchange and creates the post record via raw XRPC fetch.
 */
export async function publishToBluesky(
  queryFn: (text: string, params?: any[]) => Promise<{ rows: any[] }>,
  accountId: number,
  content: CanonicalContent
): Promise<AdapterResult> {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_PASSWORD;

  if (!identifier || !password) {
    throw new Error("BLUESKY_IDENTIFIER or BLUESKY_PASSWORD is not defined in environment");
  }

  const campaign = `issue-${content.id}`;
  const slug = slugify(content.title);
  const webLink = `https://sailsouthern.com/daily/${content.id}?utm_source=sailsouthern&utm_medium=bluesky&utm_campaign=${campaign}&utm_content=${slug}`;
  const postText = `🗞️ ${content.title}\n\n${content.text.slice(0, 200)}...\n\nRead more: ${webLink}`;

  let externalId: string | null = null;
  let externalUrl: string | null = null;
  let status: "success" | "failed" = "success";
  let errorMessage: string | null = null;
  let metadata: any = { platform_limit: 300, char_count: postText.length };

  try {
    const agent = new BskyAgent({ service: "https://bsky.social" });
    await agent.login({ identifier, password });

    metadata.did = agent.session?.did;
    metadata.handle = agent.session?.handle;

    const rt = new RichText({ text: postText });
    await rt.detectFacets(agent);

    let embed: any = undefined;
    if (content.mediaUrls && content.mediaUrls.length > 0) {
      const images: any[] = [];
      for (const mediaUrl of content.mediaUrls) {
        try {
          const mediaRes = await fetch(mediaUrl);
          if (mediaRes.ok) {
            const blob = await mediaRes.blob();
            const buffer = Buffer.from(await blob.arrayBuffer());
            const uploadRes = await agent.uploadBlob(buffer, {
              encoding: mediaRes.headers.get("content-type") || "image/jpeg"
            });
            images.push({
              image: uploadRes.data.blob,
              alt: content.title
            });
          }
        } catch (mediaErr) {
          console.error(`[Bluesky Adapter] Failed to upload media blob for ${mediaUrl}:`, mediaErr);
        }
      }
      if (images.length > 0) {
        embed = {
          $type: "app.bsky.embed.images",
          images
        };
      }
    }

    const postRes = await agent.post({
      text: rt.text,
      facets: rt.facets,
      embed,
      createdAt: new Date().toISOString()
    });

    externalId = postRes.uri;
    const rkey = postRes.uri.split("/").pop();
    externalUrl = `https://bsky.app/profile/${agent.session?.handle}/post/${rkey}`;
  } catch (err: any) {
    status = "failed";
    errorMessage = err.message || String(err);
  }

  const payload: ArchivePostPayload = {
    content_text: postText,
    title: content.title,
    linked_entity_type: content.type,
    linked_entity_id: String(content.id),
    metadata,
    provenance_rights: {
      license: "all_rights_reserved",
      rights_holder: "Sailing Almanac"
    },
    media: content.mediaUrls?.map(url => ({
      media_url: url,
      media_type: "image/jpeg"
    })) || [],
    links: [
      { url: webLink },
      ...(content.links?.map(url => ({ url })) || [])
    ],
    deliveries: [
      {
        account_id: accountId,
        platform: "bluesky",
        external_id: externalId,
        external_url: externalUrl,
        status,
        error_message: errorMessage,
        delivered_at: status === "success" ? new Date() : null
      }
    ]
  };

  const { postId } = await archiveOutboundPost(queryFn, payload);

  if (status === "failed") {
    throw new Error(`Bluesky publishing failed: ${errorMessage}`);
  }

  return {
    postId,
    externalId,
    externalUrl,
    status,
    errorMessage
  };
}

/**
 * X (Twitter) publishing adapter.
 * Uses OAuth 1.0a with API key/secret + access token/secret.
 * Posts via Twitter API v2 — 280 char limit enforced.
 */
export async function publishToX(
  queryFn: (text: string, params?: any[]) => Promise<{ rows: any[] }>,
  accountId: number,
  content: CanonicalContent
): Promise<AdapterResult> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error("TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, or TWITTER_ACCESS_TOKEN_SECRET not set");
  }

  const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret });

  const campaign = `issue-${content.id}`;
  const slug = slugify(content.title);
  const webLink = `https://sailsouthern.com/daily/${content.id}?utm_source=sailsouthern&utm_medium=twitter&utm_campaign=${campaign}&utm_content=${slug}`;

  // 280 char limit: reserve ~25 for the t.co-wrapped URL + newline
  const maxBody = 280 - 25 - 2;
  const header = `🗞️ ${content.title}`;
  const snippet = content.text.slice(0, maxBody - header.length - 5).trimEnd();
  const tweetText = `${header}\n\n${snippet}…\n\n${webLink}`.slice(0, 280);

  let externalId: string | null = null;
  let externalUrl: string | null = null;
  let status: "success" | "failed" = "success";
  let errorMessage: string | null = null;

  try {
    const { data } = await client.v2.tweet(tweetText);
    externalId = data.id;
    externalUrl = `https://x.com/i/web/status/${data.id}`;
  } catch (err: any) {
    status = "failed";
    errorMessage = err.message || String(err);
  }

  const payload: ArchivePostPayload = {
    content_text: tweetText,
    title: content.title,
    linked_entity_type: content.type,
    linked_entity_id: String(content.id),
    metadata: { platform_limit: 280, char_count: tweetText.length },
    provenance_rights: { license: "all_rights_reserved", rights_holder: "Sailing Almanac" },
    media: content.mediaUrls?.map(url => ({ media_url: url, media_type: "image/jpeg" })) || [],
    links: [{ url: webLink }, ...(content.links?.map(url => ({ url })) || [])],
    deliveries: [{
      account_id: accountId,
      platform: "twitter",
      external_id: externalId,
      external_url: externalUrl,
      status,
      error_message: errorMessage,
      delivered_at: status === "success" ? new Date() : null
    }]
  };

  const { postId } = await archiveOutboundPost(queryFn, payload);

  if (status === "failed") {
    throw new Error(`X publishing failed: ${errorMessage}`);
  }

  return { postId, externalId, externalUrl, status, errorMessage };
}
