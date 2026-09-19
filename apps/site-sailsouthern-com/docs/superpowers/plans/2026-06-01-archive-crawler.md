# Archive Crawler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a continuous archive crawler worker that discovers articles via sitemaps and pagination, extracts full text, stores to Backblaze B2, and feeds the existing Gemini + entity + SPN pipeline.

**Architecture:** New `workers/archive/` BullMQ worker with two queues (`archive-discovery`, `archive-fetch`). Discovery enqueues URLs after deduplication; fetch pulls articles, extracts text, writes to B2, upserts `article_links`, and enqueues to the existing `wayback-spn` queue. Downstream workers (Gemini enrichment, entity extractor, Meilisearch) pick up new rows automatically.

**Tech Stack:** TypeScript, BullMQ, Cheerio, fast-xml-parser, franc-min, ioredis, pg, @aws-sdk/client-s3, vitest

---

## Task 1: DB Migration

**Files:**
- Create: `infra/db/migrations/036_archive_crawler.sql`

- [ ] **Write the migration**

```sql
-- infra/db/migrations/036_archive_crawler.sql

ALTER TABLE article_links
  ADD COLUMN IF NOT EXISTS full_text_b2_key   TEXT,
  ADD COLUMN IF NOT EXISTS full_text_language TEXT,
  ADD COLUMN IF NOT EXISTS full_text_status   TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS crawler_source     TEXT NOT NULL DEFAULT 'feed',
  ADD COLUMN IF NOT EXISTS content_type       TEXT NOT NULL DEFAULT 'article';

ALTER TABLE article_links
  ADD CONSTRAINT chk_full_text_status
    CHECK (full_text_status IN ('pending','extracted','paywalled','failed')),
  ADD CONSTRAINT chk_content_type
    CHECK (content_type IN ('article','video','race_result','podcast'));

CREATE INDEX IF NOT EXISTS idx_article_links_full_text_status
  ON article_links (full_text_status)
  WHERE full_text_status = 'pending';

CREATE TABLE IF NOT EXISTS archive_domain_configs (
  id                    SERIAL PRIMARY KEY,
  domain                TEXT UNIQUE NOT NULL,
  tier                  SMALLINT NOT NULL DEFAULT 2,
  languages             TEXT[] DEFAULT '{en}',
  rate_limit_ms         INTEGER DEFAULT 3000,
  sitemap_urls          TEXT[],
  pagination_pattern    JSONB,
  article_link_selector TEXT,
  is_paywalled          BOOLEAN DEFAULT FALSE,
  is_active             BOOLEAN DEFAULT TRUE,
  engagement_score      FLOAT DEFAULT 0.0,
  crawl_priority        SMALLINT DEFAULT 5,
  last_crawled_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archive_crawl_runs (
  id               SERIAL PRIMARY KEY,
  domain           TEXT NOT NULL,
  run_type         TEXT NOT NULL,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  urls_discovered  INTEGER DEFAULT 0,
  urls_new         INTEGER DEFAULT 0,
  urls_skipped     INTEGER DEFAULT 0,
  urls_failed      INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'running'
);
```

- [ ] **Apply to production**

```bash
ssh -i ~/.ssh/id_proart aewoodyard@chantecler-01 \
  "cd ~/ss-sailsouthern-com && npm run migrate -- 036_archive_crawler.sql"
```
Expected output: `[Migration] Applied 036_archive_crawler.sql successfully.`

- [ ] **Apply to staging**

```bash
ssh -i ~/.ssh/id_proart aewoodyard@chantecler-01 \
  "cd ~/ss-sailsouthern-com && DATABASE_URL=<redacted> npm run migrate -- 036_archive_crawler.sql"
```

- [ ] **Commit**

```bash
git add infra/db/migrations/036_archive_crawler.sql
git commit -m "feat(db): add archive crawler columns and tables (migration 036)"
```

---

## Task 2: Worker Package Scaffold

**Files:**
- Create: `workers/archive/package.json`
- Create: `workers/archive/tsconfig.json`
- Create: `workers/archive/src/__tests__/.gitkeep`

- [ ] **Create package.json**

```json
{
  "name": "@sailsouthern/archive-worker",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev":   "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test":  "vitest run"
  },
  "dependencies": {
    "@almanac/types":       "*",
    "@aws-sdk/client-s3":  "^3.1055.0",
    "bullmq":              "^5.7.8",
    "cheerio":             "^1.2.0",
    "dotenv":              "^16.4.5",
    "fast-xml-parser":     "^4.4.1",
    "franc-min":           "^6.2.0",
    "ioredis":             "^5.4.1",
    "pg":                  "^8.11.5"
  },
  "devDependencies": {
    "@types/node":  "^20",
    "@types/pg":    "^8.11.6",
    "tsx":          "^4.11.0",
    "typescript":   "^5.4.5",
    "vitest":       "^2.0.0"
  }
}
```

- [ ] **Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Install dependencies**

```bash
cd workers/archive && npm install
```
Expected: `node_modules/` populated, no errors.

- [ ] **Create test placeholder**

```bash
mkdir -p workers/archive/src/__tests__
touch workers/archive/src/__tests__/.gitkeep
```

- [ ] **Commit**

```bash
git add workers/archive/
git commit -m "feat(archive): scaffold worker package"
```

---

## Task 3: Rate Limiter

**Files:**
- Create: `workers/archive/src/lib/rate-limiter.ts`
- Create: `workers/archive/src/__tests__/rate-limiter.test.ts`

- [ ] **Write the failing test**

```typescript
// workers/archive/src/__tests__/rate-limiter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DomainRateLimiter } from "../lib/rate-limiter.js";

describe("DomainRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns immediately on first call for a domain", async () => {
    const limiter = new DomainRateLimiter();
    const start = Date.now();
    await limiter.wait("example.com", 1000);
    expect(Date.now() - start).toBeLessThan(100);
  });

  it("delays subsequent calls by at least rate_limit_ms", async () => {
    const limiter = new DomainRateLimiter();
    await limiter.wait("example.com", 1000);
    const waitPromise = limiter.wait("example.com", 1000);
    vi.advanceTimersByTime(1200);
    await waitPromise;
  });

  it("tracks different domains independently", async () => {
    const limiter = new DomainRateLimiter();
    await limiter.wait("site-a.com", 1000);
    await limiter.wait("site-b.com", 1000); // should not delay
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
cd workers/archive && npx vitest run src/__tests__/rate-limiter.test.ts
```
Expected: FAIL — `DomainRateLimiter` not found.

