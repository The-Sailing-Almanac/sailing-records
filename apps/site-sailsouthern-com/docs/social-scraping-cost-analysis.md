# Social Scraping — Cost Analysis & Strategy

## Platform Summary

| Platform | Signal Quality | Our Approach | Est. Monthly Cost |
|---|---|---|---|
| **Bluesky** | Good, growing | Inoreader Pro native integration | ~$0 (included in Inoreader Pro) |
| **Facebook Pages** | Excellent for US clubs | Inoreader Pro (paste page URL) | ~$0 (included) |
| **Instagram** | Excellent for visual/brand | Apify scraper (scheduled) | ~$5–30/mo |
| **Twitter/X** | Good for race news | RSSHub self-hosted OR RSS.app | $0–$9.99/mo |
| **YouTube** | Good for race footage | Native RSS (free, no API) | $0 |
| **Google News** | Broad sailing news | Native RSS (free) | $0 |

---

## Apify — Instagram Scraping

**Pricing structure (as of May 2026):**
- **$1.50 per 1,000 posts** scraped (official Apify Instagram Actor)
- **$2.30 per 1,000 comments** (if we want comment data — we don't)
- **Free plan:** $5/month in credits (≈ 3,300 posts/mo for free)
- **Starter plan:** $29/month (~19,000 posts/mo in credits)

**What we'd actually use it for:**
We aren't scraping mass-volume Instagram. We'd target specific accounts:
- US sailing class associations (Laser, 505, Thistle, Flying Scot, etc.)
- Regional yacht clubs (CYC, BYC, NYYC, etc.)
- Sailmakers (North, Quantum, UK, Doyle)
- Key race organizations (ORCA, PHRF, etc.)

At ~5–10 posts/day per account × 50 accounts = ~300 posts/day = ~9,000/month.
**That's ~$13.50/month at $1.50/1k**, well within the $29 Starter plan.

**Our workflow for Instagram posts:**
1. Apify scrapes targeted accounts on a schedule (daily or twice daily)
2. Returns post text, image URL, timestamp, like count
3. We download the image → store in B2 as a screenshot
4. Gemini 1.5 multimodal: extract text as blockquote + generate blurb
5. Insert into `article_links` with `metadata.source_type = "social_instagram"`
6. Display on site: blockquote text + screenshot + link to original post

**Verdict:** Start with Apify free tier ($5/mo in credits) for testing.
Scale to $29/mo Starter when volume warrants it. Very cheap.

---

## Twitter/X — Free Self-Hosted via RSSHub

**RSSHub** is an open-source tool that can generate RSS feeds for Twitter/X accounts
using your own session tokens (cookies from a logged-in browser session).

**How it works:**
1. We deploy RSSHub as a Docker container on chantecler-01 (it's tiny, ~50MB)
2. We provide our Twitter cookie/session token (from a dedicated scraper Twitter account)
3. RSSHub exposes RSS URLs for any Twitter account or search query
4. We add those RSS URLs to our `feed_endpoints` table — poller handles the rest

**Cost:** $0. The only cost is compute (negligible on chantecler-01).

**Risk:** Twitter aggressively blocks scrapers. Expect occasional breakage. The session
token will need refreshing periodically (every few weeks). Use a dedicated throwaway
Twitter account, not your personal one.

**Accounts to target for sailing:**
```
@USASailing
@SailGP
@AmericasCup
@WorldSailing
@sailinganarchy
@OceanRacingCWG
@VendeeGlobe
# Plus individual sailors and teams as discovered
```

---

## Facebook Pages — The Real Options

Facebook killed public RSS in 2015. Your options ranked by cost/effort:

### Option A: Inoreader Pro (Recommended)
- Works by pasting a Facebook Page URL into Inoreader
- Inoreader handles the scraping/auth on their end
- Content flows through our existing webhook
- **Cost:** Included in Inoreader Pro (~$9.99/mo)
- **Coverage:** Public pages only; no personal profiles

### Option B: RSS.app or FetchRSS
- Convert any public Facebook Page to an RSS URL
- Add that URL to our `feed_endpoints` table
- **Cost:** RSS.app = $9.99/mo for up to 100 feeds; FetchRSS = similar
- **Advantage:** RSS URL persists independently of Inoreader

### Option C: Zapier (Pages You Admin)
- If you are an admin of the Facebook page, Zapier can use the official Facebook API
- Much more stable than scraping
- **Cost:** Zapier free tier supports 100 tasks/mo; likely enough for yacht club pages we manage

---

## Recommended Rollout Order

### Phase 1 — Immediate (This week, ~$0 extra/mo)
- [x] Inoreader Pro: Add Facebook Pages for key sailing orgs
- [x] Inoreader Pro: Connect Bluesky, follow sailing hashtags + key accounts  
- [ ] Add native Bluesky RSS URLs (`bsky.app/profile/{handle}/rss`) to feed_endpoints
- [ ] Add Google News RSS for sailing keywords to feed_endpoints

### Phase 2 — Soon (~$9.99/mo)
- [ ] Deploy RSSHub on chantecler-01 for Twitter/X account monitoring
- [ ] Add RSS.app account for Facebook Pages not coverable via Inoreader

### Phase 3 — When Volume Warrants (~$29/mo)
- [ ] Set up Apify Instagram scraper for targeted sailing account list
- [ ] Wire Apify output to our `POST /api/webhooks/apify` endpoint (to be built)
- [ ] Implement Gemini multimodal OCR pipeline for Instagram screenshots

---

## Total Estimated Monthly Social Infrastructure Cost

| Item | Cost |
|---|---|
| Inoreader Pro (Facebook + Bluesky) | ~$9.99/mo |
| RSSHub on chantecler-01 (Twitter/X) | $0 |
| Apify Instagram (Phase 3) | ~$5–$29/mo |
| RSS.app (optional Facebook fallback) | $0–$9.99/mo |
| **Total range** | **$10–$49/mo** |

This is extremely cheap for the coverage it provides.
