# Feedly Setup Runbook

## Strategy

You do NOT need Feedly Enterprise. The strategy is:

1. Create a **free/personal Feedly account** dedicated to this project
2. Add sailing feeds (RSS, YouTube, any content Feedly can natively pull)
3. Save interesting items to a Feedly **Board** called "Almanac"
4. Use the Board's **RSS URL** as a feed in our poller — no webhook, no API key needed

This gives you Feedly's excellent discovery UI as a curation layer, with our system
consuming the output automatically.

---

## Step 1 — Create a Dedicated Feedly Account

Use a separate account (not your personal one) to keep sailing signals clean.
Suggested: `sailsouthern.almanac@gmail.com` → Feedly account.

---

## Step 2 — Add Feeds to Feedly

Add any mix of:
- Sailing RSS feeds (same list as Inoreader, or different ones)
- YouTube channels (Feedly natively supports YouTube channel RSS)
- Google News RSS for search terms like "sailing regatta" or "sailboat race"

**Google News RSS for keywords:**
```
https://news.google.com/rss/search?q=sailing+regatta&hl=en-US&gl=US&ceid=US:en
https://news.google.com/rss/search?q=sailboat+race+results&hl=en-US&gl=US&ceid=US:en
https://news.google.com/rss/search?q=SailGP&hl=en-US&gl=US&ceid=US:en
https://news.google.com/rss/search?q="America%27s+Cup"+sailing&hl=en-US&gl=US&ceid=US:en
```
These are free and work as standard RSS feeds in any reader.

---

## Step 3 — Create an "Almanac" Board

In Feedly, boards are your saved-article collections.

1. Click **Boards** in the left sidebar
2. Create a board: **"Almanac"**
3. As you browse Feedly and see relevant articles, hit **Save to Board → Almanac**

---

## Step 4 — Get the Board's RSS URL

Every Feedly board exposes a public RSS feed:

1. Open your "Almanac" board
2. Click the **Share** icon (or three-dot menu)
3. Select **Copy RSS Link**
4. The URL will look like:
   `https://feedly.com/f/user/USER_ID/category/BOARD_ID`

---

## Step 5 — Add Board RSS to Our Poller

Once you have the board RSS URL, add it to our `feed_endpoints` table:

```bash
# SSH into chantecler-01 and run:
echo "INSERT INTO feed_endpoints (url, is_active, crawl_frequency_minutes) VALUES ('YOUR_FEEDLY_BOARD_RSS_URL', true, 30) ON CONFLICT (url) DO NOTHING;" \
  | docker exec -i almanac-db psql -U almanac_user -d almanac_db
```

Or add it to `data/initial-feeds.txt` and re-run the seeder script.

The board refreshes as you save articles to it, and our poller checks every 30 minutes.

---

## Optional: Feedly Webhook (via Zapier/Make)

If you want real-time push instead of polling:

1. Create a **Zapier** account (free tier is fine)
2. Set up a Zap: **Feedly → New Saved Article in Board → Webhook POST**
3. Point the webhook to: `https://api.sailsouthern.com/api/webhooks/feedly`
4. Map the fields: title, url, published, source name

Our `POST /api/webhooks/feedly` endpoint is live and handles this payload.

---

## Twitter/X via Feedly

Feedly's Twitter integration requires their Market Intelligence plan (~$12k/yr). Skip it.

**Better free approach for Twitter/X signals:**
See `docs/runbooks/twitter-rss-bridge.md` for the self-hosted RSSHub approach,
which lets you monitor specific Twitter accounts via RSS with your own session token.

---

## Facebook Pages via Feedly

Feedly does NOT support Facebook Pages on personal plans.
Use **Inoreader Pro** for Facebook Pages (see `docs/runbooks/inoreader-setup.md`).

**Free alternative:** RSS.app ($9.99/mo for up to 100 feeds) or FetchRSS can convert
public Facebook Pages to RSS URLs that you then add to our `feed_endpoints` table directly.