- [ ] **Implement the rate limiter**

```typescript
// workers/archive/src/lib/rate-limiter.ts

export class DomainRateLimiter {
  private lastCallAt = new Map<string, number>();

  async wait(domain: string, rateLimitMs: number): Promise<void> {
    const last = this.lastCallAt.get(domain);
    const now = Date.now();

    if (last !== undefined) {
      const jitter = rateLimitMs * 0.2 * (Math.random() * 2 - 1); // ±20%
      const delay = rateLimitMs + jitter - (now - last);
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.lastCallAt.set(domain, Date.now());
  }
}
```

- [ ] **Run test to confirm it passes**

```bash
cd workers/archive && npx vitest run src/__tests__/rate-limiter.test.ts
```
Expected: PASS — 3 tests.

- [ ] **Commit**

```bash
git add workers/archive/src/lib/rate-limiter.ts workers/archive/src/__tests__/rate-limiter.test.ts
git commit -m "feat(archive): per-domain rate limiter with jitter"
```

---

## Task 4: Robots.txt Checker

**Files:**
- Create: `workers/archive/src/lib/robots.ts`
- Create: `workers/archive/src/__tests__/robots.test.ts`

- [ ] **Write the failing test**

```typescript
// workers/archive/src/__tests__/robots.test.ts
import { describe, it, expect, vi } from "vitest";
import { RobotsChecker } from "../lib/robots.js";

const ALLOW_ALL = "User-agent: *\nAllow: /";
const DISALLOW_NEWS = "User-agent: *\nDisallow: /news/";
const BLOCK_CRAWLER = "User-agent: SailingAlmanac-Crawler\nDisallow: /";

describe("RobotsChecker", () => {
  it("allows all paths when robots.txt permits everything", async () => {
    const checker = new RobotsChecker();
    vi.spyOn(checker as any, "fetchRobotsTxt").mockResolvedValue(ALLOW_ALL);
    expect(await checker.isAllowed("example.com", "/articles/test")).toBe(true);
  });

  it("blocks disallowed paths", async () => {
    const checker = new RobotsChecker();
    vi.spyOn(checker as any, "fetchRobotsTxt").mockResolvedValue(DISALLOW_NEWS);
    expect(await checker.isAllowed("example.com", "/news/article")).toBe(false);
    expect(await checker.isAllowed("example.com", "/about")).toBe(true);
  });

  it("blocks paths disallowed specifically for our crawler", async () => {
    const checker = new RobotsChecker();
    vi.spyOn(checker as any, "fetchRobotsTxt").mockResolvedValue(BLOCK_CRAWLER);
    expect(await checker.isAllowed("example.com", "/any/path")).toBe(false);
  });

  it("allows all paths when robots.txt fetch fails", async () => {
    const checker = new RobotsChecker();
    vi.spyOn(checker as any, "fetchRobotsTxt").mockRejectedValue(new Error("404"));
    expect(await checker.isAllowed("example.com", "/articles/test")).toBe(true);
  });

  it("caches robots.txt per domain", async () => {
    const checker = new RobotsChecker();
    const spy = vi.spyOn(checker as any, "fetchRobotsTxt").mockResolvedValue(ALLOW_ALL);
    await checker.isAllowed("example.com", "/a");
    await checker.isAllowed("example.com", "/b");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
cd workers/archive && npx vitest run src/__tests__/robots.test.ts
```
Expected: FAIL.

- [ ] **Implement the robots checker**

```typescript
// workers/archive/src/lib/robots.ts

const USER_AGENT = "SailingAlmanac-Crawler";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  rules: Array<{ userAgent: string; disallow: string[] }>;
  fetchedAt: number;
}

export class RobotsChecker {
  private cache = new Map<string, CacheEntry>();

  private async fetchRobotsTxt(domain: string): Promise<string> {
    const res = await fetch(`https://${domain}/robots.txt`, {
      headers: { "User-Agent": `${USER_AGENT}/1.0` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`robots.txt fetch failed: ${res.status}`);
    return res.text();
  }

  private parse(txt: string): CacheEntry["rules"] {
    const rules: CacheEntry["rules"] = [];
    let currentAgents: string[] = [];
    let currentDisallow: string[] = [];

    for (const raw of txt.split("\n")) {
      const line = raw.trim();
      if (line.startsWith("User-agent:")) {
        if (currentAgents.length && currentDisallow.length) {
          rules.push({ userAgent: currentAgents.join(","), disallow: currentDisallow });
        }
        currentAgents = [line.split(":")[1].trim()];
        currentDisallow = [];
      } else if (line.startsWith("Disallow:")) {
        const path = line.split(":")[1].trim();
        if (path) currentDisallow.push(path);
      }
    }
    if (currentAgents.length) {
      rules.push({ userAgent: currentAgents.join(","), disallow: currentDisallow });
    }
    return rules;
  }

  private matches(ruleAgent: string, path: string, disallow: string[]): boolean {
    const relevant =
      ruleAgent === "*" ||
      ruleAgent.toLowerCase().includes(USER_AGENT.toLowerCase());
    if (!relevant) return false;
    return disallow.some(d => path.startsWith(d));
  }

  async isAllowed(domain: string, path: string): Promise<boolean> {
    const cached = this.cache.get(domain);
    const now = Date.now();

    let entry: CacheEntry;
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      entry = cached;
    } else {
      try {
        const txt = await this.fetchRobotsTxt(domain);
        entry = { rules: this.parse(txt), fetchedAt: now };
        this.cache.set(domain, entry);
      } catch {
        return true; // fail open
      }
    }

    return !entry.rules.some(r => this.matches(r.userAgent, path, r.disallow));
  }
}
```

- [ ] **Run test to confirm it passes**

```bash
cd workers/archive && npx vitest run src/__tests__/robots.test.ts
```
Expected: PASS — 5 tests.

- [ ] **Commit**

```bash
git add workers/archive/src/lib/robots.ts workers/archive/src/__tests__/robots.test.ts
git commit -m "feat(archive): robots.txt checker with 24h domain cache"
```

---

## Task 5: URL Dedup

**Files:**
- Create: `workers/archive/src/lib/dedup.ts`
- Create: `workers/archive/src/__tests__/dedup.test.ts`

- [ ] **Write the failing test**

```typescript
// workers/archive/src/__tests__/dedup.test.ts
import { describe, it, expect, vi } from "vitest";
import { normalizeUrl, generateUrlHash, isKnownUrl } from "../lib/dedup.js";

