# Social Web Readiness Audit
# Sail Southern / Sailing Almanac — Phase 9
# Date: 2026-05-29

---

## Brand Identity for All Platforms

Before activating any platform, align on these shared values:

| Field | Value |
|-------|-------|
| **Publication name** | Sailing Almanac |
| **Handle** | @sailingalmanac (preferred) or @sailsouthern |
| **Tagline** | The daily sailing news digest |
| **URL to share** | https://sailsouthern.com |
| **Longer bio** | Daily sailing news, race coverage, and coastal dispatches — curated and archived at sailsouthern.com |

> **Operator decision needed:** Which handle? `@sailingalmanac` or `@sailsouthern`? Be consistent across all platforms.

---

## Platform Readiness Matrix

| Platform | Credential Env Var | Status | Profile Configured |
|----------|--------------------|--------|--------------------|
| Mastodon | `MASTODON_ACCESS_TOKEN`, `MASTODON_INSTANCE_URL` | ❓ Check `.env` | ❓ Unknown |
| Nostr | `NOSTR_PRIVATE_KEY`, `NOSTR_RELAYS` | ❓ Check `.env` | ❓ Unknown |
| Bluesky | `BLUESKY_IDENTIFIER`, `BLUESKY_PASSWORD` | ❓ Check `.env` | ❓ Unknown |

> Run `GET /api/v1/system/readiness` to see which credentials are present. Publishing credentials card will show all three.

---

## Mastodon

### Required configuration
```
MASTODON_INSTANCE_URL=https://mastodon.social   # or your chosen instance
MASTODON_ACCESS_TOKEN=<your_access_token>
```

### Profile checklist
- [ ] Account exists on the instance URL
- [ ] Display name: "Sailing Almanac" (or operator-approved name)
- [ ] Bio: "Daily sailing news, race coverage, and coastal dispatches. Curated and archived. sailsouthern.com"
- [ ] Profile link: https://sailsouthern.com
- [ ] Profile photo / avatar uploaded
- [ ] `bot: true` set in account settings (this is an automated account)

### What the publisher posts
`generate-micro-edition.ts` composes a ~280-char social post per edition window.
Format: headline + 2–3 bullet articles + link + hashtags.

### Verify before activating
```powershell
npx tsx scripts/generate-micro-edition.ts --dry-run
```
Confirm Mastodon leg logs: `[Mastodon] WOULD post: ...`

### Notes
- Mastodon respects rate limits at ~300 posts/day — 4 windows/day is fine.
- Consider adding `#sailing #sailingnews` as default hashtags to the post template.

---

## Nostr

### Required configuration
```
NOSTR_PRIVATE_KEY=<nsec_or_hex_private_key>
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.band
```

### Profile checklist
- [ ] Private key generated and backed up securely (store in `.env` only, never commit)
- [ ] Public key / npub known and documented in ops notes
- [ ] Profile metadata published via `update-nostr-profile.ts` (if this script exists)
- [ ] Name: "Sailing Almanac"
- [ ] About: "Daily sailing news digest. Curated from across the sailing world. sailsouthern.com"
- [ ] Website: https://sailsouthern.com
- [ ] Picture: (URL to profile image, hosted on accessible CDN)

### Relay selection
Use at least 3 relays for redundancy. Recommended:
- `wss://relay.damus.io` — large, reliable
- `wss://nos.lol` — well-maintained
- `wss://relay.nostr.band` — good discoverability

### What the publisher posts
Kind 1 note (short text post) per publish window. Content mirrors the Mastodon post.

### Verify before activating
```powershell
npx tsx scripts/generate-micro-edition.ts --dry-run
```
Confirm Nostr leg logs relay connection and WOULD-post output.

### Notes
- Nostr has no rate limits. 4 posts/day is trivially low.
- Zap/V4V integration: if `LIGHTNING_ADDRESS` is set, it appears in Nostr profile `lud16` field automatically (check the profile update script).

---

## Bluesky

### Required configuration
```
BLUESKY_IDENTIFIER=yourhandle.bsky.social   # or custom domain handle
BLUESKY_PASSWORD=<app_password_not_login>
```

> **Critical:** Use an **App Password** from Bluesky settings, NOT your login password. Create at: Settings → Privacy and Security → App Passwords.

### Profile checklist
- [ ] Account exists at bsky.social (or custom handle)
- [ ] Display name: "Sailing Almanac"
- [ ] Description: "Daily sailing news, race coverage, and coastal dispatches. sailsouthern.com"
- [ ] Profile link set: https://sailsouthern.com
- [ ] Avatar/profile photo uploaded
- [ ] Custom domain handle (optional): can use `sailsouthern.com` as handle via DNS TXT record

### Custom domain handle setup (optional)
Add a DNS TXT record at your domain:
```
_atproto.sailsouthern.com   TXT   did=did:plc:<your_did>
```
Then verify via Bluesky settings. This changes your handle to `@sailsouthern.com`.

### What the publisher posts
AT Protocol post (same content as Mastodon/Nostr). 300-char limit.

### Verify before activating
```powershell
npx tsx scripts/generate-micro-edition.ts --dry-run
```
Confirm Bluesky leg logs: session creation and WOULD-post output.

### Notes
- Bluesky rate limit: ~1500 creates per day — 4 posts/day is fine.
- Facets (links in posts) are handled by the publishToBluesky adapter automatically.

---

## Social Links on the Website

Currently, the website footer has:
- Email: `alan@sailsouthern.com` ✅
- GitHub: `github.com/woodyardae/ss-sailsouthern-com` ✅
- **No Mastodon/Nostr/Bluesky links** ❌

**Before beta:** add social profile links to the footer once accounts are activated.

Suggested footer additions (after profile checklist above is complete):
```tsx
// Mastodon
<a href="https://mastodon.social/@sailingalmanac" rel="me">Mastodon</a>
// Bluesky
<a href="https://bsky.app/profile/sailsouthern.com">Bluesky</a>
// Nostr
<a href="https://njump.me/<npub>">Nostr</a>
```

Note: Mastodon link should use `rel="me"` for verified profile.

---

## Smoke-Test Sequence (after credentials are wired)

1. Verify credentials present:
   ```
   GET /api/v1/system/readiness → Publishing credentials: ready
   ```
2. Dry-run micro-edition:
   ```powershell
   npx tsx scripts/generate-micro-edition.ts --dry-run
   ```
   All three legs should log expected output without errors.

3. Manual trigger from dashboard:
   - Admin → Scheduler → "Publish now" → confirm
   - Check Publishing Runs tab — run appears, status = success
   - Check each platform account — post appears

4. Verify content quality:
   - Post is clearly labeled as sailing news (not spam)
   - Link correctly points to sailsouthern.com
   - Hashtags are appropriate (#sailing #sailingnews or similar)
   - Post truncates gracefully if content > char limit

---

## Blocked Items (prevents social activation)

| Item | Blocks | Action Required |
|------|--------|----------------|
| Social credentials not confirmed in `.env` | All 3 platforms | Operator adds credentials, restarts API |
| Profile copy not finalized | All 3 platforms | Operator decision on handle + bio |
| Profile not created on each platform | Each platform | Manual account setup |
| Website footer has no social links | Discoverability | Add after accounts confirmed |
| Handle not consistent across platforms | Brand coherence | Decide on @sailingalmanac vs @sailsouthern |
