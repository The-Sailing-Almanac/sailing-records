import { Relay } from "nostr-tools/relay";
import dotenv from "dotenv";
import { broadcastAlert } from "./lib/notifications";
import { logger } from "@stax/logger";

dotenv.config();

const webBaseUrl = process.env.WEB_BASE_URL || "https://sailsouthern.com";
const mastodonInstanceUrl = process.env.MASTODON_INSTANCE_URL || "https://social.sailingalmanac.org";
const nostrRelays = (process.env.NOSTR_RELAYS || "wss://relay.damus.io,wss://nos.lol").split(",");

interface HealthCheckResult {
  service: string;
  status: "OK" | "WARN" | "FAIL";
  message: string;
  details?: any;
}

/**
 * 1. Checks if the compiled newsletter archive page has valid Open Graph / social meta tags.
 */
async function checkOpenGraphTags(): Promise<HealthCheckResult> {
  const checkUrl = `${webBaseUrl}/daily/2026-05-28`;
  logger.info(`[Monitor] Checking Open Graph tags on ${checkUrl}...`);
  try {
    const response = await fetch(checkUrl);
    if (!response.ok) {
      return {
        service: "OpenGraph Page Crawl",
        status: "WARN",
        message: `HTTP Status ${response.status} returned by page: ${checkUrl}`,
      };
    }
    const html = await response.text();
    const missing: string[] = [];

    if (!html.includes('property="og:title"') && !html.includes("property='og:title'")) missing.push("og:title");
    if (!html.includes('property="og:description"') && !html.includes("property='og:description'")) missing.push("og:description");
    if (!html.includes('property="og:image"') && !html.includes("property='og:image'")) missing.push("og:image");
    if (!html.includes('name="twitter:card"') && !html.includes("name='twitter:card'")) missing.push("twitter:card");

    if (missing.length > 0) {
      return {
        service: "OpenGraph Page Crawl",
        status: "FAIL",
        message: `Missing critical social meta tags: ${missing.join(", ")}`,
      };
    }

    return {
      service: "OpenGraph Page Crawl",
      status: "OK",
      message: "All critical social meta tags are present.",
    };
  } catch (err: any) {
    return {
      service: "OpenGraph Page Crawl",
      status: "FAIL",
      message: `Failed to fetch page: ${err.message}`,
    };
  }
}

/**
 * 2. Checks Nostr relay connections.
 */
async function checkNostrRelays(): Promise<HealthCheckResult> {
  logger.info("[Monitor] Checking Nostr relay connectivity...");
  const failures: string[] = [];
  
  for (const url of nostrRelays) {
    try {
      const relay = await Relay.connect(url);
      relay.close();
    } catch (err: any) {
      failures.push(`${url} (${err.message})`);
    }
  }

  if (failures.length === nostrRelays.length) {
    return {
      service: "Nostr Relays",
      status: "FAIL",
      message: "All Nostr relays failed to connect.",
      details: failures,
    };
  }

  if (failures.length > 0) {
    return {
      service: "Nostr Relays",
      status: "WARN",
      message: `${failures.length} of ${nostrRelays.length} relays failed to connect.`,
      details: failures,
    };
  }

  return {
    service: "Nostr Relays",
    status: "OK",
    message: `Connected successfully to all ${nostrRelays.length} relays.`,
  };
}

/**
 * 3. Checks Mastodon instance health.
 */
async function checkMastodonInstance(): Promise<HealthCheckResult> {
  const endpoint = `${mastodonInstanceUrl.replace(/\/$/, "")}/api/v1/instance`;
  logger.info(`[Monitor] Checking Mastodon instance status at ${endpoint}...`);
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      return {
        service: "Mastodon Instance",
        status: "FAIL",
        message: `Mastodon instance returned HTTP status ${response.status}`,
      };
    }
    const data = await response.json();
    return {
      service: "Mastodon Instance",
      status: "OK",
      message: `Instance online. Version: ${data.version || "unknown"}`,
    };
  } catch (err: any) {
    return {
      service: "Mastodon Instance",
      status: "FAIL",
      message: `Failed to query Mastodon API: ${err.message}`,
    };
  }
}

/**
 * 4. Parses GitHub release logs for Mastodon to alert on breaking changes.
 */
async function checkUpstreamReleases(): Promise<HealthCheckResult> {
  const feedUrl = "https://github.com/mastodon/mastodon/releases.atom";
  logger.info("[Monitor] Fetching Mastodon upstream release log...");
  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      return {
        service: "Mastodon Upstream Releases",
        status: "WARN",
        message: `Failed to fetch Mastodon release feed. HTTP status: ${response.status}`,
      };
    }
    const xml = await response.text();
    
    // Quick and light string search for breaking changes in the latest release entry
    const entries = xml.split("<entry>");
    if (entries.length < 2) {
      return {
        service: "Mastodon Upstream Releases",
        status: "OK",
        message: "No releases found in feed.",
      };
    }

    const latestEntry = entries[1]; // First entry is the latest
    const titleMatch = latestEntry.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1] : "Unknown version";

    const contentMatch = latestEntry.match(/<content[^>]*>([\s\S]*?)<\/content>/);
    const content = contentMatch ? contentMatch[1].toLowerCase() : "";

    const keywords = ["breaking", "security", "deprecate", "critical", "vulnerability"];
    const foundKeywords = keywords.filter(kw => content.includes(kw));

    if (foundKeywords.length > 0) {
      return {
        service: "Mastodon Upstream Releases",
        status: "WARN",
        message: `Latest release ${title} contains breaking/security keywords: ${foundKeywords.join(", ")}`,
      };
    }

    return {
      service: "Mastodon Upstream Releases",
      status: "OK",
      message: `Latest release ${title} parsed. No breaking keywords found.`,
    };
  } catch (err: any) {
    return {
      service: "Mastodon Upstream Releases",
      status: "WARN",
      message: `Failed to check release logs: ${err.message}`,
    };
  }
}

async function runMonitor() {
  logger.info("[Monitor] Starting Social & API Integrations Health Check...");
  const results: HealthCheckResult[] = [
    await checkOpenGraphTags(),
    await checkNostrRelays(),
    await checkMastodonInstance(),
    await checkUpstreamReleases(),
  ];

  let overallStatus = "OK";
  const fields = results.map(res => {
    let emoji = "🟢";
    if (res.status === "WARN") {
      emoji = "⚠️";
      if (overallStatus !== "FAIL") overallStatus = "WARN";
    } else if (res.status === "FAIL") {
      emoji = "🔴";
      overallStatus = "FAIL";
    }

    return {
      name: `${emoji} ${res.service}`,
      value: `${res.message}${res.details ? `\nDetails: ${JSON.stringify(res.details)}` : ""}`,
      inline: false,
    };
  });

  logger.info(`[Monitor] Health check complete. Overall status: ${overallStatus}`);

  if (overallStatus !== "OK") {
    const color = overallStatus === "FAIL" ? "FF0000" : "FFA500";
    await broadcastAlert({
      title: `🚨 Social Integrations Monitor Status: ${overallStatus}`,
      text: `Health checks detected warnings or failures in external integrations.`,
      fields,
      color,
    });
  }
}

runMonitor().catch(err => {
  logger.error("[Monitor] Fatal monitoring execution failure:", err);
});