describe("normalizeUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeUrl("https://example.com/article/")).toBe("https://example.com/article");
  });
  it("strips utm parameters", () => {
    expect(normalizeUrl("https://example.com/a?utm_source=x&utm_medium=y")).toBe("https://example.com/a");
  });
  it("lowercases the host", () => {
    expect(normalizeUrl("https://Example.COM/path")).toBe("https://example.com/path");
  });
});

describe("generateUrlHash", () => {
  it("returns a 64-char hex string", () => {
    const hash = generateUrlHash("https://example.com/article");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("is deterministic", () => {
    const url = "https://example.com/article";
    expect(generateUrlHash(url)).toBe(generateUrlHash(url));
  });
});

describe("isKnownUrl", () => {
  it("returns true when url_hash exists in article_links", async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [{ exists: true }] });
    expect(await isKnownUrl("https://example.com/a", mockQuery)).toBe(true);
  });
  it("returns false when url_hash does not exist", async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [{ exists: false }] });
    expect(await isKnownUrl("https://example.com/b", mockQuery)).toBe(false);
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
cd workers/archive && npx vitest run src/__tests__/dedup.test.ts
```
Expected: FAIL.

- [ ] **Implement dedup**

```typescript
// workers/archive/src/lib/dedup.ts
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
```

- [ ] **Run test to confirm it passes**

```bash
cd workers/archive && npx vitest run src/__tests__/dedup.test.ts
```
Expected: PASS — 6 tests.

- [ ] **Commit**

```bash
git add workers/archive/src/lib/dedup.ts workers/archive/src/__tests__/dedup.test.ts
git commit -m "feat(archive): url normalisation, hashing, and dedup check"
```

---

## Task 6: Language Detection

**Files:**
- Create: `workers/archive/src/lib/language-detect.ts`
- Create: `workers/archive/src/__tests__/language-detect.test.ts`

- [ ] **Write the failing test**

```typescript
// workers/archive/src/__tests__/language-detect.test.ts
import { describe, it, expect } from "vitest";
import { detectLanguage } from "../lib/language-detect.js";

