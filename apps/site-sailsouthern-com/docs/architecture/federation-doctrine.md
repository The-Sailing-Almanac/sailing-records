# Federation Doctrine

This document outlines the philosophy, privacy boundaries, and architecture for federating Sail Southern’s data and community spaces across the decentralized web.

---

## 1. ActivityPub (Mastodon, Pixelfed, Calckey, etc.)

ActivityPub enables users on any federated instance to follow and interact with Sail Southern entities and tribes.

### Principles:
1. **One Actor per Entity / Tribe**:
   - Rather than a single monolithic `@sailsouthern` account, each major boat class (e.g., `@j24@sailsouthern.com`), regional fleet (`@galveston_bay@sailsouthern.com`), and sailing club has its own distinct ActivityPub actor profile.
   - This allows users to subscribe only to the specific niches they care about, preventing feed fatigue.
2. **No Private Data in AP Payloads**:
   - All ActivityPub payloads represent publicly discoverable almanac info, articles, or bulletins.
   - User email addresses, click hashes, or subscription tiers are never published to or stored in ActivityPub metadata.
3. **Inbound Tracking Only (MVP)**:
   - For the initial release, the system accepts and registers `Follow` and `Undo` activities. Outbound article announcements (`Create` -> `Note`) are deferred to future stages.

---

## 2. Nostr (Notes and Other Stuff Transmitted by Relays)

Nostr provides a lightweight, censorship-resistant broadcasting layer.

### Principles:
1. **Value-for-Value (V4V) Philosophy**:
   - Nostr integration embraces micro-payments and lightning tips (zaps).
   - Profiles are annotated with lightning addresses to allow users to zap the authors of articles, race reports, or handicap analyses directly.
2. **Daily Edition Posting Plan**:
   - A dedicated Nostr publisher worker compiles the daily Sail Southern newsletter headlines.
   - It signs and publishes kind:1 events containing short snippets, hashtags, and a tracked `/sendit/` redirect url.
   - Hashtags are derived from the article topics (e.g. `#sailing`, `#regatta`) to maximize discovery across client search indexes.

---

## 3. Bluesky & AT Protocol

The AT Protocol provides structured schema feeds and queryable indexes.

### Principles:
1. **The "Sailing Feed" Product**:
   - Rather than acting as a standard social profile, Sail Southern runs a custom **Bluesky Feed Generator**.
   - The generator exposes the `getFeedSkeleton` endpoint, filtering the global Bluesky firehose using Sail Southern's entity mention graph to return a high-relevance "Sailing & Racing Almanac" feed.
2. **The "In addition to Facebook" Principle**:
   - Decoupled federation is designed as an additive product, not an antagonistic one.
   - We meet sailors where they currently gather (which historically is Facebook Groups) while providing high-quality, syndicated, and independent syndication pathways through Bluesky, Nostr, and Mastodon.
