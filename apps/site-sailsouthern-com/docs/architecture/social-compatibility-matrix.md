# Social Compatibility Matrix

This document provides a technical overview of compatibility rules, character limits, rich preview specs, image constraints, and federation behaviors across our target social network integrations.

---

## Technical Constraints & Matrix

| Platform | Text Limit | Format | Image Size / Aspect Ratio | Alt Text Required? | Preview Card Logic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Twitter / X** | 280 chars (standard) | Plain Text / UTF-8 | Max 5MB; 16:9 preferred | Highly recommended | Inspects `twitter:card` ("summary_large_image") and `og:image` |
| **Mastodon** | 500 chars (default) | HTML Subset (in API) | Max 16MB; any aspect ratio | Yes (configurable via API) | Fetches the page URL's `og:title`, `og:description`, and `og:image` |
| **Bluesky** | 300 characters | RichText / Facets | Max 1MB; 4:3 or 16:9 | Yes (strongly enforced) | Requires client-side parsing of rich-embed cards via Lexicon ATProto schemas |
| **Nostr** | Unlimited | Markdown (kind:1) | Image links in-text | Optional | Clients resolve URL links in content; card previews are client-dependent |
| **Tumblr** | Unlimited | HTML / Markdown | Max 20MB per photo | Optional | Renders native photo posts or resolves Link post details using Open Graph |

---

## Detailed Platform Quirks

### 1. Mastodon (ActivityPub)
* **HTML Parsing:** When publishing status updates via API, Mastodon parses standard tags like `<a>`, `<p>`, `<br/>`, `<span>`, `<em>`, `<strong>`.
* **Mentions & Hashtags:** Mentioning user handles (e.g., `@almanac@social.sailingalmanac.org`) automatically formats them as local mentions if resolved via WebFinger. All hashtags (e.g., `#sailing`) must be in plain text.
* **Open Graph Caching:** Mastodon servers crawl shared URLs on-demand to generate preview cards. If the page lacks proper `og:image` tags or returns a non-200 HTTP code, it yields a plain link.

### 2. Bluesky (ATProto)
* **Facets:** Unlike Mastodon, Bluesky does not parse links or mentions out of raw strings. The client/publisher must calculate string byte indices for all links and mentions, compiling them into a `facets` JSON payload.
* **Embed Images:** Images cannot be referenced by external URL; they must first be uploaded as a binary blob via `com.atproto.repo.uploadBlob` and then referenced by `cid` and `mimeType` in the post's `embed` property.

### 3. Nostr
* **Formatting:** Nostr is completely decentralized and relies on client interpretation. Links in the `content` field of a kind:1 note are displayed as raw strings by some clients, and rendered as rich cards/media players by others.
* **Tags:** Relies on `tags` array (e.g., `["t", "sailing"]`) to enable discoverability in global hashtag streams.

### 4. Tumblr
* **Theme Styling:** Tumblr allows complete styling flexibility via raw HTML/CSS. If deploying custom templates like `custom-theme.html`, enforce strict HTTPS asset paths, as browsers block mixed content.