describe("detectLanguage", () => {
  it("detects English", () => {
    expect(detectLanguage(
      "The race started at dawn with fifteen boats competing for the championship trophy.",
      {}
    )).toBe("en");
  });

  it("detects Italian", () => {
    expect(detectLanguage(
      "La regata è iniziata all'alba con quindici barche in gara per il trofeo.",
      {}
    )).toBe("it");
  });

  it("detects German", () => {
    expect(detectLanguage(
      "Das Rennen begann bei Tagesanbruch mit fünfzehn Booten, die um die Meisterschaft kämpften.",
      {}
    )).toBe("de");
  });

  it("prefers hreflang hint over body detection", () => {
    expect(detectLanguage("hello world", { hreflang: "fr" })).toBe("fr");
  });

  it("falls back to TLD hint when body is too short", () => {
    expect(detectLanguage("sail", { tld: "de" })).toBe("de");
  });

  it("defaults to en when detection is uncertain", () => {
    expect(detectLanguage("", {})).toBe("en");
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
cd workers/archive && npx vitest run src/__tests__/language-detect.test.ts
```
Expected: FAIL.

- [ ] **Implement language detection**

```typescript
// workers/archive/src/lib/language-detect.ts
import { franc } from "franc-min";

const TLD_LANG_MAP: Record<string, string> = {
  de: "de", it: "it", es: "es", fr: "fr",
  au: "en", nz: "en", uk: "en", ie: "en",
};

const FRANC_ISO3_TO_ISO1: Record<string, string> = {
  eng: "en", ita: "it", deu: "de", spa: "es", fra: "fr",
};

const SUPPORTED = new Set(["en", "it", "de", "es", "fr"]);

interface Hints {
  hreflang?: string;
  tld?: string;
}

export function detectLanguage(text: string, hints: Hints): string {
  // Hint 1: explicit hreflang
  if (hints.hreflang) {
    const lang = hints.hreflang.slice(0, 2).toLowerCase();
    if (SUPPORTED.has(lang)) return lang;
  }

  // Hint 2: franc on body text (needs ≥20 chars to be reliable)
  if (text.length >= 20) {
    const iso3 = franc(text, { minLength: 20 });
    const lang = FRANC_ISO3_TO_ISO1[iso3];
    if (lang && SUPPORTED.has(lang)) return lang;
  }

  // Hint 3: TLD
  if (hints.tld) {
    const lang = TLD_LANG_MAP[hints.tld.toLowerCase()];
    if (lang && SUPPORTED.has(lang)) return lang;
  }

  return "en";
}
```

- [ ] **Run test to confirm it passes**

```bash
cd workers/archive && npx vitest run src/__tests__/language-detect.test.ts
```
Expected: PASS — 6 tests.

- [ ] **Commit**

```bash
git add workers/archive/src/lib/language-detect.ts workers/archive/src/__tests__/language-detect.test.ts
git commit -m "feat(archive): language detection — franc-min with hreflang/TLD fallback"
```

---

## Task 7: Text Extractor

**Files:**
- Create: `workers/archive/src/text-extractor.ts`
- Create: `workers/archive/src/__tests__/text-extractor.test.ts`

- [ ] **Write the failing test**

```typescript
// workers/archive/src/__tests__/text-extractor.test.ts
import { describe, it, expect } from "vitest";
import { extractArticle } from "../text-extractor.js";

const FULL_ARTICLE_HTML = `
<html>
<head>
  <title>J/70 Worlds Day 3</title>
  <meta property="og:description" content="Day three of the J/70 World Championship." />
  <meta property="og:image" content="https://example.com/img.jpg" />
  <script type="application/ld+json">
    {"@type":"NewsArticle","datePublished":"2025-06-15T09:00:00Z","author":{"name":"Jane Doe"}}
  </script>
</head>
<body>
  <nav>Nav links here</nav>
  <article>
    <h1>J/70 Worlds Day 3</h1>
    <p>Racing continued today with strong winds from the southwest.</p>
    <p>The American team extended their lead after three races.</p>
  </article>
  <footer>Footer content</footer>
</body>
</html>`;

const PAYWALLED_HTML = `
<html><body>
  <script type="application/ld+json">{"isAccessibleForFree":"False"}</script>
  <article><p>Subscribe to read this article.</p></article>
</body></html>`;

describe("extractArticle", () => {
  it("extracts title from og:title or <title>", () => {
    const result = extractArticle(FULL_ARTICLE_HTML, "https://example.com/article");
    expect(result.title).toBe("J/70 Worlds Day 3");
  });

  it("extracts body text from <article> element", () => {
    const result = extractArticle(FULL_ARTICLE_HTML, "https://example.com/article");
    expect(result.text_extracted).toContain("Racing continued today");
    expect(result.text_extracted).not.toContain("Nav links");
    expect(result.text_extracted).not.toContain("Footer content");
  });

  it("extracts published_at from schema.org JSON-LD", () => {
    const result = extractArticle(FULL_ARTICLE_HTML, "https://example.com/article");
    expect(result.published_at).toBe("2025-06-15T09:00:00Z");
  });

  it("extracts author from schema.org", () => {
    const result = extractArticle(FULL_ARTICLE_HTML, "https://example.com/article");
    expect(result.author).toBe("Jane Doe");
  });

  it("extracts og:image", () => {
    const result = extractArticle(FULL_ARTICLE_HTML, "https://example.com/article");
    expect(result.og_image).toBe("https://example.com/img.jpg");
  });

  it("detects paywalled content via schema.org isAccessibleForFree", () => {
    const result = extractArticle(PAYWALLED_HTML, "https://example.com/locked");
    expect(result.is_paywalled).toBe(true);
  });

  it("detects paywalled content by short word count", () => {
    const shortHtml = `<html><body><article><p>Subscribe to read more.</p></article></body></html>`;
    const result = extractArticle(shortHtml, "https://example.com/locked");
    expect(result.is_paywalled).toBe(true);
  });

  it("counts words in extracted text", () => {
    const result = extractArticle(FULL_ARTICLE_HTML, "https://example.com/article");
    expect(result.word_count).toBeGreaterThan(10);
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
cd workers/archive && npx vitest run src/__tests__/text-extractor.test.ts
```
Expected: FAIL.

- [ ] **Implement text extractor**

```typescript
// workers/archive/src/text-extractor.ts
import * as cheerio from "cheerio";

export interface ExtractedArticle {
  title: string | null;
  author: string | null;
  published_at: string | null;
  text_extracted: string;
  word_count: number;
  og_image: string | null;
  og_description: string | null;
  schema_org: Record<string, unknown>;
  is_paywalled: boolean;
}

const NOISE_SELECTORS = [
  "nav", "header", "footer", "aside", ".sidebar", ".ad", ".advertisement",
  ".newsletter-signup", ".related-articles", "script", "style", "noscript",
];

function parseSchemaOrg(html: string): Record<string, unknown> {
  const $ = cheerio.load(html);
  try {
    const raw = $('script[type="application/ld+json"]').first().text();
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function extractArticle(html: string, url: string): ExtractedArticle {
  const $ = cheerio.load(html);
  const schema = parseSchemaOrg(html);

  // Remove noise elements
  NOISE_SELECTORS.forEach(sel => $(sel).remove());

  // Extract body text from article/main/body fallback
  const bodyEl = $("article").first().length
    ? $("article").first()
    : $("main").first().length
    ? $("main").first()
    : $("body");

  const text_extracted = bodyEl.text().replace(/\s+/g, " ").trim();
  const word_count = text_extracted.split(/\s+/).filter(Boolean).length;

  // Title
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim() ||
    (schema.name as string) ||
    null;

  // Author
  const authorSchema = schema.author as Record<string, string> | string | undefined;
  const author =
    typeof authorSchema === "string"
      ? authorSchema
      : authorSchema?.name ||
        $('meta[name="author"]').attr("content") ||
        null;

  // Published date
  const published_at =
    (schema.datePublished as string) ||
    $('meta[property="article:published_time"]').attr("content") ||
    $("time[datetime]").first().attr("datetime") ||
    null;

  // OG tags
  const og_image =
    $('meta[property="og:image"]').attr("content") || null;
  const og_description =
    $('meta[property="og:description"]').attr("content") || null;

  // Paywall detection
  const accessibleRaw = (schema.isAccessibleForFree as string | undefined)?.toLowerCase();
  const is_paywalled =
    accessibleRaw === "false" ||
    accessibleRaw === false.toString() ||
    word_count < 150;

  return {
    title,
    author,
    published_at,
    text_extracted,
    word_count,
    og_image,
    og_description,
    schema_org: schema,
    is_paywalled,
  };
}
```

- [ ] **Run test to confirm it passes**

```bash
cd workers/archive && npx vitest run src/__tests__/text-extractor.test.ts
```
Expected: PASS — 8 tests.

- [ ] **Commit**

```bash
git add workers/archive/src/text-extractor.ts workers/archive/src/__tests__/text-extractor.test.ts
git commit -m "feat(archive): HTML text extractor with paywall detection"
```

---

## Task 8: Sitemap Discovery

**Files:**
- Create: `workers/archive/src/sitemap-discovery.ts`
- Create: `workers/archive/src/__tests__/sitemap-discovery.test.ts`

- [ ] **Write the failing test**

```typescript
// workers/archive/src/__tests__/sitemap-discovery.test.ts
import { describe, it, expect, vi } from "vitest";
import { parseSitemap, discoverUrls } from "../sitemap-discovery.js";

const NEWS_SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://sailingworld.com/race/j70-worlds-2025/</loc>
    <lastmod>2025-06-15</lastmod>
    <news:news>
      <news:publication_date>2025-06-15T09:00:00Z</news:publication_date>
    </news:news>
  </url>
  <url>
    <loc>https://sailingworld.com/gear/new-sails-review/</loc>
    <lastmod>2025-06-14</lastmod>
  </url>
</urlset>`;

const SITEMAP_INDEX_XML = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://sailingworld.com/news-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://sailingworld.com/sitemap-2025.xml</loc></sitemap>
</sitemapindex>`;

describe("parseSitemap", () => {
  it("extracts URLs from a news sitemap", () => {
    const result = parseSitemap(NEWS_SITEMAP_XML);
    expect(result.type).toBe("urlset");
    expect(result.urls).toHaveLength(2);
    expect(result.urls[0].loc).toBe("https://sailingworld.com/race/j70-worlds-2025/");
    expect(result.urls[0].lastmod).toBe("2025-06-15");
  });

  it("detects sitemap index", () => {
    const result = parseSitemap(SITEMAP_INDEX_XML);
    expect(result.type).toBe("index");
    expect(result.sitemaps).toHaveLength(2);
  });
});

describe("discoverUrls", () => {
  it("returns URLs from a news sitemap", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => NEWS_SITEMAP_XML,
    });
    global.fetch = fakeFetch as any;
    const urls = await discoverUrls("sailingworld.com", ["https://sailingworld.com/news-sitemap.xml"]);
    expect(urls.length).toBe(2);
    expect(urls[0]).toBe("https://sailingworld.com/race/j70-worlds-2025/");
  });

  it("follows sitemap index and collects child URLs", async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => SITEMAP_INDEX_XML })
      .mockResolvedValue({ ok: true, text: async () => NEWS_SITEMAP_XML });
    global.fetch = fakeFetch as any;
    const urls = await discoverUrls("sailingworld.com", ["https://sailingworld.com/sitemap.xml"]);
    expect(urls.length).toBe(4); // 2 child sitemaps × 2 URLs each
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
cd workers/archive && npx vitest run src/__tests__/sitemap-discovery.test.ts
```
Expected: FAIL.

- [ ] **Implement sitemap discovery**

```typescript
// workers/archive/src/sitemap-discovery.ts
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

interface ParseResult {
  type: "urlset" | "index";
  urls: SitemapUrl[];
  sitemaps: string[];
}

export function parseSitemap(xml: string): ParseResult {
  const doc = parser.parse(xml);

  if (doc.sitemapindex) {
    const raw = doc.sitemapindex.sitemap;
    const sitemaps = (Array.isArray(raw) ? raw : [raw])
      .map((s: any) => s?.loc)
      .filter(Boolean);
    return { type: "index", urls: [], sitemaps };
  }

  if (doc.urlset) {
    const raw = doc.urlset.url;
    const urls = (Array.isArray(raw) ? raw : [raw])
      .map((u: any) => ({ loc: u?.loc, lastmod: u?.lastmod }))
      .filter((u): u is SitemapUrl => typeof u.loc === "string");
    return { type: "urlset", urls, sitemaps: [] };
  }

  return { type: "urlset", urls: [], sitemaps: [] };
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "SailingAlmanac-Crawler/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Sitemap fetch failed ${res.status}: ${url}`);
  return res.text();
}

export async function discoverUrls(
  domain: string,
  sitemapUrls: string[],
  maxDepth = 2
): Promise<string[]> {
  const collected: string[] = [];

  async function crawl(url: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const xml = await fetchXml(url);
      const result = parseSitemap(xml);
      if (result.type === "index") {
        for (const child of result.sitemaps) {
          await crawl(child, depth + 1);
        }
      } else {
        collected.push(...result.urls.map(u => u.loc));
      }
    } catch {
      // non-fatal — skip this sitemap
    }
  }

  for (const url of sitemapUrls) {
    await crawl(url, 0);
  }

  return collected;
}

export function buildSitemapUrls(domain: string): string[] {
  return [
    `https://${domain}/news-sitemap.xml`,
    `https://${domain}/sitemap.xml`,
    `https://${domain}/sitemap_index.xml`,
    `https://www.${domain}/news-sitemap.xml`,
    `https://www.${domain}/sitemap.xml`,
  ];
}
```

- [ ] **Run test to confirm it passes**

```bash
cd workers/archive && npx vitest run src/__tests__/sitemap-discovery.test.ts
```
Expected: PASS — 4 tests.

- [ ] **Commit**

```bash
git add workers/archive/src/sitemap-discovery.ts workers/archive/src/__tests__/sitemap-discovery.test.ts
git commit -m "feat(archive): sitemap discovery — urlset and index parsing, auto URL candidates"
```

---

## Task 9: Pagination Crawler

**Files:**
- Create: `workers/archive/src/pagination-crawler.ts`

No unit test here — the logic is a simple loop over a configurable pattern. Integration tested when domain configs are seeded.

- [ ] **Implement pagination crawler**

```typescript
// workers/archive/src/pagination-crawler.ts
import * as cheerio from "cheerio";

export interface PaginationPattern {
  type: "page" | "date" | "offset";
  template: string;   // e.g. "/news/page/{n}" or "/archive/{year}/{month}"
  startPage: number;
  maxPages?: number;
}

export async function crawlPaginatedArchive(
  domain: string,
  pattern: PaginationPattern,
  articleSelector: string,
  rateLimitMs: number
): Promise<string[]> {
  const collected: string[] = [];
  const max = pattern.maxPages ?? 500;
  let consecutive404s = 0;

  for (let page = pattern.startPage; page < pattern.startPage + max; page++) {
    const path = pattern.template.replace("{n}", String(page));
    const url = `https://${domain}${path}`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "SailingAlmanac-Crawler/1.0" },
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 404) {
        consecutive404s++;
        if (consecutive404s >= 3) break; // end of archive
        continue;
      }
      if (!res.ok) continue;

      consecutive404s = 0;
      const html = await res.text();
      const $ = cheerio.load(html);

      const links: string[] = [];
      $(articleSelector).each((_, el) => {
        const href = $(el).attr("href");
        if (href) {
          links.push(href.startsWith("http") ? href : `https://${domain}${href}`);
        }
      });

      if (links.length === 0) break; // empty page = end of archive
      collected.push(...links);

      // rate limit
      await new Promise(r => setTimeout(r, rateLimitMs));
    } catch {
      consecutive404s++;
      if (consecutive404s >= 3) break;
    }
  }

  return collected;
}
```

- [ ] **Commit**

```bash
git add workers/archive/src/pagination-crawler.ts
git commit -m "feat(archive): pagination crawler with consecutive-404 termination"
```

---

## Task 10: Domain Configs Seed

**Files:**
- Create: `workers/archive/src/domain-configs.ts`

- [ ] **Implement domain configs seed**

```typescript
// workers/archive/src/domain-configs.ts
import { Pool } from "pg";

interface DomainSeed {
  domain: string;
  tier: 1 | 2 | 3;
  languages: string[];
  rate_limit_ms: number;
  sitemap_urls?: string[];
  pagination_pattern?: object;
  article_link_selector?: string;
  is_paywalled?: boolean;
}

const DOMAINS: DomainSeed[] = [
  // Tier 1
  { domain: "sailingscuttlebutt.com",  tier: 1, languages: ["en"], rate_limit_ms: 5000 },
  { domain: "sailinganarchy.com",       tier: 1, languages: ["en"], rate_limit_ms: 5000 },
  { domain: "sailingworld.com",         tier: 1, languages: ["en"], rate_limit_ms: 5000 },
  { domain: "yachtsandyachting.com",    tier: 1, languages: ["en"], rate_limit_ms: 5000 },
  { domain: "yachtingworld.com",        tier: 1, languages: ["en"], rate_limit_ms: 5000 },
  { domain: "yachtingmonthly.com",      tier: 1, languages: ["en"], rate_limit_ms: 5000, is_paywalled: true },
  { domain: "sail-world.com",           tier: 1, languages: ["en"], rate_limit_ms: 5000 },
  // Tier 2
  { domain: "afloat.ie",                tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "mysailing.com.au",         tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "boatinternational.com",    tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "ussailing.org",            tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "sailing.org.au",           tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "yachtingnz.org.nz",        tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "cruisingworld.com",        tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "sailmagazine.com",         tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "seahorsemagazine.com",     tier: 2, languages: ["en"], rate_limit_ms: 3000, is_paywalled: true },
  { domain: "americascup.com",          tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "sailgp.com",              tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "livesaildie.com",          tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  // Tier 3 — international
  { domain: "yacht.de",                 tier: 3, languages: ["de"], rate_limit_ms: 3000 },
  { domain: "giornaledellavela.com",    tier: 3, languages: ["it"], rate_limit_ms: 3000 },
  { domain: "pressmare.it",             tier: 3, languages: ["it"], rate_limit_ms: 3000 },
  { domain: "boatingnz.co.nz",         tier: 3, languages: ["en"], rate_limit_ms: 3000 },
];

export async function seedDomainConfigs(pool: Pool): Promise<void> {
  for (const d of DOMAINS) {
    await pool.query(
      `INSERT INTO archive_domain_configs
         (domain, tier, languages, rate_limit_ms, sitemap_urls,
          pagination_pattern, article_link_selector, is_paywalled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (domain) DO NOTHING`,
      [
        d.domain,
        d.tier,
        d.languages,
        d.rate_limit_ms,
        d.sitemap_urls ?? null,
        d.pagination_pattern ? JSON.stringify(d.pagination_pattern) : null,
        d.article_link_selector ?? null,
        d.is_paywalled ?? false,
      ]
    );
  }
  console.log(`[ArchiveSeed] Seeded ${DOMAINS.length} domain configs.`);
}
```

- [ ] **Commit**

```bash
git add workers/archive/src/domain-configs.ts
git commit -m "feat(archive): seed 23 initial domain configs (tier 1-3)"
```

---

## Task 11: Article Fetcher

**Files:**
- Create: `workers/archive/src/article-fetcher.ts`

- [ ] **Implement article fetcher**

```typescript
// workers/archive/src/article-fetcher.ts
import { Pool } from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Queue } from "bullmq";
import { extractArticle } from "./text-extractor.js";
import { generateUrlHash, normalizeUrl } from "./lib/dedup.js";
import { detectLanguage } from "./lib/language-detect.js";
import { RobotsChecker } from "./lib/robots.js";
import { DomainRateLimiter } from "./lib/rate-limiter.js";

export interface FetchJobData {
  url: string;
  domain: string;
  rateLimitMs: number;
  crawlerSource: "sitemap" | "pagination";
}

const USER_AGENT = "SailingAlmanac-Crawler/1.0 (+https://sailingalmanac.org/about)";

export async function fetchAndStore(
  job: FetchJobData,
  pool: Pool,
  s3: S3Client,
  b2Bucket: string,
  spnQueue: Queue,
  robots: RobotsChecker,
  rateLimiter: DomainRateLimiter
): Promise<void> {
  const normalized = normalizeUrl(job.url);
  const urlHash = generateUrlHash(normalized);

  // Check robots.txt
  const urlObj = new URL(normalized);
  const allowed = await robots.isAllowed(job.domain, urlObj.pathname);
  if (!allowed) {
    console.log(`[Fetcher] robots.txt disallows ${normalized} — skipping`);
    return;
  }

  // Rate limit
  await rateLimiter.wait(job.domain, job.rateLimitMs);

  // Fetch HTML
  const res = await fetch(normalized, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${normalized}`);
  const html = await res.text();

  // Extract
  const extracted = extractArticle(html, normalized);

  // Detect language using TLD hint
  const tld = job.domain.split(".").pop();
  const language = detectLanguage(extracted.text_extracted, { tld });

  // Write to B2
  const b2Key = `articles/${job.domain}/${urlHash}.json`;
  const b2Payload = {
    url: normalized,
    crawled_at: new Date().toISOString(),
    language,
    title: extracted.title,
    author: extracted.author,
    published_at: extracted.published_at,
    html_raw: html,
    text_extracted: extracted.text_extracted,
    word_count: extracted.word_count,
    schema_org: extracted.schema_org,
    og_tags: {
      description: extracted.og_description,
      image: extracted.og_image,
    },
  };

  await s3.send(new PutObjectCommand({
    Bucket: b2Bucket,
    Key: b2Key,
    Body: JSON.stringify(b2Payload),
    ContentType: "application/json",
  }));

  // Upsert article_links
  await pool.query(
    `INSERT INTO article_links
       (url_hash, canonical_url, title, content_snippet, publisher_name,
        published_at, og_image_url, full_text_b2_key, full_text_language,
        full_text_status, crawler_source, content_type, relevance_version)
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10, $11, 'article', NULL)
     ON CONFLICT (url_hash) DO UPDATE SET
       full_text_b2_key   = EXCLUDED.full_text_b2_key,
       full_text_language = EXCLUDED.full_text_language,
       full_text_status   = EXCLUDED.full_text_status,
       crawler_source     = EXCLUDED.crawler_source`,
    [
      urlHash,
      normalized,
      extracted.title,
      extracted.og_description ?? extracted.text_extracted.slice(0, 300),
      job.domain,
      extracted.published_at,
      extracted.og_image,
      b2Key,
      language,
      extracted.is_paywalled ? "paywalled" : "extracted",
      job.crawlerSource,
    ]
  );

  // Enqueue Wayback SPN
  await spnQueue.add("archive", { url: normalized }, {
    jobId: `spn-article-${urlHash}`,
    attempts: 5,
    backoff: { type: "exponential", delay: 15000 },
  });

  console.log(`[Fetcher] Stored ${normalized} (${language}, ${extracted.word_count} words, paywalled=${extracted.is_paywalled})`);
}
```

- [ ] **Commit**

```bash
git add workers/archive/src/article-fetcher.ts
git commit -m "feat(archive): article fetcher — fetch, extract, B2 write, DB upsert, SPN enqueue"
```

---

## Task 12: Worker Index (BullMQ wiring + timers)

**Files:**
- Create: `workers/archive/src/index.ts`

- [ ] **Implement the worker entry point**

```typescript
// workers/archive/src/index.ts
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import { Worker, Queue } from "bullmq";
import { Pool } from "pg";
import { S3Client } from "@aws-sdk/client-s3";
import { seedDomainConfigs } from "./domain-configs.js";
import { fetchAndStore } from "./article-fetcher.js";
import { discoverUrls, buildSitemapUrls } from "./sitemap-discovery.js";
import { isKnownUrl } from "./lib/dedup.js";
import { RobotsChecker } from "./lib/robots.js";
import { DomainRateLimiter } from "./lib/rate-limiter.js";

const redis = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APP_KEY!,
  },
});

const B2_BUCKET = process.env.B2_BUCKET_NAME!;

const discoveryQueue = new Queue("archive-discovery", { connection: redis });
const fetchQueue     = new Queue("archive-fetch",     { connection: redis });
const spnQueue       = new Queue("wayback-spn",       { connection: redis });

const robots      = new RobotsChecker();
const rateLimiter = new DomainRateLimiter();

// ── Discovery worker ──────────────────────────────────────────────────────────

new Worker("archive-discovery", async (job) => {
  const { domain, runType } = job.data as { domain: string; runType: string };
  console.log(`[Discovery] ${domain} — ${runType}`);

  const domainRes = await pool.query(
    "SELECT * FROM archive_domain_configs WHERE domain = $1 AND is_active = TRUE",
    [domain]
  );
  if (!domainRes.rows[0]) return;
  const config = domainRes.rows[0];

  await pool.query(
    "INSERT INTO archive_crawl_runs (domain, run_type) VALUES ($1, $2) RETURNING id",
    [domain, runType]
  );
  const runId = (await pool.query(
    "SELECT id FROM archive_crawl_runs WHERE domain = $1 ORDER BY started_at DESC LIMIT 1",
    [domain]
  )).rows[0].id;

  const sitemapUrls: string[] = config.sitemap_urls?.length
    ? config.sitemap_urls
    : buildSitemapUrls(domain);

  const discovered = await discoverUrls(domain, sitemapUrls);
  let newCount = 0;
  let skipped  = 0;

  for (const url of discovered) {
    const known = await isKnownUrl(url, pool.query.bind(pool));
    if (known) { skipped++; continue; }
    await fetchQueue.add("fetch", {
      url,
      domain,
      rateLimitMs: config.rate_limit_ms,
      crawlerSource: "sitemap",
    }, {
      jobId: `fetch-${Buffer.from(url).toString("base64").slice(0, 40)}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 10000 },
    });
    newCount++;
  }

  await pool.query(
    `UPDATE archive_crawl_runs
     SET urls_discovered = $1, urls_new = $2, urls_skipped = $3,
         status = 'completed', completed_at = NOW()
     WHERE id = $4`,
    [discovered.length, newCount, skipped, runId]
  );
  await pool.query(
    "UPDATE archive_domain_configs SET last_crawled_at = NOW() WHERE domain = $1",
    [domain]
  );

  console.log(`[Discovery] ${domain} — discovered=${discovered.length} new=${newCount} skipped=${skipped}`);
}, { connection: redis, concurrency: 2 });

