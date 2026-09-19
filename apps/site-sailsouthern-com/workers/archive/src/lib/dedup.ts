import { createHash } from "crypto";

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hostname = u.hostname.toLowerCase();
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "ref" || key === "source") {
        u.searchParams.delete(key);
      }
    }
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function generateUrlHash(url: string): string {
  return createHash("sha256").update(normalizeUrl(url)).digest("hex");
}

type QueryFn = (sql: string, params: unknown[]) => Promise<{ rows: Array<{ exists: boolean }> }>;

export async function isKnownUrl(url: string, query: QueryFn): Promise<boolean> {
  const hash = generateUrlHash(url);
  const res = await query(
    "SELECT EXISTS(SELECT 1 FROM article_links WHERE url_hash = $1) AS exists",
    [hash]
  );
  return res.rows[0]?.exists === true;
}
