/**
 * Script: test-wayback-auth.ts
 * Purpose: Smoke test for authenticated Wayback SPN requests.
 * Safe to run anytime — submits a single low-priority capture of sailsouthern.com.
 * Does NOT write to DB — pure network test.
 */
import dotenv from "dotenv";
dotenv.config();

const TEST_URL = process.argv[2] || "https://sailsouthern.com";

async function main() {
  const accessKey = process.env.WAYBACK_ACCESS_KEY;
  const secretKey = process.env.WAYBACK_SECRET_KEY;
  const authMode = accessKey && secretKey ? "AUTHENTICATED" : "ANONYMOUS";

  console.log("\n[SPN Smoke Test]");
  console.log(`  URL:       ${TEST_URL}`);
  console.log(`  Auth mode: ${authMode}`);
  console.log(`  Access key present: ${!!accessKey}`);
  console.log(`  Secret key present: ${!!secretKey}`);
  console.log("");

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json",
  };

  if (accessKey && secretKey) {
    headers["Authorization"] = `LOW ${accessKey}:${secretKey}`;
  }

  console.log("[SPN Smoke Test] Submitting capture request...");
  const startMs = Date.now();

  const res = await fetch("https://web.archive.org/save/", {
    method: "POST",
    headers,
    body: new URLSearchParams({ url: TEST_URL }),
  });

  const elapsed = Date.now() - startMs;
  console.log(`[SPN Smoke Test] HTTP ${res.status} ${res.statusText} in ${elapsed}ms`);

  const location = res.headers.get("location") || res.headers.get("content-location") || "";
  const body = await res.text().catch(() => "");

  if (res.ok || res.status === 200) {
    const archiveUrl = location || `https://web.archive.org/web/*/${TEST_URL}`;
    console.log(`[SPN Smoke Test] ✅ SUCCESS`);
    console.log(`  Archive URL: ${archiveUrl}`);
    console.log(`  Auth mode:   ${authMode}`);
  } else if (res.status === 401 || res.status === 403) {
    console.log(`[SPN Smoke Test] ❌ AUTH FAILURE — credentials may be invalid`);
    console.log(`  Response body: ${body.substring(0, 300)}`);
  } else if (res.status === 429) {
    console.log(`[SPN Smoke Test] ⚠️  RATE LIMITED (429) — ${authMode} rate limits apply`);
    console.log(`  Retry-After: ${res.headers.get("retry-after") || "not specified"}`);
  } else {
    console.log(`[SPN Smoke Test] ❌ UNEXPECTED STATUS ${res.status}`);
    console.log(`  Response body: ${body.substring(0, 300)}`);
  }

  setImmediate(() => process.exit(0));
}

main().catch((err) => {
  console.error("[SPN Smoke Test] Fatal error:", err);
  process.exit(1);
});