// ── Fetch worker ──────────────────────────────────────────────────────────────

new Worker("archive-fetch", async (job) => {
  await fetchAndStore(job.data, pool, s3, B2_BUCKET, spnQueue, robots, rateLimiter);
}, { connection: redis, concurrency: 3 });

// ── Periodic discovery scheduler ─────────────────────────────────────────────

async function runDiscovery(runType: "sitemap_news" | "sitemap_full") {
  const res = await pool.query(
    "SELECT domain, crawl_priority FROM archive_domain_configs WHERE is_active = TRUE ORDER BY crawl_priority ASC"
  );
  for (const row of res.rows) {
    await discoveryQueue.add("discover", { domain: row.domain, runType }, {
      jobId: `discover-${row.domain}-${runType}-${Date.now()}`,
    });
  }
  console.log(`[Scheduler] Enqueued ${runType} discovery for ${res.rows.length} domains`);
}

// News sitemaps: every 30 minutes
setInterval(() => runDiscovery("sitemap_news"), 30 * 60 * 1000);

// Full sitemaps: once a week (604800000 ms)
// Offset by 1 hour so it doesn't collide with the first news run
setTimeout(() => {
  runDiscovery("sitemap_full");
  setInterval(() => runDiscovery("sitemap_full"), 7 * 24 * 60 * 60 * 1000);
}, 60 * 60 * 1000);

