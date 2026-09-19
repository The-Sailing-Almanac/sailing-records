import { logger } from "@stax/logger";
import dotenv from "dotenv";

dotenv.config();

/**
 * Publishes a status update to the configured Mastodon instance.
 * Reads MASTODON_INSTANCE_URL and MASTODON_ACCESS_TOKEN from environment.
 * 
 * @param text The status update body (supports basic HTML tags and mentions/tags)
 * @returns Promise resolving to the status response or null if unconfigured/failed
 */
export async function publishMastodonStatus(text: string): Promise<any> {
  const instanceUrl = process.env.MASTODON_INSTANCE_URL;
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;

  if (!instanceUrl || !accessToken) {
    logger.warn("[Mastodon Publisher] Skipper: MASTODON_INSTANCE_URL or MASTODON_ACCESS_TOKEN not set in environment.");
    return null;
  }

  const endpoint = `${instanceUrl.replace(/\/$/, "")}/api/v1/statuses`;
  logger.info(`[Mastodon Publisher] Publishing status to ${endpoint}...`);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        status: text,
        visibility: "public"
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Mastodon API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    logger.info(`[Mastodon Publisher] Status published successfully! ID: ${data.id}, URL: ${data.url}`);
    return data;
  } catch (error) {
    logger.error("[Mastodon Publisher] Failed to publish status:", error);
    return null;
  }
}
