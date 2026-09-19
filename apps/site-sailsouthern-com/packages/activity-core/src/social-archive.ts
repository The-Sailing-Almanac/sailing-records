export interface ArchivePostPayload {
  content_text: string;
  title?: string | null;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  metadata?: Record<string, any>;
  provenance_rights?: Record<string, any>;
  media?: Array<{
    media_url: string;
    media_type: string;
    alt_text?: string | null;
  }>;
  links?: Array<{
    url: string;
    short_url?: string | null;
  }>;
  deliveries?: Array<{
    account_id: number;
    platform: string;
    external_id?: string | null;
    external_url?: string | null;
    status: string;
    error_message?: string | null;
    delivered_at?: Date | null;
  }>;
}

/**
 * Inserts an outbound social post and its associated metadata (media, links, deliveries)
 * using a provided query runner callback function.
 * 
 * @param queryFn A callback that executes queries against the DB.
 * @param payload The outbound post payload data.
 */
export async function archiveOutboundPost(
  queryFn: (text: string, params?: any[]) => Promise<{ rows: any[] }>,
  payload: ArchivePostPayload
): Promise<{ postId: number; deliveryIds: number[] }> {
  // 1. Insert social_posts
  const postRes = await queryFn(
    `INSERT INTO social_posts (content_text, title, linked_entity_type, linked_entity_id, metadata, provenance_rights)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      payload.content_text,
      payload.title ?? null,
      payload.linked_entity_type ?? null,
      payload.linked_entity_id ?? null,
      payload.metadata ? JSON.stringify(payload.metadata) : '{}',
      payload.provenance_rights ? JSON.stringify(payload.provenance_rights) : '{"license": "all_rights_reserved"}'
    ]
  );
  
  if (!postRes.rows || postRes.rows.length === 0) {
    throw new Error("Failed to insert social_posts record");
  }
  const postId = postRes.rows[0].id;

  // 2. Insert media
  if (payload.media && payload.media.length > 0) {
    for (const item of payload.media) {
      await queryFn(
        `INSERT INTO social_post_media (post_id, media_url, media_type, alt_text)
         VALUES ($1, $2, $3, $4)`,
        [postId, item.media_url, item.media_type, item.alt_text ?? null]
      );
    }
  }

  // 3. Insert links
  if (payload.links && payload.links.length > 0) {
    for (const item of payload.links) {
      await queryFn(
        `INSERT INTO social_post_links (post_id, url, short_url)
         VALUES ($1, $2, $3)`,
        [postId, item.url, item.short_url ?? null]
      );
    }
  }

  // 4. Insert deliveries
  const deliveryIds: number[] = [];
  if (payload.deliveries && payload.deliveries.length > 0) {
    for (const item of payload.deliveries) {
      const delRes = await queryFn(
        `INSERT INTO social_post_deliveries (post_id, account_id, platform, external_id, external_url, status, error_message, delivered_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          postId,
          item.account_id,
          item.platform,
          item.external_id ?? null,
          item.external_url ?? null,
          item.status,
          item.error_message ?? null,
          item.delivered_at ? new Date(item.delivered_at) : null
        ]
      );
      if (delRes.rows && delRes.rows.length > 0) {
        deliveryIds.push(delRes.rows[0].id);
      }
    }
  }

  return { postId, deliveryIds };
}

export interface CanonicalMicroNewsletter {
  title: string;
  summary: string;
  key_links: Array<{ label?: string; url: string }>;
  call_to_action?: string | null;
  tags?: string[] | null;
}

export function renderMastodon(news: CanonicalMicroNewsletter): string {
  let text = `🗞️ ${news.title}\n\n${news.summary}`;
  if (news.key_links && news.key_links.length > 0) {
    text += "\n\nRead more:\n" + news.key_links.map(l => l.label ? `${l.label}: ${l.url}` : l.url).join("\n");
  }
  if (news.call_to_action) {
    text += `\n\n${news.call_to_action}`;
  }
  if (news.tags && news.tags.length > 0) {
    text += "\n\n" + news.tags.map(t => `#${t.replace(/#/g, "").toLowerCase()}`).join(" ");
  }
  if (text.length > 500) {
    text = text.slice(0, 497) + "...";
  }
  return text;
}

export function renderNostr(news: CanonicalMicroNewsletter): { content: string; tags: string[][] } {
  let content = `🗞️ ${news.title}\n\n${news.summary}`;
  if (news.key_links && news.key_links.length > 0) {
    content += "\n\nRead more:\n" + news.key_links.map(l => l.label ? `${l.label}: ${l.url}` : l.url).join("\n");
  }
  if (news.call_to_action) {
    content += `\n\n${news.call_to_action}`;
  }
  const tags: string[][] = [];
  if (news.tags && news.tags.length > 0) {
    for (const t of news.tags) {
      tags.push(["t", t.replace(/#/g, "").toLowerCase()]);
    }
  }
  return { content, tags };
}

export function renderBluesky(news: CanonicalMicroNewsletter): string {
  let text = `🗞️ ${news.title}\n\n${news.summary}`;
  const mainLink = news.key_links?.[0]?.url;
  if (mainLink) {
    text += `\n\nRead: ${mainLink}`;
  }
  if (news.call_to_action) {
    text += `\n\n${news.call_to_action}`;
  }
  if (news.tags && news.tags.length > 0) {
    text += "\n\n" + news.tags.map(t => `#${t.replace(/#/g, "").toLowerCase()}`).join(" ");
  }
  if (text.length > 300) {
    text = text.slice(0, 297) + "...";
  }
  return text;
}