// ── Startup ───────────────────────────────────────────────────────────────────

async function main() {
  await seedDomainConfigs(pool);
  console.log("[ArchiveWorker] Started. News sitemap discovery fires every 30 minutes.");
  // Fire first news discovery immediately on startup
  await runDiscovery("sitemap_news");
}

main().catch(err => {
  console.error("[ArchiveWorker] Fatal:", err);
  process.exit(1);
});
```

- [ ] **Commit**

```bash
git add workers/archive/src/index.ts
git commit -m "feat(archive): BullMQ worker entry point with 30-min discovery scheduler"
```

---

## Task 13: Systemd Service + Deploy Integration

**Files:**
- Create: `workers/archive/Dockerfile`
- Modify: `scripts/deploy-timers.ts` — add `archive-seed` npm script entry
- Modify: `package.json` (root) — add `archive-seed` script

- [ ] **Create Dockerfile (same pattern as ingest worker)**

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY workers/archive/package*.json ./workers/archive/
RUN npm install --omit=dev --workspace=@sailsouthern/archive-worker
COPY workers/archive/dist ./workers/archive/dist
COPY .env .env
CMD ["node", "workers/archive/dist/index.js"]
```

- [ ] **Add archive-seed CLI to root package.json**

In `package.json` scripts section, add:
```json
"archive-seed": "tsx scripts/archive-seed.ts"
```

- [ ] **Create the seed CLI script**

```typescript
// scripts/archive-seed.ts
/**
 * Manual historical backfill trigger for a specific domain.
 * Usage: npm run archive-seed -- --domain sailingworld.com [--since 2023-01-01]
 */
import dotenv from "dotenv";
dotenv.config();
import { Queue } from "bullmq";

const args = process.argv.slice(2);
const domain = args[args.indexOf("--domain") + 1];
if (!domain) { console.error("--domain required"); process.exit(1); }

const redis = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

const discoveryQueue = new Queue("archive-discovery", { connection: redis });

await discoveryQueue.add("discover", { domain, runType: "backfill" }, {
  jobId: `backfill-${domain}-${Date.now()}`,
});

console.log(`[ArchiveSeed] Enqueued full backfill discovery for ${domain}`);
process.exit(0);
```

- [ ] **Create the systemd service unit on chantecler-01**

```bash
ssh -i ~/.ssh/id_proart aewoodyard@chantecler-01 'cat > /tmp/almanac-archive.service << '\''EOF'\''
[Unit]
Description=Sailing Almanac Archive Crawler Worker
After=network.target

[Service]
Type=simple
User=aewoodyard
WorkingDirectory=/home/aewoodyard/ss-sailsouthern-com
EnvironmentFile=/home/aewoodyard/ss-sailsouthern-com/.env
ExecStart=/usr/bin/npx tsx workers/archive/src/index.ts
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
sudo cp /tmp/almanac-archive.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable almanac-archive.service
echo "Service installed"'
```

- [ ] **Commit everything**

```bash
git add workers/archive/Dockerfile scripts/archive-seed.ts package.json
git commit -m "feat(archive): Dockerfile, seed CLI, and systemd service unit"
```

---

## Task 14: Build, Deploy, and Smoke Test

- [ ] **Build the worker**

```bash
cd workers/archive && npm run build
```
Expected: `dist/` populated, no TypeScript errors.

- [ ] **Push to GitHub and pull on server**

```bash
git push origin main
ssh -i ~/.ssh/id_proart aewoodyard@chantecler-01 "cd ~/ss-sailsouthern-com && git pull && npm install"
```

- [ ] **Start the service**

```bash
ssh -i ~/.ssh/id_proart aewoodyard@chantecler-01 "sudo systemctl start almanac-archive.service && sleep 5 && systemctl is-active almanac-archive.service"
```
Expected: `active`

- [ ] **Verify domain configs were seeded**

```bash
ssh -i ~/.ssh/id_proart aewoodyard@chantecler-01 \
  "docker exec almanac-db psql -U almanac_user almanac_db -c 'SELECT domain, tier FROM archive_domain_configs ORDER BY tier, domain;'"
```
Expected: 23 rows.

- [ ] **Verify first discovery run fired**

```bash
ssh -i ~/.ssh/id_proart aewoodyard@chantecler-01 \
  "journalctl -u almanac-archive --no-pager -n 20 2>&1 | grep -v 'Hint\|Users'"
```
Expected: log lines showing discovery enqueued for each domain.

- [ ] **Trigger a manual backfill for one domain to verify end-to-end**

```bash
ssh -i ~/.ssh/id_proart aewoodyard@chantecler-01 \
  "cd ~/ss-sailsouthern-com && npm run archive-seed -- --domain sailingworld.com"
```

- [ ] **Wait 2 minutes then check for new article_links rows**

```bash
ssh -i ~/.ssh/id_proart aewoodyard@chantecler-01 \
  "docker exec almanac-db psql -U almanac_user almanac_db -c \
  \"SELECT canonical_url, full_text_status, crawler_source FROM article_links WHERE crawler_source = 'sitemap' ORDER BY id DESC LIMIT 5;\""
```
Expected: rows with `crawler_source = 'sitemap'` and `full_text_status = 'extracted'` or `'paywalled'`.

- [ ] **Final commit and push**

```bash
git add -A
git commit -m "feat(archive): archive crawler v1 complete — sitemap discovery, full text extraction, B2 storage, SPN preservation"
git push origin main
```
